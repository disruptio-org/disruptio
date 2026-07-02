import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import AgentsContent from '@/components/project/AgentsContent';

export default async function AgentsPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { agents: { include: { runs: { orderBy: { createdAt: 'desc' }, take: 5 } } } },
  });
  if (!project) notFound();
  return <AgentsContent project={project} />;
}
