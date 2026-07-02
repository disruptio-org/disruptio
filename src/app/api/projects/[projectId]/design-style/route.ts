import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const body = await req.json();
  const result = await prisma.projectDesignStyle.upsert({
    where: { projectId },
    update: body,
    create: { projectId, ...body },
  });
  return NextResponse.json(result);
}
