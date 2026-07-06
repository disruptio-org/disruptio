import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ContextEditor from '@/components/project/ContextEditor';

export default async function ContextPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      agents: { where: { enabled: true }, select: { id: true, name: true, agentType: true } },
      repositoryKnowledge: { select: { id: true, architectureSummary: true } },
      githubConnection: { select: { id: true, repository: true, owner: true } },
    },
  });
  if (!project) notFound();
  return <ContextEditor project={project} />;
}
