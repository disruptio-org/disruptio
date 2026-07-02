import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      githubConnection: { include: { scans: { orderBy: { createdAt: 'desc' as const }, take: 3 } } },
      agents: { include: { runs: { orderBy: { createdAt: 'desc' as const }, take: 5 } } },
      personas: true,
      guidelines: true,
      technology: true,
      designStyle: true,
      contextItems: { orderBy: { createdAt: 'desc' as const } },
      repositoryKnowledge: {
        select: {
          id: true, scanVersion: true, architecture: true, apiRoutes: true,
          components: true, databaseModels: true, techStackSummary: true,
          architectureSummary: true, createdAt: true, updatedAt: true,
        },
      },
    },
  });
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await req.json();

  // Handle GitHub disconnect
  if (body.disconnectGithub) {
    await prisma.gitHubConnection.deleteMany({ where: { projectId } });
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    return NextResponse.json(project);
  }

  // Whitelist allowed project fields
  const allowed = ['name', 'description', 'productType', 'businessGoal', 'targetUsers', 'currentStage', 'source', 'status'];
  const data: Record<string, string> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const project = await prisma.project.update({ where: { id: projectId }, data });
  return NextResponse.json(project);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  await prisma.project.delete({ where: { id: projectId } });
  return NextResponse.json({ ok: true });
}
