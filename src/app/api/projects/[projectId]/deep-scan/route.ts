import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { deepScanRepository } from '@/lib/github';

// POST: Trigger a deep scan — the Solution Architect reads and memorizes the entire codebase
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
