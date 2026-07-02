import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const personas = await prisma.projectPersona.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
  return NextResponse.json(personas);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await req.json();
  const persona = await prisma.projectPersona.create({ data: { projectId, ...body } });
  return NextResponse.json(persona, { status: 201 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const url = new URL(req.url);
  const personaId = url.searchParams.get('personaId');
  if (!personaId) return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  const body = await req.json();
  const persona = await prisma.projectPersona.update({ where: { id: personaId }, data: body });
  return NextResponse.json(persona);
}

export async function DELETE(req: NextRequest) {
  const url = new URL(req.url);
  const personaId = url.searchParams.get('personaId');
  if (!personaId) return NextResponse.json({ error: 'personaId required' }, { status: 400 });
  await prisma.projectPersona.delete({ where: { id: personaId } });
  return NextResponse.json({ ok: true });
}
