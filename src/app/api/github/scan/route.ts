import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { scanRepository } from '@/lib/github';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const token = cookieStore.get('github_access_token')?.value;

  if (!token) {
    return NextResponse.json({ error: 'GitHub not connected' }, { status: 401 });
  }

  const { connectionId, owner, repo, branch } = await req.json();

  if (!owner || !repo) {
    return NextResponse.json({ error: 'owner and repo are required' }, { status: 400 });
  }

  const targetBranch = branch || 'main';

  try {
    // Use Octokit-based scanner
    const scan = await scanRepository(token, owner, repo, targetBranch);

    // Find GitHub connection
    let githubConnection;
    if (connectionId) {
      githubConnection = await prisma.gitHubConnection.findUnique({ where: { id: connectionId } });
    } else {
      githubConnection = await prisma.gitHubConnection.findFirst({
        where: { owner, repository: repo },
      });
    }

    let scanRecord = null;
    if (githubConnection) {
      scanRecord = await prisma.gitHubRepositoryScan.create({
        data: {
          githubConnectionId: githubConnection.id,
          branch: targetBranch,
          detectedFrameworks: scan.detectedFrameworks,
          detectedLanguages: scan.languages,
          importantFiles: scan.importantFiles,
          fileTreeSummary: { summary: scan.fileTreeSummary, totalFiles: scan.metadata.totalFiles },
          readmeSummary: scan.readmeSummary,
          rawMetadata: scan.metadata,
        },
      });

      await prisma.gitHubConnection.update({
        where: { id: githubConnection.id },
        data: { lastScannedAt: new Date() },
      });
    }

    return NextResponse.json({
      scan: {
        languages: Object.keys(scan.languages).join(', '),
        frameworks: scan.detectedFrameworks,
        fileTreeSummary: scan.fileTreeSummary,
        importantFiles: scan.importantFiles,
        readmePreview: scan.readmeSummary.substring(0, 500),
        metadata: scan.metadata,
      },
      scanId: scanRecord?.id,
    });
  } catch (err: any) {
    console.error('GitHub scan error:', err);
    return NextResponse.json({ error: 'Failed to scan repository', detail: err.message }, { status: 500 });
  }
}
