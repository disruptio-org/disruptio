import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectClient, safeCompletion } from '@/lib/openai';

const DOC_TYPES = [
  { id: 'architecture', label: 'Architecture Overview' },
  { id: 'api', label: 'API Reference & Workflows' },
  { id: 'data-flow', label: 'Data Flow & Models' },
  { id: 'components', label: 'Component Map' },
  { id: 'general', label: 'Product Overview' },
];

/**
 * GET /api/projects/[projectId]/documentation
 * List all documentation for a project
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const docs = await prisma.projectDocumentation.findMany({
    where: { projectId },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ docs, docTypes: DOC_TYPES });
}

/**
 * POST /api/projects/[projectId]/documentation
 * Generate documentation using an AI agent
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { docType, agentId } = await req.json();

  if (!docType) {
    return NextResponse.json({ error: 'docType is required' }, { status: 400 });
  }

  // Load project with all context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      technology: true,
      personas: true,
      guidelines: true,
      features: { include: { userStories: true } },
      repositoryKnowledge: true,
      contextItems: true,
    },
  });

  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Load agent if specified
  let agentConfig = null;
  if (agentId) {
    agentConfig = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });
  }

  // Build context from all project sources
  const knowledge = project.repositoryKnowledge as any;
  const tech = project.technology;
  const features = project.features;
  const personas = project.personas;
  const guidelines = project.guidelines;
  const contextItems = project.contextItems;

  let contextBlock = `# Project: ${project.name}\n`;
  if (project.description) contextBlock += `Description: ${project.description}\n`;
  
  // Technology
  if (tech) {
    contextBlock += `\n## Technology Stack\n`;
    if (tech.frontend) contextBlock += `- Frontend: ${tech.frontend}\n`;
    if (tech.backend) contextBlock += `- Backend: ${tech.backend}\n`;
    if (tech.database) contextBlock += `- Database: ${tech.database}\n`;
    if (tech.authentication) contextBlock += `- Auth: ${tech.authentication}\n`;
  }

  // Features
  if (features.length > 0) {
    contextBlock += `\n## Features (${features.length})\n`;
    for (const f of features) {
      contextBlock += `### ${f.title} [${f.status}]\n`;
      if (f.description) contextBlock += `${f.description}\n`;
      if (f.userStories.length > 0) {
        contextBlock += `User Stories:\n`;
        for (const s of f.userStories) {
          contextBlock += `- As a ${s.persona}, I want to ${s.action} so that ${s.benefit} [${s.complexity}/${s.status}]\n`;
        }
      }
    }
  }

  // Personas
  if (personas.length > 0) {
    contextBlock += `\n## Personas (${personas.length})\n`;
    for (const p of personas) {
      contextBlock += `- **${p.name}** (${p.role}): ${p.goals || ''}\n`;
    }
  }

  // Repository knowledge
  if (knowledge) {
    const arch = knowledge.architecture as any;
    const apiRoutes = (knowledge.apiRoutes || []) as any[];
    const components = (knowledge.components || []) as any[];
    const dbModels = (knowledge.databaseModels || {}) as Record<string, any>;
    const fileIndex = (knowledge.fileIndex || []) as any[];
    const deps = (knowledge.dependencies || {}) as any;

    contextBlock += `\n## Repository Analysis\n`;
    if (arch) {
      contextBlock += `- Architecture: ${arch.pattern || 'Unknown'}\n`;
      contextBlock += `- Total Files: ${arch.totalFiles || 0} (${arch.sourceFiles || 0} source)\n`;
      contextBlock += `- Framework: ${arch.framework || 'Unknown'}\n`;
    }

    if (apiRoutes.length > 0) {
      contextBlock += `\n### API Routes (${apiRoutes.length})\n`;
      for (const r of apiRoutes) {
        contextBlock += `- ${(r.methods || []).join(',')} ${r.path}\n`;
      }
    }

    if (components.length > 0) {
      contextBlock += `\n### Components (${components.length})\n`;
      for (const c of components) {
        contextBlock += `- ${c.name} (${c.file}) [${c.estimatedComplexity || '?'}]\n`;
      }
    }

    if (Object.keys(dbModels).length > 0) {
      contextBlock += `\n### Database Models (${Object.keys(dbModels).length})\n`;
      for (const [name, info] of Object.entries(dbModels) as any) {
        contextBlock += `- ${name}: ${info.fieldCount || '?'} fields\n`;
      }
    }

    if (fileIndex.length > 0) {
      contextBlock += `\n### File Index (${Math.min(fileIndex.length, 100)} of ${fileIndex.length})\n`;
      for (const f of fileIndex.slice(0, 100)) {
        contextBlock += `- ${f.path} [${f.category || 'unknown'}]\n`;
      }
    }

    if (deps) {
      contextBlock += `\n### Dependencies\n`;
      if (deps.runtime) contextBlock += `- Runtime: ${(deps.runtime as string[]).slice(0, 20).join(', ')}\n`;
      if (deps.dev) contextBlock += `- Dev: ${(deps.dev as string[]).slice(0, 15).join(', ')}\n`;
    }
  }

  // Product context
  if (contextItems.length > 0) {
    contextBlock += `\n## Product Context\n`;
    for (const item of contextItems) {
      contextBlock += `### ${item.type}\n${item.content}\n\n`;
    }
  }

  // Build prompts per doc type
  const typePrompts: Record<string, string> = {
    architecture: `Generate a highly visual **Architecture Overview** document. 
Use multiple **Mermaid diagrams** (flowcharts, sequence diagrams, architecture diagrams) to explain the system.

Include:
1. **Visual Architecture Diagram** — Mermaid diagram showing core components and interactions.
2. **System Workflow** — Sequence diagram for a typical user-to-database operation.
3. **Technology Matrix** — A markdown table listing Frontend, Backend, Database, Auth, and Infra tools.
4. **Directory Map** — A structured tree or table of the src/ folder.
5. **Security Flow** — Visual diagram of the authentication and authorization layer.

CRITICAL: Every section should start with or include a visual element (Diagram or Table).`,

    api: `Generate a highly visual **API Reference & Workflow** document. 

Include:
1. **API Flow Diagram** — Mermaid sequence diagram showing Auth -> API -> Logic -> DB.
2. **Endpoint Catalog** — Markdown table summarizing all routes (Method, Path, Auth, Purpose).
3. **Request/Response Models** — Code blocks with examples for every core endpoint.
4. **Auth Sequence** — Mermaid diagram for the login/session renewal flow.
5. **Error States** — Table of common error codes and their visual meanings.

CRITICAL: Use tables for endpoint lists and Mermaid for workflows.`,

    'data-flow': `Generate a highly visual **Data Flow & Models** document. 

Include:
1. **ER Diagram** — Comprehensive Mermaid ER diagram showing all models and relationships.
2. **Model Schema Table** — A detailed table for each core model (Field, Type, Description).
3. **Data Lifecycle Flow** — Mermaid flowchart: Creation -> Validation -> Storage -> Processing.
4. **State Management Map** — Visual map of how data is cached vs persisted.
5. **Validation Layers** — Diagram showing where validation happens (Client, API, DB).

CRITICAL: The ER diagram must be the centerpiece. Use tables for schema definitions.`,

    components: `Generate a highly visual **Component Map** document. 

Include:
1. **Component Hierarchy** — Mermaid flowchart showing the tree of major components.
2. **Page Composition Map** — Table listing every page and its primary component set.
3. **Shared UI Library** — Visual gallery list of reusable components with props tables.
4. **State Flow Diagram** — Mermaid showing how props and context move between layers.
5. **Navigation Flow** — Mermaid diagram of the application's route structure.

CRITICAL: Use Mermaid trees for hierarchy and tables for component props.`,

    general: `Generate a visual **Product Overview** for stakeholders.

Include:
1. **Product Feature Map** — A clean table of all features, their status, and complexity.
2. **User Journey Flow** — Mermaid flowchart of the primary user "happy path".
3. **Persona Matrix** — Table comparing different user types and their access levels.
4. **Roadmap Timeline** — Mermaid Gantt or timeline showing current vs future work.
5. **Business Logic Flow** — Diagram of the core engine/logic rules.

CRITICAL: Keep it clean and use flowcharts to explain business processes.`,
  };

  const docTypeInfo = DOC_TYPES.find(d => d.id === docType) || DOC_TYPES[0];

  const systemPrompt = agentConfig?.systemInstructions
    ? `${agentConfig.systemInstructions}\n\nYou are an expert at creating visual technical documentation. You prioritize diagrams (Mermaid) and tables over long text paragraphs.`
    : 'You are a senior technical writer and solution architect specializing in visual documentation. Use diagrams, tables, and structured lists to make complex systems easy to understand.';

  const userMessage = `${typePrompts[docType] || typePrompts.general}

# Project Context
${contextBlock}

# Instructions
1. **Diagram First**: Every major section MUST include at least one Mermaid diagram or Markdown table.
2. **No Placeholders**: Reference the actual files, routes, and models from the Project Context above.
3. **Aesthetics**: Use Mermaid "dark" theme compatible syntax. Use flowcharts, sequence diagrams, and ER diagrams.
4. **Markdown Tables**: Use tables for lists of routes, fields, dependencies, or components.
5. **Structure**: Use clear ## and ### headers.
6. **Code Blocks**: Use language-specific code blocks (e.g. \`\`\`typescript\`) for code snippets.

Generate the complete document in markdown format.`;

  try {
    const client = createProjectClient(project);
    const model = project.aiModel || 'gpt-4o';

    // Models that don't support the 'system' role or behave differently with it.
    // For these, merge system instructions into the user message.
    const needsSystemMerge = /^(o1|o3|o4|gpt-5)/.test(model);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = needsSystemMerge
      ? [{ role: 'user', content: `${systemPrompt}\n\n---\n\n${userMessage}` }]
      : [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ];

    const completion = await safeCompletion(client, {
      model,
      messages,
      temperature: 0.3,
      max_completion_tokens: 16384,
    });

    const choice = completion.choices[0];
    const content = choice?.message?.content || '';
    const refusal = (choice?.message as any)?.refusal;

    if (!content) {
      const reason = refusal || choice?.finish_reason || 'unknown';
      console.error('[Documentation] Empty response from model:', model, 'finish_reason:', choice?.finish_reason, 'refusal:', refusal);
      return NextResponse.json({ error: `AI returned empty response (reason: ${reason}). Try a different model or reduce context.` }, { status: 500 });
    }

    // Check for existing doc of same type — update if exists
    const existing = await prisma.projectDocumentation.findFirst({
      where: { projectId, docType },
      orderBy: { version: 'desc' },
    });

    let doc;
    if (existing) {
      doc = await prisma.projectDocumentation.update({
        where: { id: existing.id },
        data: {
          content,
          version: existing.version + 1,
          agentId: agentId || null,
          status: 'generated',
          metadata: {
            model,
            tokensUsed: {
              prompt: completion.usage?.prompt_tokens || 0,
              completion: completion.usage?.completion_tokens || 0,
              total: completion.usage?.total_tokens || 0,
            },
            generatedAt: new Date().toISOString(),
          },
        },
      });
    } else {
      doc = await prisma.projectDocumentation.create({
        data: {
          projectId,
          title: `${docTypeInfo.label}`,
          content,
          docType,
          agentId: agentId || null,
          status: 'generated',
          metadata: {
            model,
            tokensUsed: {
              prompt: completion.usage?.prompt_tokens || 0,
              completion: completion.usage?.completion_tokens || 0,
              total: completion.usage?.total_tokens || 0,
            },
            generatedAt: new Date().toISOString(),
          },
        },
      });
    }

    return NextResponse.json({ doc });
  } catch (err: any) {
    console.error('[Documentation AI Error]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}

/**
 * DELETE /api/projects/[projectId]/documentation
 * Delete a documentation record
 */
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const docId = searchParams.get('docId');

  if (!docId) return NextResponse.json({ error: 'docId is required' }, { status: 400 });

  await prisma.projectDocumentation.deleteMany({
    where: { id: docId, projectId },
  });

  return NextResponse.json({ ok: true });
}
