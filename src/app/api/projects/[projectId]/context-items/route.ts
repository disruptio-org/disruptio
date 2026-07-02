import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const items = await prisma.projectContextItem.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(items);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await req.json();
  const { type, title, content, source, metadata } = body;

  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and content are required' }, { status: 400 });
  }

  const item = await prisma.projectContextItem.create({
    data: {
      projectId,
      type: type || 'document',
      title: title.trim(),
      content: content.trim(),
      source: source || null,
      metadata: metadata || null,
    },
  });

  return NextResponse.json(item, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

  const body = await req.json();
  const allowed = ['type', 'title', 'content', 'source', 'metadata'];
  const data: Record<string, any> = {};
  for (const key of allowed) {
    if (body[key] !== undefined) data[key] = body[key];
  }

  const item = await prisma.projectContextItem.update({ where: { id: itemId }, data });
  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const itemId = url.searchParams.get('itemId');
  if (!itemId) return NextResponse.json({ error: 'itemId required' }, { status: 400 });

  await prisma.projectContextItem.delete({ where: { id: itemId } });
  return NextResponse.json({ ok: true });
}
