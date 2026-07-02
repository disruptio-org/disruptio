import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import FormPage from '@/components/project/FormPage';

export default async function TechnologyPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { technology: true } });
  if (!project) notFound();
  const data = project.technology || {};
  return (
    <FormPage
      title="TECHNOLOGY VIEW"
      subtitle="Capture architecture decisions. Agents use this to align recommendations."
      projectId={project.id}
      apiPath="technology"
      fields={[
        { key: 'frontend', label: 'FRONTEND', rows: 2 },
        { key: 'backend', label: 'BACKEND', rows: 2 },
        { key: 'database', label: 'DATABASE', rows: 2 },
        { key: 'authentication', label: 'AUTHENTICATION', rows: 2 },
        { key: 'aiLayer', label: 'AI LAYER', rows: 2 },
        { key: 'githubIntegration', label: 'GITHUB INTEGRATION', rows: 2 },
        { key: 'deployment', label: 'DEPLOYMENT', rows: 2 },
        { key: 'testing', label: 'TESTING', rows: 2 },
        { key: 'security', label: 'SECURITY', rows: 2 },
        { key: 'decisions', label: 'KNOWN TECHNICAL DECISIONS', rows: 4 },
        { key: 'openQuestions', label: 'OPEN QUESTIONS', rows: 3 },
      ]}
      initialData={data}
    />
  );
}
