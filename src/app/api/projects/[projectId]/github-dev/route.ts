import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createOctokit } from '@/lib/github';
import { cookies } from 'next/headers';

/**
 * GET /api/projects/[projectId]/github-dev?storyId=xxx&type=development|reviews|checks
 * 
 * Fetches development activity from GitHub for a user story's linked issue.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const storyId = req.nextUrl.searchParams.get('storyId');
  const type = req.nextUrl.searchParams.get('type') || 'development';
  if (!storyId) return NextResponse.json({ error: 'storyId is required' }, { status: 400 });

  const story = await prisma.userStory.findUnique({ where: { id: storyId } });
  if (!story || !story.githubIssueNumber) {
    return NextResponse.json({ error: 'No linked GitHub issue' }, { status: 404 });
  }

  const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
  if (!connection) return NextResponse.json({ error: 'No GitHub repository connected' }, { status: 400 });

  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value || connection.accessTokenEncrypted;
  if (!token) return NextResponse.json({ error: 'GitHub token not found' }, { status: 401 });

  const octokit = createOctokit(token);
  const owner = connection.owner;
  const repo = connection.repository;
  const issueNumber = story.githubIssueNumber;

  try {
    if (type === 'development') {
      return await getDevelopmentData(octokit, owner, repo, issueNumber, story, storyId);
    } else if (type === 'reviews') {
      const prNumber = story.githubPrNumber || parseInt(req.nextUrl.searchParams.get('prNumber') || '0');
      if (!prNumber) return NextResponse.json({ error: 'No linked PR' }, { status: 404 });
      return await getReviewData(octokit, owner, repo, prNumber);
    } else if (type === 'checks') {
      const prNumber = story.githubPrNumber || parseInt(req.nextUrl.searchParams.get('prNumber') || '0');
      if (!prNumber) return NextResponse.json({ error: 'No linked PR' }, { status: 404 });
      return await getCheckData(octokit, owner, repo, prNumber);
    } else if (type === 'ship') {
      const prNumber = story.githubPrNumber || parseInt(req.nextUrl.searchParams.get('prNumber') || '0');
      if (!prNumber) return NextResponse.json({ error: 'No linked PR' }, { status: 404 });
      return await getShipData(octokit, owner, repo, prNumber, issueNumber);
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (err: any) {
    console.error('[GitHub Dev API]', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch data' }, { status: 500 });
  }
}

// ─── DEVELOPMENT: Branches, PRs, Commits ───
async function getDevelopmentData(
  octokit: any, owner: string, repo: string, issueNumber: number, story: any, storyId: string,
) {
  // Find PRs linked to this issue
  const { data: allPRs } = await octokit.pulls.list({
    owner, repo, state: 'all', per_page: 50, sort: 'updated', direction: 'desc',
  });

  // Match PRs that reference this issue in body, title, or via closing keywords
  const linkedPRs = allPRs.filter((pr: any) => {
    const bodyRef = pr.body && (
      pr.body.includes(`#${issueNumber}`) ||
      pr.body.toLowerCase().includes(`closes #${issueNumber}`) ||
      pr.body.toLowerCase().includes(`fixes #${issueNumber}`) ||
      pr.body.toLowerCase().includes(`resolves #${issueNumber}`)
    );
    const titleRef = pr.title && pr.title.includes(`#${issueNumber}`);
    // Also match if we already have this PR stored
    const storedMatch = story.githubPrNumber && pr.number === story.githubPrNumber;
    return bodyRef || titleRef || storedMatch;
  });

  // Get detailed info for each PR
  const pullRequests = await Promise.all(linkedPRs.map(async (pr: any) => {
    // Get commit count
    let commits: any[] = [];
    try {
      const { data } = await octokit.pulls.listCommits({ owner, repo, pull_number: pr.number, per_page: 30 });
      commits = data.map((c: any) => ({
        sha: c.sha.slice(0, 7),
        message: c.commit.message.split('\n')[0],
        author: c.commit.author?.name || c.author?.login || 'unknown',
        authorAvatar: c.author?.avatar_url || null,
        date: c.commit.author?.date,
      }));
    } catch { /* ignore */ }

    return {
      number: pr.number,
      title: pr.title,
      state: pr.merged_at ? 'merged' : pr.draft ? 'draft' : pr.state,
      url: pr.html_url,
      branch: pr.head?.ref || null,
      baseBranch: pr.base?.ref || null,
      author: pr.user?.login || 'unknown',
      authorAvatar: pr.user?.avatar_url || null,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      mergedAt: pr.merged_at,
      additions: pr.additions || 0,
      deletions: pr.deletions || 0,
      changedFiles: pr.changed_files || 0,
      commits,
      reviewers: (pr.requested_reviewers || []).map((r: any) => ({
        login: r.login,
        avatar: r.avatar_url,
      })),
    };
  }));

  // Update the story with PR info if we found a match
  if (pullRequests.length > 0) {
    const mainPR = pullRequests[0];
    const updates: any = {
      githubPrNumber: mainPR.number,
      githubPrState: mainPR.state,
      githubPrUrl: mainPR.url,
      githubBranch: mainPR.branch,
    };
    if (mainPR.mergedAt) {
      updates.mergedAt = new Date(mainPR.mergedAt);
    }
    try {
      await prisma.userStory.update({ where: { id: storyId }, data: updates });
    } catch { /* silent */ }
  }

  // Get issue timeline events for extra context
  let events: any[] = [];
  try {
    const { data } = await octokit.issues.listEventsForTimeline({
      owner, repo, issue_number: issueNumber, per_page: 50,
    });
    events = data
      .filter((e: any) => ['cross-referenced', 'referenced', 'closed', 'reopened', 'merged', 'committed'].includes(e.event))
      .map((e: any) => ({
        event: e.event,
        createdAt: e.created_at,
        actor: e.actor?.login || null,
        actorAvatar: e.actor?.avatar_url || null,
        source: e.source?.issue?.pull_request ? { type: 'pr', number: e.source.issue.number } : null,
      }));
  } catch { /* timeline may not be available */ }

  return NextResponse.json({
    pullRequests,
    events,
    branch: pullRequests[0]?.branch || story.githubBranch || null,
    hasPR: pullRequests.length > 0,
  });
}

// ─── REVIEWS: Review decisions, comments, requested reviewers ───
async function getReviewData(octokit: any, owner: string, repo: string, prNumber: number) {
  const [reviewsRes, commentsRes, requestedRes, prRes] = await Promise.all([
    octokit.pulls.listReviews({ owner, repo, pull_number: prNumber, per_page: 50 }),
    octokit.pulls.listReviewComments({ owner, repo, pull_number: prNumber, per_page: 50 }),
    octokit.pulls.listRequestedReviewers({ owner, repo, pull_number: prNumber }),
    octokit.pulls.get({ owner, repo, pull_number: prNumber }),
  ]);

  // Deduplicate reviews: keep latest per reviewer
  const reviewMap = new Map<string, any>();
  for (const r of reviewsRes.data) {
    const existing = reviewMap.get(r.user.login);
    if (!existing || new Date(r.submitted_at) > new Date(existing.submitted_at)) {
      reviewMap.set(r.user.login, r);
    }
  }
  const reviews = Array.from(reviewMap.values()).map((r: any) => ({
    reviewer: r.user.login,
    avatar: r.user.avatar_url,
    state: r.state, // APPROVED, CHANGES_REQUESTED, COMMENTED, PENDING, DISMISSED
    body: r.body || null,
    submittedAt: r.submitted_at,
  }));

  const comments = commentsRes.data.map((c: any) => ({
    id: c.id,
    author: c.user.login,
    avatar: c.user.avatar_url,
    body: c.body,
    path: c.path,
    line: c.line || c.original_line,
    createdAt: c.created_at,
    inReplyToId: c.in_reply_to_id || null,
  }));

  const requestedReviewers = [
    ...requestedRes.data.users.map((u: any) => ({ login: u.login, avatar: u.avatar_url, type: 'user' })),
    ...requestedRes.data.teams.map((t: any) => ({ login: t.slug, avatar: null, type: 'team' })),
  ];

  // Overall decision
  const hasApproval = reviews.some(r => r.state === 'APPROVED');
  const hasChangesRequested = reviews.some(r => r.state === 'CHANGES_REQUESTED');
  const decision = hasChangesRequested ? 'changes_requested' : hasApproval ? 'approved' : 'pending';

  return NextResponse.json({
    reviews,
    comments,
    requestedReviewers,
    decision,
    prState: prRes.data.merged_at ? 'merged' : prRes.data.draft ? 'draft' : prRes.data.state,
    mergeable: prRes.data.mergeable,
  });
}

// ─── CHECKS: CI/CD check runs ───
async function getCheckData(octokit: any, owner: string, repo: string, prNumber: number) {
  // Get the PR to find the head SHA
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });
  const sha = pr.head.sha;

  const { data: checkData } = await octokit.checks.listForRef({ owner, repo, ref: sha, per_page: 50 });

  const checkRuns = checkData.check_runs.map((cr: any) => ({
    id: cr.id,
    name: cr.name,
    status: cr.status, // queued, in_progress, completed
    conclusion: cr.conclusion, // success, failure, neutral, cancelled, timed_out, action_required, skipped
    startedAt: cr.started_at,
    completedAt: cr.completed_at,
    detailsUrl: cr.details_url || cr.html_url,
    output: cr.output ? {
      title: cr.output.title,
      summary: cr.output.summary?.slice(0, 500),
    } : null,
  }));

  // Combined status
  const { data: statusData } = await octokit.repos.getCombinedStatusForRef({ owner, repo, ref: sha });

  const passed = checkRuns.filter((c: any) => c.conclusion === 'success').length;
  const failed = checkRuns.filter((c: any) => c.conclusion === 'failure').length;
  const pending = checkRuns.filter((c: any) => c.status !== 'completed').length;

  return NextResponse.json({
    checkRuns,
    overallStatus: statusData.state, // success, failure, pending
    summary: { passed, failed, pending, total: checkRuns.length },
    sha: sha.slice(0, 7),
  });
}

// ─── SHIP: Merge status, deployments ───
async function getShipData(
  octokit: any, owner: string, repo: string, prNumber: number, issueNumber: number,
) {
  const { data: pr } = await octokit.pulls.get({ owner, repo, pull_number: prNumber });

  const merge = {
    merged: !!pr.merged_at,
    mergedAt: pr.merged_at,
    mergedBy: pr.merged_by ? {
      login: pr.merged_by.login,
      avatar: pr.merged_by.avatar_url,
    } : null,
    branch: pr.head.ref,
    baseBranch: pr.base.ref,
    commits: pr.commits,
    additions: pr.additions,
    deletions: pr.deletions,
  };

  // Try to get deployments
  let deployments: any[] = [];
  try {
    const { data } = await octokit.repos.listDeployments({ owner, repo, per_page: 10 });
    deployments = await Promise.all(data.slice(0, 5).map(async (d: any) => {
      let status = 'unknown';
      try {
        const { data: statuses } = await octokit.repos.listDeploymentStatuses({
          owner, repo, deployment_id: d.id, per_page: 1,
        });
        status = statuses[0]?.state || 'unknown';
      } catch { /* ignore */ }
      return {
        id: d.id,
        environment: d.environment,
        description: d.description,
        status,
        createdAt: d.created_at,
        url: d.payload?.web_url || null,
      };
    }));
  } catch { /* deployments may not be set up */ }

  // Build lifecycle timeline from issue events
  let timeline: any[] = [];
  try {
    const { data: events } = await octokit.issues.listEventsForTimeline({
      owner, repo, issue_number: issueNumber, per_page: 100,
    });
    timeline = events
      .filter((e: any) => e.created_at)
      .map((e: any) => ({
        event: e.event,
        createdAt: e.created_at,
        actor: e.actor?.login || null,
      }))
      .slice(0, 30);
  } catch { /* ignore */ }

  return NextResponse.json({ merge, deployments, timeline });
}
