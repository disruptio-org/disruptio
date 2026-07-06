import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import DocumentationContent from '@/components/project/DocumentationContent';

export default async function DocumentationPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      agents: { select: { id: true, name: true, agentType: true } },
    },
  });
  if (!project) notFound();
  return <DocumentationContent project={project} />;
}
