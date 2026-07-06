import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import FormPage from '@/components/project/FormPage';

export const dynamic = 'force-dynamic';

export default async function UxUiGuidelinesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      guidelines: true,
      agents: { where: { enabled: true }, select: { id: true, name: true, agentType: true } },
      repositoryKnowledge: { select: { id: true } },
      githubConnection: { select: { id: true } },
    },
  });
  if (!project) notFound();
  const data = project.guidelines || {};
  return (
    <FormPage
      title="UX/UI GUIDELINES"
      subtitle="Define product behavior and interaction rules. Agents use these to validate designs."
      projectId={project.id}
      apiPath="guidelines"
      fields={[
        { key: 'uxPrinciples', label: 'UX PRINCIPLES', rows: 4 },
        { key: 'navigationPrinciples', label: 'NAVIGATION PRINCIPLES', rows: 3 },
        { key: 'formBehavior', label: 'FORM BEHAVIOR', rows: 3 },
        { key: 'emptyStateRules', label: 'EMPTY STATE RULES', rows: 2 },
        { key: 'loadingStateRules', label: 'LOADING STATE RULES', rows: 2 },
        { key: 'errorStateRules', label: 'ERROR STATE RULES', rows: 2 },
        { key: 'accessibilityRules', label: 'ACCESSIBILITY EXPECTATIONS', rows: 2 },
        { key: 'responsiveRules', label: 'RESPONSIVE BEHAVIOR', rows: 2 },
      ]}
      initialData={data}
      agents={project.agents}
      hasDeepScan={!!project.repositoryKnowledge?.id}
      hasGithub={!!project.githubConnection?.id}
    />
  );
}
