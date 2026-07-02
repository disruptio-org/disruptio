import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const features = await prisma.feature.findMany({
    where: { projectId },
    include: { userStories: { orderBy: { order: 'asc' } } },
    orderBy: { order: 'asc' },
  });

  return NextResponse.json(features);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { title, description, priority } = await req.json();
  if (!title?.trim()) return NextResponse.json({ error: 'Title required' }, { status: 400 });

  const count = await prisma.feature.count({ where: { projectId } });

  const feature = await prisma.feature.create({
    data: { projectId, title, description, priority: priority || 'medium', order: count },
    include: { userStories: true },
  });

  return NextResponse.json(feature, { status: 201 });
}
