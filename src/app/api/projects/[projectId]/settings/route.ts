import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// GET: Load AI settings for the project
export async function GET(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      aiProvider: true,
      aiModel: true,
      aiApiKey: true,
      aiBaseUrl: true,
      aiTemperature: true,
    },
  });

  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Mask the API key for security
  const maskedKey = project.aiApiKey
    ? `${project.aiApiKey.slice(0, 4)}${'•'.repeat(Math.max(0, project.aiApiKey.length - 8))}${project.aiApiKey.slice(-4)}`
    : null;

  return NextResponse.json({
    aiProvider: project.aiProvider || 'openai',
    aiModel: project.aiModel || 'gpt-4',
    aiApiKey: maskedKey,
    hasApiKey: !!project.aiApiKey,
    aiBaseUrl: project.aiBaseUrl || '',
    aiTemperature: project.aiTemperature ?? 0.3,
  });
}

// PUT: Update AI settings
export async function PUT(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json();
  const { aiProvider, aiModel, aiApiKey, aiBaseUrl, aiTemperature } = body;

  const updateData: any = {};
  if (aiProvider !== undefined) updateData.aiProvider = aiProvider;
  if (aiModel !== undefined) updateData.aiModel = aiModel;
  if (aiBaseUrl !== undefined) updateData.aiBaseUrl = aiBaseUrl || null;
  if (aiTemperature !== undefined) updateData.aiTemperature = parseFloat(aiTemperature);

  // Only update API key if a new one is provided (not masked)
  if (aiApiKey !== undefined && !aiApiKey.includes('•')) {
    updateData.aiApiKey = aiApiKey || null;
  }

  await prisma.project.update({
    where: { id: projectId },
    data: updateData,
  });

  return NextResponse.json({ ok: true });
}

// DELETE: Remove the API key
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await prisma.project.update({
    where: { id: projectId },
    data: { aiApiKey: null },
  });

  return NextResponse.json({ ok: true });
}
