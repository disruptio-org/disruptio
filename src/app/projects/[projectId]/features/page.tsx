import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import FeaturesContent from '@/components/project/FeaturesContent';

export default async function FeaturesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      features: {
        include: { userStories: { orderBy: { order: 'asc' } } },
        orderBy: { order: 'asc' },
      },
      personas: { select: { name: true } },
    },
  });
  if (!project) notFound();
  return <FeaturesContent project={project} />;
}
