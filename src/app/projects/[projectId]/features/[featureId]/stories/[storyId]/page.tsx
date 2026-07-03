import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import UserStoryDetail from '@/components/project/UserStoryDetail';

export default async function UserStoryPage({ params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }) {
  const { projectId, featureId, storyId } = await params;

  const story = await prisma.userStory.findUnique({
    where: { id: storyId },
    include: {
      feature: {
        select: { id: true, title: true, status: true, priority: true },
      },
    },
  });

  if (!story || story.featureId !== featureId) notFound();

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, personas: { select: { name: true, role: true } } },
  });

  if (!project) notFound();

  return (
    <UserStoryDetail
      story={JSON.parse(JSON.stringify(story))}
      project={JSON.parse(JSON.stringify(project))}
    />
  );
}
