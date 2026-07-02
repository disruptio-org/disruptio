import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { executeTool, getToolDefinitions } from '@/lib/agent/tool-registry';

// GET: List all available tools
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return NextResponse.json({
    tools: getToolDefinitions(),
    totalTools: getToolDefinitions().length,
  });
}

// POST: Execute a specific tool
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { tool, args } = await req.json();

  if (!tool) {
    return NextResponse.json({ error: 'tool name required' }, { status: 400 });
  }

  const result = await executeTool(tool, args || {});
  return NextResponse.json(result);
}
