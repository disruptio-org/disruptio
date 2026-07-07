import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createOctokit } from '@/lib/github';
import { cookies } from 'next/headers';

/**
 * POST /api/projects/[projectId]/github-dev/merge
 * 
 * Merges the PR associated with a user story.
 * Supports merge, squash, and rebase strategies.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storyId, mergeMethod = 'squash' } = await req.json();
  if (!storyId) return NextResponse.json({ error: 'storyId is required' }, { status: 400 });

  // Validate merge method
  const validMethods = ['merge', 'squash', 'rebase'];
  if (!validMethods.includes(mergeMethod)) {
    return NextResponse.json({ error: `Invalid merge method. Must be one of: ${validMethods.join(', ')}` }, { status: 400 });
  }

  // Load story
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { feature: true },
  });
  if (!story) return NextResponse.json({ error: 'User story not found' }, { status: 404 });
  if (!story.githubPrNumber) return NextResponse.json({ error: 'No PR linked to this story' }, { status: 400 });

  // Load GitHub connection
  const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
  if (!connection) return NextResponse.json({ error: 'No GitHub repo connected' }, { status: 400 });

  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value || connection.accessTokenEncrypted;
  if (!token) return NextResponse.json({ error: 'GitHub token not found' }, { status: 401 });

  const octokit = createOctokit(token);
  const owner = connection.owner;
  const repo = connection.repository;

  try {
    // Check PR is mergeable
    const { data: pr } = await octokit.pulls.get({
      owner, repo, pull_number: story.githubPrNumber,
    });

    if (pr.state !== 'open') {
      return NextResponse.json({ error: 'PR is not open. It may have already been merged or closed.' }, { status: 400 });
    }

    if (pr.mergeable === false) {
      return NextResponse.json({ error: 'PR has merge conflicts. Please resolve conflicts before merging.' }, { status: 400 });
    }

    // Merge the PR
    const commitTitle = mergeMethod === 'squash'
      ? `${pr.title} (#${pr.number})`
      : undefined;

    const { data: mergeResult } = await octokit.pulls.merge({
      owner, repo,
      pull_number: story.githubPrNumber,
      merge_method: mergeMethod as 'merge' | 'squash' | 'rebase',
      commit_title: commitTitle,
    });

    // Update story status to 'done' after successful merge
    await prisma.userStory.update({
      where: { id: storyId },
      data: { status: 'done' },
    });

    // Close the GitHub issue if it exists
    if (story.githubIssueNumber) {
      try {
        await octokit.issues.update({
          owner, repo,
          issue_number: story.githubIssueNumber,
          state: 'closed',
        });
      } catch (err: any) {
        console.warn('[Merge] Failed to close GitHub issue:', err.message);
        // Non-fatal — PR was merged successfully
      }
    }

    return NextResponse.json({
      ok: true,
      merged: mergeResult.merged,
      sha: mergeResult.sha,
      message: mergeResult.message,
    });
  } catch (err: any) {
    console.error('[Merge Error]', err);
    return NextResponse.json({ error: `Merge failed: ${err.message}` }, { status: 500 });
  }
}
