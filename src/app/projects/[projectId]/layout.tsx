import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import prisma from '@/lib/prisma';
import ProjectShell from '@/components/project/ProjectShell';

export default async function ProjectLayout({ children, params }: { children: React.ReactNode; params: Promise<{ projectId: string }> }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/auth/login');

  const { projectId } = await params;

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { githubConnection: true },
  });

  if (!project) notFound();

  return (
    <ProjectShell project={project}>
      {children}
    </ProjectShell>
  );
}
