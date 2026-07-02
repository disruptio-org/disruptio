import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import ProjectsDashboard from '@/components/projects/ProjectsDashboard';

export default async function ProjectsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');

  const userId = (session.user as any).id;
  const member = await prisma.workspaceMember.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  if (!member) redirect('/auth/login');

  const projects = await prisma.project.findMany({
    where: { workspaceId: member.workspaceId },
    include: {
      githubConnection: true,
      agents: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  return <ProjectsDashboard projects={projects} workspaceId={member.workspaceId} />;
}
