import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }) {
  const { storyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const allowed = ['persona', 'action', 'benefit', 'acceptanceCriteria', 'complexity', 'status', 'order'];
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const story = await prisma.userStory.update({ where: { id: storyId }, data });
  return NextResponse.json(story);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }) {
  const { storyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.userStory.delete({ where: { id: storyId } });
  return NextResponse.json({ ok: true });
}
