import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { runAgent } from '@/lib/agent-runner';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId, message } = await req.json();

  if (!agentId || !message?.trim()) {
    return NextResponse.json({ error: 'agentId and message are required' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  try {
    const result = await runAgent(agentId, message);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[Agent Run Error]', err);
    return NextResponse.json(
      { error: err.message || 'Agent execution failed' },
      { status: 500 }
    );
  }
}
