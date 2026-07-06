import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deepScanRepository } from '@/lib/github';
import openai, { resolveModel } from '@/lib/openai';

// POST: Trigger a deep scan — reads the entire codebase and optionally runs an AI agent analysis
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const agentId = body.agentId || null;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { githubConnection: true },
  });

  if (!project?.githubConnection) {
    return NextResponse.json({ error: 'No GitHub connection' }, { status: 400 });
  }

  const conn = project.githubConnection;
  const branch = conn.defaultBranch || 'main';

  try {
    const knowledge = await deepScanRepository(token, conn.owner, conn.repository, branch);

    if (!knowledge) {
      return NextResponse.json({ error: 'Failed to deep scan repository' }, { status: 500 });
    }

    // Run AI agent analysis if an agent is selected
    let aiAnalysis: string | null = null;
    if (agentId && process.env.OPENAI_API_KEY) {
      try {
        // Load the selected agent
        const agent = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });

        // Build a comprehensive prompt with all scan data
        const fileList = knowledge.fileIndex
          .map((f: any) => `[${f.category}] ${f.path} (${f.size} bytes)`)
          .join('\n');

        const apiRouteSummary = knowledge.apiRoutes
          .map((r: any) => `${r.methods.join(',')} ${r.path} → ${r.file}`)
          .join('\n');

        const componentSummary = knowledge.components
          .map((c: any) => `${c.name} (${c.isClient ? 'client' : 'server'}) → ${c.file}${c.hasFetch ? ' [fetches data]' : ''}${c.hasState ? ' [stateful]' : ''}`)
          .join('\n');

        const modelSummary = Object.entries(knowledge.databaseModels)
          .map(([name, info]: [string, any]) => `${name}: ${info.fields.map((f: any) => `${f.name}:${f.type}`).join(', ')}`)
          .join('\n');

        // Include actual file contents for context
        const fileContentsSummary = Object.entries(knowledge.fileContents)
          .map(([path, content]) => `=== ${path} ===\n${content}`)
          .join('\n\n');

        const systemPrompt = agent?.systemInstructions
          ? `${agent.systemInstructions}\n\nYou are performing a deep architectural analysis of a codebase.`
          : 'You are a Solution Architect performing a deep architectural analysis of a codebase.';

        const userPrompt = `Analyze this entire codebase and produce a DETAILED architectural analysis. For EVERY file, explain its purpose, what it does, and how it relates to other files.

## Repository: ${conn.owner}/${conn.repository} (branch: ${branch})

## Architecture Overview
${knowledge.architectureSummary}

## Tech Stack
${knowledge.techStackSummary}

## Complete File Index (${knowledge.fileIndex.length} files)
${fileList}

## API Routes (${knowledge.apiRoutes.length} endpoints)
${apiRouteSummary || 'None detected'}

## Components (${knowledge.components.length})
${componentSummary || 'None detected'}

## Database Models
${modelSummary || 'None detected'}

## File Contents
${fileContentsSummary}

---

Produce a comprehensive analysis with these sections:

1. **ARCHITECTURE OVERVIEW**: High-level architecture pattern, data flow, and system design.

2. **FILE-BY-FILE ANALYSIS**: For EVERY source file, explain:
   - What it does
   - Which API endpoints it serves (if API route)
   - Which pages/screens it renders (if page/component)
   - What it imports/depends on
   - How it relates to other files
   
3. **API ENDPOINTS MAP**: List every API endpoint with method, path, handler file, and what it does.

4. **PAGE ROUTING MAP**: List every page route, its file, and the components it uses.

5. **DATA FLOW**: How data flows from DB → API → Frontend.

6. **DATABASE SCHEMA ANALYSIS**: Explain each model, its relationships, and purpose.

7. **DEPENDENCIES & INTEGRATIONS**: Third-party services, their purpose, and how they're configured.

8. **TECHNICAL DEBT & RECOMMENDATIONS**: Issues found, missing patterns, security concerns.

Be extremely detailed and specific. Reference actual file names, function names, and code patterns.`;

        const model = resolveModel(agent?.model || 'gpt-4');
        const completion = await openai.chat.completions.create({
          model,
          temperature: 0.2,
          max_completion_tokens: 8192,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
        });

        aiAnalysis = completion.choices[0]?.message?.content || null;
      } catch (aiErr: any) {
        console.error('[Deep Scan AI Analysis Error]', aiErr.message);
        // Don't fail the entire scan if AI analysis fails
      }
    }

    // Upsert the repository knowledge
    const stored = await prisma.repositoryKnowledge.upsert({
      where: { projectId },
      create: {
        projectId,
        architecture: knowledge.architecture,
        fileIndex: knowledge.fileIndex,
        dependencies: knowledge.dependencies,
        apiRoutes: knowledge.apiRoutes,
        components: knowledge.components,
        databaseModels: knowledge.databaseModels,
        configFiles: knowledge.configFiles,
        testStructure: knowledge.testStructure,
        fileContents: knowledge.fileContents,
        techStackSummary: knowledge.techStackSummary,
        architectureSummary: knowledge.architectureSummary,
        aiAnalysis: aiAnalysis || undefined,
      },
      update: {
        scanVersion: { increment: 1 },
        architecture: knowledge.architecture,
        fileIndex: knowledge.fileIndex,
        dependencies: knowledge.dependencies,
        apiRoutes: knowledge.apiRoutes,
        components: knowledge.components,
        databaseModels: knowledge.databaseModels,
        configFiles: knowledge.configFiles,
        testStructure: knowledge.testStructure,
        fileContents: knowledge.fileContents,
        techStackSummary: knowledge.techStackSummary,
        architectureSummary: knowledge.architectureSummary,
        aiAnalysis: aiAnalysis || undefined,
      },
    });

    // Update last scanned timestamp
    await prisma.gitHubConnection.update({
      where: { id: conn.id },
      data: { lastScannedAt: new Date() },
    });

    return NextResponse.json({
      id: stored.id,
      scanVersion: stored.scanVersion,
      architecture: knowledge.architecture,
      apiRouteCount: knowledge.apiRoutes.length,
      componentCount: knowledge.components.length,
      modelCount: Object.keys(knowledge.databaseModels).length,
      filesRead: Object.keys(knowledge.fileContents).length,
      techStackSummary: knowledge.techStackSummary,
      architectureSummary: knowledge.architectureSummary,
      aiAnalysis,
      agentUsed: agentId ? true : false,
    });
  } catch (err: any) {
    console.error('Deep scan error:', err);
    return NextResponse.json({ error: 'Deep scan failed', detail: err.message }, { status: 500 });
  }
}

// GET: Retrieve stored knowledge
export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const knowledge = await prisma.repositoryKnowledge.findUnique({
    where: { projectId },
  });

  if (!knowledge) {
    return NextResponse.json({ error: 'No deep scan performed yet' }, { status: 404 });
  }

  return NextResponse.json(knowledge);
}
