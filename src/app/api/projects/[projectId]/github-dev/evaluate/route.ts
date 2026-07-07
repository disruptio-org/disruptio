import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createOctokit } from '@/lib/github';
import { createProjectClient, resolveModel, safeCompletion } from '@/lib/openai';
import { cookies } from 'next/headers';

/**
 * POST /api/projects/[projectId]/github-dev/evaluate
 * 
 * Runs an AI evaluation of the PR diff against the user story's
 * acceptance criteria, requirements, and gherkin scenarios.
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

  // 1. Fetch PR diff (files changed)
  let diffSummary = '';
  try {
    const { data: files } = await octokit.pulls.listFiles({
      owner, repo, pull_number: story.githubPrNumber, per_page: 100,
    });
    diffSummary = files.map((f: any) => {
      const patch = f.patch ? f.patch.slice(0, 1500) : '(binary or too large)';
      return `### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n\`\`\`diff\n${patch}\n\`\`\``;
    }).join('\n\n');

    // Cap total diff size
    if (diffSummary.length > 30000) {
      diffSummary = diffSummary.slice(0, 30000) + '\n\n... (diff truncated)';
    }
  } catch (err: any) {
    return NextResponse.json({ error: `Failed to fetch PR diff: ${err.message}` }, { status: 500 });
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

  const systemPrompt = `You are a senior code reviewer. You evaluate pull request diffs against user story specifications.

You MUST respond with valid JSON in this exact format:
{
  "score": <number 0-100>,
  "criteriaResults": [
    { "criterion": "<acceptance criterion text>", "met": <boolean>, "evidence": "<brief explanation>" }
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

Rules:
- Check each acceptance criterion against the actual code changes
- Mark a criterion as "met" only if the diff clearly implements it
- Flag security risks, missing error handling, performance concerns
- Be specific: reference file names and line patterns from the diff
- Score: 0-100 based on percentage of criteria met and code quality`;

  const userPrompt = `Evaluate this PR diff against the user story specification.

${contextBlock}

---

## PR Diff

${diffSummary}`;

  try {
    // Use direct API call with json_object format to force valid JSON output
    // gpt-5.5 and similar models need explicit response_format to produce structured output
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
      // Retry without temperature and response_format if the model doesn't support them
      console.log('[AI Eval] First attempt failed, retrying without temperature:', retryErr.message);
      completion = await client.chat.completions.create({
        model,
        messages: [
          { role: 'system', content: systemPrompt + '\n\nIMPORTANT: You MUST respond with valid JSON only. No markdown, no explanation, just the JSON object.' },
          { role: 'user', content: userPrompt },
        ],
        max_completion_tokens: 16000,
      });
    }

    console.log('[AI Eval] Completion finish_reason:', completion.choices[0]?.finish_reason);
    console.log('[AI Eval] Completion usage:', JSON.stringify(completion.usage));
    console.log('[AI Eval] Completion message role:', completion.choices[0]?.message?.role);
    console.log('[AI Eval] Completion message refusal:', (completion.choices[0]?.message as any)?.refusal);
    console.log('[AI Eval] Full message keys:', Object.keys(completion.choices[0]?.message || {}));
    console.log('[AI Eval] Full message:', JSON.stringify(completion.choices[0]?.message).substring(0, 2000));

    const raw = completion.choices[0]?.message?.content || '{}';
    console.log('[AI Eval] Raw AI response length:', raw.length);
    console.log('[AI Eval] Raw AI response (first 1000 chars):', raw.substring(0, 1000));
    // Extract JSON from potential markdown code block
    const jsonMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/) || [null, raw];
    let evaluation: any;
    try {
      evaluation = JSON.parse(jsonMatch[1]?.trim() || raw.trim());
    } catch {
      console.error('[AI Eval] Failed to parse JSON from AI response');
      evaluation = { score: 0, summary: 'Failed to parse AI response', criteriaResults: [], requirementResults: [], risks: [], suggestions: [], rawResponse: raw };
    }

    // Add metadata
    evaluation.evaluatedAt = new Date().toISOString();
    evaluation.model = model;
    evaluation.prNumber = story.githubPrNumber;

    console.log('[AI Eval] Final evaluation score:', evaluation.score, 'keys:', Object.keys(evaluation));

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
