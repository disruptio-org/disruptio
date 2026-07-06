import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectClient, safeCompletion } from '@/lib/openai';

const DOC_TYPES = [
  { id: 'architecture', label: 'Architecture Overview', emoji: '🏗️' },
  { id: 'api', label: 'API Reference & Workflows', emoji: '🔌' },
  { id: 'data-flow', label: 'Data Flow & Models', emoji: '📊' },
  { id: 'components', label: 'Component Map', emoji: '🧩' },
  { id: 'general', label: 'Product Overview', emoji: '📋' },
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
    if (tech.hosting) contextBlock += `- Hosting: ${tech.hosting}\n`;
    if (tech.authentication) contextBlock += `- Auth: ${tech.authentication}\n`;
    if (tech.additionalTools) contextBlock += `- Tools: ${tech.additionalTools}\n`;
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
      contextBlock += `### ${item.category}\n${item.content}\n\n`;
    }
  }

  // Build prompts per doc type
  const typePrompts: Record<string, string> = {
    architecture: `Generate a comprehensive **Architecture Overview** document for this project. Include:
1. **System Architecture** — High-level architecture pattern, layers, and component interaction
2. **Technology Stack** — Detailed breakdown of all technologies used and why
3. **Directory Structure** — Explain the folder organization and conventions
4. **Key Design Decisions** — Patterns used (e.g., server components, API routes, auth strategy)
5. **Deployment Architecture** — How the system is deployed and scales
6. **Security Architecture** — Authentication flow, authorization, data protection

Use markdown headers, bullet points, and mermaid diagrams where helpful.`,

    api: `Generate a comprehensive **API Reference & Workflow** document for this project. Include:
1. **API Overview** — Base URL structure, authentication, common patterns
2. **Endpoint Reference** — For each API route, document: method, path, request body, response, purpose
3. **Authentication Flow** — How users authenticate and maintain sessions
4. **Data Flow Diagrams** — Show how data moves through the API for key operations
5. **Error Handling** — Common error codes and response formats
6. **Webhook/Event Patterns** — If applicable

Format each endpoint clearly with method, path, description, and example payloads.`,

    'data-flow': `Generate a comprehensive **Data Flow & Models** document for this project. Include:
1. **Data Model Overview** — Entity relationship diagram in mermaid
2. **Model Definitions** — Each database model with fields, types, and relationships
3. **Data Flow** — How data moves from user input → API → database → response
4. **State Management** — Client-side state, caching strategies
5. **Data Validation** — Where and how data is validated
6. **Migration Strategy** — How schema changes are managed

Use mermaid ER diagrams and flow charts.`,

    components: `Generate a comprehensive **Component Map** document for this project. Include:
1. **Component Hierarchy** — Tree of all major UI components
2. **Page Structure** — Each page and its component composition
3. **Shared Components** — Reusable components and their props
4. **State Flow** — How state flows between components
5. **Styling System** — CSS/design system conventions
6. **Navigation** — Route structure and navigation patterns

Use mermaid diagrams for component trees and page flows.`,

    general: `Generate a comprehensive **Product Overview** document for this project. Include:
1. **Product Vision** — What the product does and who it's for
2. **User Personas** — Key user types and their goals
3. **Feature Map** — All features with descriptions and status
4. **User Journeys** — Key workflows from the user's perspective
5. **Business Logic** — Core rules and processes
6. **Roadmap** — Current status and planned improvements

Keep it business-focused and accessible to non-technical stakeholders.`,
  };

  const docTypeInfo = DOC_TYPES.find(d => d.id === docType) || DOC_TYPES[0];

  const systemPrompt = agentConfig?.systemInstructions
    ? `${agentConfig.systemInstructions}\n\nYou are now generating documentation. Follow the instructions below.`
    : 'You are a senior technical writer and solution architect. Generate clear, comprehensive, well-structured documentation.';

  const userMessage = `${typePrompts[docType] || typePrompts.general}

# Project Context
${contextBlock}

Generate the complete document in markdown format. Use proper headers (##, ###), bullet points, code blocks, and mermaid diagrams where appropriate. Be specific — reference actual file names, models, routes, and components from the project context. Do not use placeholders.`;

  try {
    const client = createProjectClient(project);
    const model = project.aiModel || 'gpt-4o';

    // Reasoning models (o1, o3, o4) don't support the 'system' role.
    // For those models, merge system instructions into the user message.
    const isReasoningModel = /^(o1|o3|o4)/.test(model);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = isReasoningModel
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
          title: `${docTypeInfo.emoji} ${docTypeInfo.label}`,
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
