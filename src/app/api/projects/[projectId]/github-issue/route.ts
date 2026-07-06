import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createOctokit } from '@/lib/github';
import { cookies } from 'next/headers';

/**
 * POST /api/projects/[projectId]/github-issue
 * 
 * Creates a GitHub issue from a fully-detailed user story.
 * Compiles user story, requirements, acceptance criteria, gherkin scenarios,
 * tech review, and planning into a structured issue body.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storyId } = await req.json();
  if (!storyId) return NextResponse.json({ error: 'storyId is required' }, { status: 400 });

  // Load the user story with feature
  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: { feature: true },
  });
  if (!story) return NextResponse.json({ error: 'User story not found' }, { status: 404 });

  // Load GitHub connection
  const connection = await prisma.gitHubConnection.findUnique({ where: { projectId } });
  if (!connection) return NextResponse.json({ error: 'No GitHub repository connected' }, { status: 400 });

  // Get token from cookie or stored connection
  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value || connection.accessTokenEncrypted;
  if (!token) return NextResponse.json({ error: 'GitHub token not found. Please reconnect your repository.' }, { status: 401 });

  // Build the issue content
  const title = `[${story.feature.title}] As a ${story.persona}, I want to ${story.action}`;
  const body = buildIssueBody(story);
  const labels = buildLabels(story);

  try {
    const octokit = createOctokit(token);
    const issue = await octokit.issues.create({
      owner: connection.owner,
      repo: connection.repository,
      title: title.length > 256 ? title.slice(0, 253) + '...' : title,
      body,
      labels,
    });

    // Update story with GitHub issue link and status
    await prisma.userStory.update({
      where: { id: storyId },
      data: {
        status: 'ready',
        githubIssueUrl: issue.data.html_url,
        githubIssueNumber: issue.data.number,
        githubIssueState: issue.data.state, // 'open'
      },
    });

    return NextResponse.json({
      ok: true,
      issueNumber: issue.data.number,
      issueUrl: issue.data.html_url,
      title: issue.data.title,
    });
  } catch (err: any) {
    console.error('[GitHub Issue Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to create GitHub issue' }, { status: 500 });
  }
}

function buildIssueBody(story: any): string {
  const sections: string[] = [];

  // User Story
  sections.push(`## 📋 User Story\n\n> As a **${story.persona}**, I want to **${story.action}** so that **${story.benefit}**.\n\n- **Complexity:** \`${story.complexity}\`\n- **Feature:** ${story.feature.title}`);

  // Requirements
  const reqs = story.requirements as any[];
  if (reqs && reqs.length > 0) {
    const funcReqs = reqs.filter(r => r.type === 'functional');
    const nonFuncReqs = reqs.filter(r => r.type === 'non-functional');
    let reqSection = '## 📝 Requirements\n';
    if (funcReqs.length > 0) {
      reqSection += '\n### Functional\n' + funcReqs.map(r => `- [${r.priority?.toUpperCase() || 'MUST'}] ${r.description}`).join('\n');
    }
    if (nonFuncReqs.length > 0) {
      reqSection += '\n\n### Non-Functional\n' + nonFuncReqs.map(r => `- [${r.priority?.toUpperCase() || 'SHOULD'}] ${r.description}`).join('\n');
    }
    sections.push(reqSection);
  }

  // Acceptance Criteria
  const criteria = story.acceptanceCriteria as any;
  if (criteria && Array.isArray(criteria) && criteria.length > 0) {
    sections.push('## ✅ Acceptance Criteria\n\n' + criteria.map((c: string, i: number) => `- [ ] ${c}`).join('\n'));
  }

  // Gherkin Scenarios
  const gherkins = story.gherkinScenarios as any[];
  if (gherkins && gherkins.length > 0) {
    let gherkinSection = '## 🧪 Test Scenarios (Gherkin)\n';
    for (const g of gherkins) {
      gherkinSection += `\n### ${g.title}\n\`\`\`gherkin\nGiven ${g.given}\nWhen ${g.when}\nThen ${g.then}\n\`\`\`\n`;
    }
    sections.push(gherkinSection);
  }

  // Tech Review
  const techReview = story.techReview as any;
  if (techReview) {
    let techSection = '## 🔧 Technical Review\n';
    if (techReview.notes) techSection += `\n**Notes:** ${techReview.notes}\n`;
    if (techReview.impactAnalysis) techSection += `\n**Impact Analysis:** ${techReview.impactAnalysis}\n`;
    if (techReview.risks?.length > 0) {
      techSection += '\n**Risks:**\n' + techReview.risks.map((r: string) => `- ⚠️ ${r}`).join('\n');
    }
    if (techReview.architectureNotes) techSection += `\n\n**Architecture Notes:** ${techReview.architectureNotes}`;
    sections.push(techSection);
  }

  // Planning — Subtasks
  const planning = story.planning as any;
  if (planning?.subtasks?.length > 0) {
    let planSection = '## 📐 Implementation Plan\n\n';
    planSection += '| Layer | Task | Estimate | Files |\n|-------|------|----------|-------|\n';
    for (const t of planning.subtasks) {
      const files = (t.files || []).map((f: string) => `\`${f}\``).join(', ') || '—';
      planSection += `| \`${t.layer.toUpperCase()}\` | ${t.title} | ${t.estimate || '—'} | ${files} |\n`;
    }
    if (planning.totalEstimate) {
      planSection += `\n**Total Estimate:** ${planning.totalEstimate}`;
    }
    if (planning.notes) {
      planSection += `\n\n**Notes:** ${planning.notes}`;
    }
    sections.push(planSection);
  }

  // File Impact
  if (planning?.impactedFiles?.length > 0 || planning?.newFiles?.length > 0) {
    let fileSection = '## 📂 File Impact\n';
    if (planning.impactedFiles?.length > 0) {
      fileSection += '\n**Modified Files:**\n' + planning.impactedFiles.map((f: string) => `- ✏️ \`${f}\``).join('\n');
    }
    if (planning.newFiles?.length > 0) {
      fileSection += '\n\n**New Files:**\n' + planning.newFiles.map((f: string) => `- ✨ \`${f}\``).join('\n');
    }
    sections.push(fileSection);
  }

  // Conflicts warning
  if (planning?.conflicts?.length > 0) {
    let conflictSection = '## ⚠️ Potential Conflicts\n\nThis story shares files with other user stories:\n';
    for (const c of planning.conflicts) {
      conflictSection += `\n- **${c.storyTitle}** — shared files: ${c.sharedFiles.map((f: string) => `\`${f}\``).join(', ')}`;
    }
    sections.push(conflictSection);
  }

  // Footer
  sections.push('---\n*Generated by [Disruptio](https://disruptio.io) — AI-Driven Product Delivery*');

  return sections.join('\n\n');
}

function buildLabels(story: any): string[] {
  const labels: string[] = ['disruptio'];

  // Complexity
  if (story.complexity === 'high') labels.push('complexity:high');
  else if (story.complexity === 'medium') labels.push('complexity:medium');
  else if (story.complexity === 'low') labels.push('complexity:low');

  // Layer-based labels from planning
  const planning = story.planning as any;
  if (planning?.subtasks) {
    const layers = new Set(planning.subtasks.map((t: any) => t.layer));
    if (layers.has('database')) labels.push('database');
    if (layers.has('frontend')) labels.push('frontend');
    if (layers.has('backend')) labels.push('backend');
  }

  return labels;
}
