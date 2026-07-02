import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { DEFAULT_AGENTS } from '@/lib/utils';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const member = await prisma.workspaceMember.findFirst({ where: { userId } });
  if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

  const projects = await prisma.project.findMany({
    where: { workspaceId: member.workspaceId },
    include: { githubConnection: true, agents: true },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userId = (session.user as any).id;
  const member = await prisma.workspaceMember.findFirst({ where: { userId } });
  if (!member) return NextResponse.json({ error: 'No workspace' }, { status: 404 });

  const body = await req.json();
  const { name, description, productType, businessGoal, targetUsers, currentStage, source, githubOwner, githubRepo, githubUrl, defaultBranch } = body;

  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 });

  const project = await prisma.project.create({
    data: {
      workspaceId: member.workspaceId,
      createdByUserId: userId,
      name: name.trim(),
      description: description || null,
      productType: productType || null,
      businessGoal: businessGoal || null,
      targetUsers: targetUsers || null,
      currentStage: currentStage || null,
      source: source || 'manual',
      agents: {
        create: DEFAULT_AGENTS.map(a => ({
          agentType: a.agentType,
          name: a.name,
          description: a.description,
          systemInstructions: a.systemInstructions,
          allowedContext: a.allowedContext,
          model: a.model,
          temperature: a.temperature,
          enabled: a.agentType === 'planning' ? false : true,
        })),
      },
      ...(source === 'github' && githubOwner && githubRepo ? {
        githubConnection: {
          create: {
            owner: githubOwner,
            repository: githubRepo,
            repositoryUrl: githubUrl || `https://github.com/${githubOwner}/${githubRepo}`,
            defaultBranch: defaultBranch || 'main',
          },
        },
      } : {}),
    },
  });

  return NextResponse.json(project, { status: 201 });
}
