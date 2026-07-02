import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import ContextEditor from '@/components/project/ContextEditor';

export default async function ContextPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId } });
  if (!project) notFound();
  return <ContextEditor project={project} />;
}
