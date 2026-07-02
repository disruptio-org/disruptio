import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { featureId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const stories = await prisma.userStory.findMany({
    where: { featureId },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json(stories);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string; featureId: string }> }) {
  const { featureId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { persona, action, benefit, acceptanceCriteria, complexity } = await req.json();
  if (!persona?.trim() || !action?.trim() || !benefit?.trim()) {
    return NextResponse.json({ error: 'persona, action, and benefit are required' }, { status: 400 });
  }

  const count = await prisma.userStory.count({ where: { featureId } });

  const story = await prisma.userStory.create({
    data: {
      featureId,
      persona, action, benefit,
      acceptanceCriteria: acceptanceCriteria || [],
      complexity: complexity || 'medium',
      order: count,
    },
  });

  return NextResponse.json(story, { status: 201 });
}
