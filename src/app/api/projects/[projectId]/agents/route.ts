import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const agents = await prisma.agentConfiguration.findMany({
    where: { projectId },
    include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } },
  });
  return NextResponse.json(agents);
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const agentId = url.searchParams.get('agentId');
  if (!agentId) return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  const body = await req.json();
  const agent = await prisma.agentConfiguration.update({ where: { id: agentId }, data: body });
  return NextResponse.json(agent);
}
