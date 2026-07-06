import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import openai from '@/lib/openai';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { feature, userStory } = await req.json();

  if (!feature?.trim()) {
    return NextResponse.json({ error: 'Feature description required' }, { status: 400 });
  }

  // Load repository knowledge
  const knowledge = await prisma.repositoryKnowledge.findUnique({
    where: { projectId },
  });

  if (!knowledge) {
    return NextResponse.json({
      error: 'Deep scan required before planning. Run a deep scan first.',
      action: 'DEEP_SCAN_REQUIRED',
    }, { status: 400 });
  }

  // Load project context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      personas: true,
      technology: true,
      features: { include: { userStories: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Build a rich context block for the LLM
  const arch = knowledge.architecture as any;
  const apiRoutes = (knowledge.apiRoutes || []) as any[];
  const components = (knowledge.components || []) as any[];
  const dbModels = (knowledge.databaseModels || {}) as Record<string, any>;
  const deps = (knowledge.dependencies || {}) as any;
  const fileIndex = (knowledge.fileIndex || []) as any[];
  const testStructure = (knowledge.testStructure || {}) as any;

  const codebaseContext = `
## Codebase Architecture
- Pattern: ${arch?.pattern || 'Unknown'}
- Total files: ${arch?.totalFiles || 0} (${arch?.sourceFiles || 0} source, ${arch?.testFiles || 0} tests)
- Framework: ${(deps?.runtime || []).join(', ')}

## Existing API Routes (${apiRoutes.length})
${apiRoutes.map((r: any) => `- ${r.methods?.join(',')} ${r.path}`).join('\n')}

## Existing Components (${components.length})
${components.map((c: any) => `- ${c.name} (${c.file}) [${c.estimatedComplexity || 'unknown'}]`).join('\n')}

## Database Models (${Object.keys(dbModels).length})
${Object.entries(dbModels).map(([name, info]: [string, any]) => `- ${name}: ${info.fieldCount || '?'} fields`).join('\n')}

## File Index
${fileIndex.slice(0, 80).map((f: any) => `- ${f.path} (${f.category || 'unknown'})`).join('\n')}

## Test Structure
- Vitest: ${testStructure.hasVitest ? 'Yes' : 'No'}
- Jest: ${testStructure.hasJest ? 'Yes' : 'No'}

## Technology
- Frontend: ${project.technology?.frontend || 'N/A'}
- Backend: ${project.technology?.backend || 'N/A'}
- Database: ${project.technology?.database || 'N/A'}

## Existing Features
${project.features.map((f) => `- ${f.title} [${f.status}] (${f.userStories.length} stories)`).join('\n') || 'None'}
`;

  const systemPrompt = `You are the Solution Architect — the best tech lead in the world. You have deep knowledge of the entire codebase. Your job is to create a precise implementation plan for a feature request.

You MUST respond with valid JSON in exactly this format:
{
  "subtasks": [
    {
      "id": 1,
      "title": "Short task title",
      "layer": "database|backend|frontend|testing|config",
      "type": "create|modify",
      "files": ["path/to/file.ts"],
      "description": "Detailed description of what to do",
      "estimatedComplexity": "low|medium|high"
    }
  ],
  "impactAnalysis": {
    "affectedLayers": ["database", "backend", "frontend", "testing"],
    "existingFilesToModify": ["path/to/existing/file.ts"],
    "newFilesToCreate": ["path/to/new/file.ts"]
  },
  "risks": ["Risk description"],
  "executionOrder": "Description of recommended execution order",
  "totalSubtasks": 5,
  "architectureNotes": "Any important architectural decisions or notes"
}

Rules:
1. Always cite specific file paths from the file index — never guess.
2. Order subtasks: database → backend → frontend → tests.
3. Separate frontend from backend work.
4. Always include a testing subtask.
5. Flag files that touch more than 3 existing files as "high" complexity.
6. Reference existing patterns (existing routes, components, models) when suggesting new ones.
7. Be specific — don't say "create a component", say which folder, what props, what state.`;

  const userMessage = `# Feature Request
${feature}

${userStory ? `# User Story\n${userStory}` : ''}

# Current Codebase
${codebaseContext}

Generate the implementation plan as JSON.`;

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
      temperature: 0.2,
      max_tokens: 4096,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let plan;
    try {
      plan = JSON.parse(raw);
    } catch {
      plan = { error: 'Failed to parse AI response', raw };
    }

    // Normalize impact analysis into consistent format for the planning tab
    if (plan.impactAnalysis) {
      plan.impactedFiles = plan.impactAnalysis.existingFilesToModify || [];
      plan.newFiles = plan.impactAnalysis.newFilesToCreate || [];
    }

    // Enrich with metadata
    plan.feature = feature;
    plan.userStory = userStory || null;
    plan.timestamp = new Date().toISOString();
    plan.scanVersion = knowledge.scanVersion;
    plan.model = 'gpt-4o';
    plan.tokensUsed = {
      prompt: completion.usage?.prompt_tokens || 0,
      completion: completion.usage?.completion_tokens || 0,
      total: completion.usage?.total_tokens || 0,
    };

    // Store as agent run
    const architectAgent = await prisma.agentConfiguration.findFirst({
      where: { projectId, agentType: 'solution-architect' },
    });

    if (architectAgent) {
      await prisma.agentRun.create({
        data: {
          agentConfigurationId: architectAgent.id,
          status: 'completed',
          input: { type: 'implementation-plan', feature, userStory },
          output: plan,
          startedAt: new Date(),
          completedAt: new Date(),
        },
      });
    }

    return NextResponse.json(plan);
  } catch (err: any) {
    console.error('[Plan AI Error]', err);
    return NextResponse.json(
      { error: err.message || 'AI planning failed' },
      { status: 500 }
    );
  }
}
