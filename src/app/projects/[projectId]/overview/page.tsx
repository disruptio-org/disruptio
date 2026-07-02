import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import OverviewContent from '@/components/project/OverviewContent';

export default async function OverviewPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      githubConnection: { include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      agents: true,
      personas: true,
      guidelines: true,
      designStyle: true,
      technology: true,
    },
  });
  if (!project) notFound();
  return <OverviewContent project={project} />;
}
