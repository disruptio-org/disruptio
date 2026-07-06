import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import GitHubContent from '@/components/project/GitHubContent';

export const dynamic = 'force-dynamic';

export default async function GitHubPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      githubConnection: { include: { scans: true } },
      agents: { where: { enabled: true }, select: { id: true, name: true, agentType: true } },
      repositoryKnowledge: true,
    },
  });
  if (!project) notFound();
  return <GitHubContent project={project} />;
}
