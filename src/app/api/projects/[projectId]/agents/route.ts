import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const agents = await prisma.agentConfiguration.findMany({
    where: { projectId },
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  return NextResponse.json(agents);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentType, name, description, systemInstructions, allowedContext, model, temperature } = await req.json();

  if (!agentType?.trim() || !name?.trim()) {
    return NextResponse.json({ error: 'agentType and name are required' }, { status: 400 });
  }

  const agent = await prisma.agentConfiguration.create({
    data: {
      projectId,
      agentType: agentType.toLowerCase().replace(/\s+/g, '-'),
      name,
      description: description || '',
      systemInstructions: systemInstructions || '',
      allowedContext: allowedContext || [],
      model: model || 'gpt-4',
      temperature: temperature ?? 0.3,
      enabled: true,
    },
    include: { runs: true },
  });

  return NextResponse.json(agent, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  const body = await req.json();
  const agent = await prisma.agentConfiguration.update({ where: { id: agentId }, data: body });
  return NextResponse.json(agent);
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });

  await prisma.agentConfiguration.delete({ where: { id: agentId } });
  return NextResponse.json({ ok: true });
}
