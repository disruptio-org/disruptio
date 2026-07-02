import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import PersonasContent from '@/components/project/PersonasContent';

export default async function PersonasPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { personas: { orderBy: { createdAt: 'desc' } } } });
  if (!project) notFound();
  return <PersonasContent project={project} />;
}
