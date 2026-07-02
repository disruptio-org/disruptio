import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { projectId, featureId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['title', 'description', 'priority', 'status', 'order'];
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const feature = await prisma.feature.update({
    where: { id: featureId, projectId },
    data,
    include: { userStories: true },
  });

  return NextResponse.json(feature);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { projectId, featureId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.feature.delete({ where: { id: featureId, projectId } });
  return NextResponse.json({ ok: true });
}
