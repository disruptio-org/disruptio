import openai, { resolveModel, safeCompletion } from './openai';
import prisma from './prisma';

/**
 * Compile the full context for an agent based on its allowedContext sources.
 */
export async function compileAgentContext(projectId: string, allowedContext: string[]): Promise<string> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      personas: true,
      guidelines: true,
      technology: true,
      designStyle: true,
      githubConnection: { include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      repositoryKnowledge: true,
      features: { include: { userStories: true } },
      contextItems: true,
    },
  });

  if (!project) return 'No project found.';

  const sections: string[] = [];

  if (allowedContext.includes('Product Context')) {
    sections.push(`## Product Context
- Name: ${project.name}
- Description: ${project.description || 'Not defined'}
- Product Type: ${project.productType || 'Not defined'}
- Business Goal: ${project.businessGoal || 'Not defined'}
- Target Users: ${project.targetUsers || 'Not defined'}
- Current Stage: ${project.currentStage || 'Not defined'}`);
  }

  if (allowedContext.includes('Personas') && project.personas.length > 0) {
    const personaText = project.personas.map((p) =>
      `### ${p.name} (${p.role})\n${p.description}\nGoals: ${p.goals}\nPain Points: ${p.painPoints}\nTechnical Level: ${p.technicalLevel}`
    ).join('\n\n');
    sections.push(`## Personas\n${personaText}`);
  }

  if (allowedContext.includes('UX/UI Rules') && project.guidelines) {
    const g = project.guidelines;
    sections.push(`## UX/UI Guidelines
- UX Principles: ${g.uxPrinciples || 'N/A'}
- Navigation: ${g.navigationPrinciples || 'N/A'}
- Form Behavior: ${g.formBehavior || 'N/A'}
- Empty States: ${g.emptyStateRules || 'N/A'}
- Loading States: ${g.loadingStateRules || 'N/A'}
- Error States: ${g.errorStateRules || 'N/A'}`);
  }

  if (allowedContext.includes('Design Style') && project.designStyle) {
    const d = project.designStyle;
    sections.push(`## Design Style
- Brand: ${d.brandPersonality || 'N/A'}
- Colors: ${d.colorPalette || 'N/A'}
- Typography: ${d.typography || 'N/A'}
- Components: ${d.componentStyle || 'N/A'}
- Do: ${d.dos || 'N/A'}
- Don't: ${d.donts || 'N/A'}`);
  }

  if (allowedContext.includes('Tech View') && project.technology) {
    const t = project.technology;
    sections.push(`## Technology View
- Frontend: ${t.frontend || 'N/A'}
- Backend: ${t.backend || 'N/A'}
- Database: ${t.database || 'N/A'}
- Authentication: ${t.authentication || 'N/A'}
- AI Layer: ${t.aiLayer || 'N/A'}
- Testing: ${t.testing || 'N/A'}
- Decisions: ${t.decisions || 'N/A'}`);
  }

  if (allowedContext.includes('GitHub Repo') && project.githubConnection) {
    const conn = project.githubConnection;
    const lastScan = conn.scans?.[0];
    sections.push(`## GitHub Repository
- Repository: ${conn.repository} (${conn.owner})
- Branch: ${conn.defaultBranch}
- Last Scan: ${lastScan ? new Date(lastScan.createdAt).toISOString() : 'Never'}
- Languages: ${lastScan ? JSON.stringify(lastScan.detectedLanguages) : 'N/A'}
- Frameworks: ${lastScan ? JSON.stringify(lastScan.detectedFrameworks) : 'N/A'}`);
  }

  if (allowedContext.includes('Repository Knowledge') && project.repositoryKnowledge) {
    const rk = project.repositoryKnowledge;
    sections.push(`## Repository Knowledge (Deep Scan v${rk.scanVersion})
- Architecture: ${rk.architectureSummary || 'N/A'}
- Tech Stack: ${typeof rk.techStackSummary === 'string' ? rk.techStackSummary : JSON.stringify(rk.techStackSummary)}
- API Routes: ${typeof rk.apiRoutes === 'string' ? rk.apiRoutes : JSON.stringify(rk.apiRoutes)}
- Components: ${typeof rk.components === 'string' ? rk.components : JSON.stringify(rk.components)}
- DB Models: ${typeof rk.databaseModels === 'string' ? rk.databaseModels : JSON.stringify(rk.databaseModels)}
- Architecture Detail: ${typeof rk.architecture === 'string' ? rk.architecture : JSON.stringify(rk.architecture)}`);
  }

  if (allowedContext.includes('Features') && project.features.length > 0) {
    const featureText = project.features.map((f) => {
      const stories = f.userStories.map((s) =>
        `  - As a ${s.persona}, I want to ${s.action} so that ${s.benefit} [${s.complexity}] [${s.status}]`
      ).join('\n');
      return `### ${f.title} [${f.priority}] [${f.status}]\n${f.description || ''}\n${stories || '  No user stories'}`;
    }).join('\n\n');
    sections.push(`## Features & User Stories\n${featureText}`);
  }

  if (project.contextItems.length > 0) {
    const ctxText = project.contextItems.map((c) => `- ${c.title}: ${c.content}`).join('\n');
    sections.push(`## Additional Context\n${ctxText}`);
  }

  return sections.join('\n\n---\n\n');
}

/**
 * Run an agent: compile system prompt + context, call OpenAI, store result.
 */
export async function runAgent(
  agentId: string,
  userMessage: string,
  options?: { responseFormat?: 'text' | 'json' }
): Promise<{
  runId: string;
  response: string;
  model: string;
  tokensUsed: { prompt: number; completion: number; total: number };
}> {
  const agent = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });
  if (!agent) throw new Error('Agent not found');

  const context = await compileAgentContext(agent.projectId, Array.isArray(agent.allowedContext) ? agent.allowedContext as string[] : []);
  const model = resolveModel(agent.model || 'gpt-4');

  const systemPrompt = `${agent.systemInstructions}\n\n# Project Context\n\n${context}`;

  const messages: { role: 'system' | 'user'; content: string }[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userMessage },
  ];

  const completion = await safeCompletion(openai, {
    model,
    messages,
    temperature: agent.temperature ?? undefined,
    max_completion_tokens: 4096,
  });

  // Apply response format separately if needed
  if (options?.responseFormat === 'json') {
    // Re-run with json format if needed - safeCompletion handles param compat
  }

  const response = completion.choices[0]?.message?.content || '';
  const usage = completion.usage;

  // Store the run
  const run = await prisma.agentRun.create({
    data: {
      agentConfigurationId: agentId,
      status: 'completed',
      input: { userMessage, model, temperature: agent.temperature },
      output: { response, usage: usage ? { prompt_tokens: usage.prompt_tokens, completion_tokens: usage.completion_tokens, total_tokens: usage.total_tokens } : null },
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return {
    runId: run.id,
    response,
    model,
    tokensUsed: {
      prompt: usage?.prompt_tokens || 0,
      completion: usage?.completion_tokens || 0,
      total: usage?.total_tokens || 0,
    },
  };
}
