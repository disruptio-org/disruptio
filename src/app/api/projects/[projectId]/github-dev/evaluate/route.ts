import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createOctokit } from '@/lib/github';
import { createProjectClient, resolveModel } from '@/lib/openai';
import { cookies } from 'next/headers';

/**
 * POST /api/projects/[projectId]/github-dev/evaluate
 * 
 * Runs an AI evaluation of the PR against the user story's
 * acceptance criteria, requirements, and gherkin scenarios.
 * 
 * Strategy: Fetches FULL file contents from the PR branch (not just diffs)
 * so the AI can verify complete implementations, not just changes.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storyId } = await req.json();
  if (!storyId) return NextResponse.json({ error: 'storyId is required' }, { status: 400 });

  // Load story with all context
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

  // 1. Fetch PR info and changed files
  let prContext = '';
  try {
    // Get PR metadata
    const { data: pr } = await octokit.pulls.get({
      owner, repo, pull_number: story.githubPrNumber,
    });

    // Get list of changed files
    const { data: files } = await octokit.pulls.listFiles({
      owner, repo, pull_number: story.githubPrNumber, per_page: 100,
    });

    // Build a compact file list summary
    const fileList = files.map((f: any) =>
      `- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})`
    ).join('\n');

    // For each changed file, fetch the FULL content from the PR branch
    // This is much better than diffs because the AI can see complete implementations
    const fileContents: string[] = [];
    let totalContentSize = 0;
    const MAX_TOTAL_CONTENT = 60000; // 60k chars total for file contents
    const MAX_PER_FILE = 4000; // 4k chars per file

    for (const f of files) {
      if (totalContentSize > MAX_TOTAL_CONTENT) {
        fileContents.push(`### ${f.filename}\n(file content omitted — total content limit reached. See diff summary below.)`);
        continue;
      }

      // Skip binary files and very large files
      if (!f.patch && f.status !== 'removed') {
        fileContents.push(`### ${f.filename}\n(binary or very large file — see diff summary below)`);
        continue;
      }

      // Skip removed files
      if (f.status === 'removed') {
        fileContents.push(`### ${f.filename} [DELETED]`);
        continue;
      }

      try {
        // Fetch full file content from the PR branch
        const { data: content } = await octokit.repos.getContent({
          owner, repo,
          path: f.filename,
          ref: pr.head.ref,
        });

        if ('content' in content && content.encoding === 'base64') {
          const decoded = Buffer.from(content.content, 'base64').toString('utf-8');
          const trimmed = decoded.length > MAX_PER_FILE
            ? decoded.slice(0, MAX_PER_FILE) + '\n\n... (file truncated at ' + MAX_PER_FILE + ' chars)'
            : decoded;
          fileContents.push(`### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n\`\`\`\n${trimmed}\n\`\`\``);
          totalContentSize += trimmed.length;
        } else {
          // Fallback to diff patch
          const patch = f.patch ? f.patch.slice(0, MAX_PER_FILE) : '(no content available)';
          fileContents.push(`### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n\`\`\`diff\n${patch}\n\`\`\``);
          totalContentSize += patch.length;
        }
      } catch {
        // Fallback to diff patch if file fetch fails
        const patch = f.patch ? f.patch.slice(0, MAX_PER_FILE) : '(content not available)';
        fileContents.push(`### ${f.filename} (${f.status})\n\`\`\`diff\n${patch}\n\`\`\``);
        totalContentSize += patch.length;
      }
    }

    prContext = `## PR #${pr.number}: ${pr.title}
Branch: ${pr.head.ref} → ${pr.base.ref}
State: ${pr.state}
Changed files: ${files.length}

### Files Changed
${fileList}

## Full File Contents (from PR branch)
${fileContents.join('\n\n')}`;

  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch PR data: ${err.message}` }, { status: 500 });
  }

  // 2. Build the context from story data
  const acceptanceCriteria = (story.acceptanceCriteria as string[]) || [];
  const requirements = (story.requirements as any[]) || [];
  const gherkins = (story.gherkinScenarios as any[]) || [];
  const techReview = story.techReview as any;

  const contextBlock = [
    `## User Story\nAs a ${story.persona}, I want to ${story.action} so that ${story.benefit}.`,
    acceptanceCriteria.length > 0 ? `## Acceptance Criteria\n${acceptanceCriteria.map((c, i) => `${i + 1}. ${c}`).join('\n')}` : '',
    requirements.length > 0 ? `## Requirements\n${requirements.map(r => `- [${r.type}/${r.priority}] ${r.description}`).join('\n')}` : '',
    gherkins.length > 0 ? `## Gherkin Scenarios\n${gherkins.map(g => `### ${g.title}\nGiven ${g.given}\nWhen ${g.when}\nThen ${g.then}`).join('\n\n')}` : '',
    techReview ? `## Technical Review Notes\n${techReview.notes || ''}\n${techReview.impactAnalysis || ''}\n${techReview.architectureNotes || ''}` : '',
  ].filter(Boolean).join('\n\n');

  // 3. Call AI to evaluate
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { aiProvider: true, aiApiKey: true, aiBaseUrl: true, aiModel: true },
  });

  const client = createProjectClient(project || {});
  const model = resolveModel(project?.aiModel || 'gpt-4o');

  const systemPrompt = `You are a senior code reviewer evaluating a pull request against user story specifications.

You are provided with the FULL FILE CONTENTS from the PR branch — not just diffs. This means you can see the complete implementation, including code that was already there before this PR.

You MUST respond with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "criteriaResults": [
    { "criterion": "<acceptance criterion text>", "met": <boolean>, "evidence": "<brief explanation referencing specific files and code>" }
  ],
  "requirementResults": [
    { "requirement": "<requirement text>", "met": <boolean>, "evidence": "<brief explanation>" }
  ],
  "risks": [
    { "severity": "high|medium|low", "description": "<risk description>" }
  ],
  "suggestions": [
    "<improvement suggestion>"
  ],
  "summary": "<2-3 sentence summary of the evaluation>"
}

EVALUATION RULES:
1. You have FULL file contents — judge based on what the code ACTUALLY does, not just what the diff shows.
2. Mark a criterion as "met" if the implementation in the provided files satisfies it, even if not all files are shown.
3. Focus on FUNCTIONAL correctness: does the code actually implement the feature described?
4. For non-functional requirements (testing, documentation, accessibility), be proportionally lenient — these are nice-to-have, not blockers.
5. Reference specific file names and implementation details in your evidence.
6. Score: Calculate based on weighted criteria — acceptance criteria are worth 70%, non-functional requirements worth 30%.
7. DO NOT penalize for code quality issues in files that are NOT part of this feature (e.g., unrelated API routes).
8. If a file's content was truncated, note this but do NOT assume the missing code is broken.`;

  const userPrompt = `Evaluate this pull request against the user story specification.

${contextBlock}

---

${prContext}`;

  try {
    let completion;
    try {
      completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.2,
        max_completion_tokens: 16000,
        response_format: { type: 'json_object' },
      });
    } catch (retryErr: any) {
      console.log('[AI Eval] First attempt failed, retrying:', retryErr.message);
      completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only.' },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 16000,
      });
    }

    console.log('[AI Eval] finish_reason:', completion.choices[0]?.finish_reason);
    console.log('[AI Eval] usage:', JSON.stringify(completion.usage));

    const raw = completion.choices[0]?.message?.content || '{}';
    console.log('[AI Eval] Response length:', raw.length);
    console.log('[AI Eval] Response preview:', raw.substring(0, 500));

    // Extract JSON from potential markdown code block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    let evaluation: any;
    try {
      evaluation = JSON.parse(jsonMatch[1]?.trim() || raw.trim());
    } catch {
      console.error('[AI Eval] Failed to parse JSON');
      evaluation = { score: 0, summary: 'Failed to parse AI response', criteriaResults: [], requirementResults: [], risks: [], suggestions: [], rawResponse: raw };
    }

    // Add metadata
    evaluation.evaluatedAt = new Date().toISOString();
    evaluation.model = model;
    evaluation.prNumber = story.githubPrNumber;

    console.log('[AI Eval] Score:', evaluation.score);

    // Save to database
    await prisma.userStory.update({
      where: { id: storyId },
      data: { codeEvaluation: evaluation },
    });

    return NextResponse.json({ ok: true, evaluation });
  } catch (err: any) {
    console.error('[AI Evaluation Error]', err);
    return NextResponse.json({ error: `AI evaluation failed: ${err.message}` }, { status: 500 });
  }
}
