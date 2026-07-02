import prisma from '@/lib/prisma';
import { notFound } from 'next/navigation';
import FormPage from '@/components/project/FormPage';

export default async function DesignStylePage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await prisma.project.findUnique({ where: { id: projectId }, include: { designStyle: true } });
  if (!project) notFound();
  const data = project.designStyle || {};
  return (
    <FormPage
      title="DESIGN STYLE"
      subtitle="Define the visual system. Agents enforce these constraints on screen specifications."
      projectId={project.id}
      apiPath="design-style"
      fields={[
        { key: 'brandPersonality', label: 'BRAND PERSONALITY', rows: 3 },
        { key: 'colorPalette', label: 'COLOR PALETTE', rows: 3 },
        { key: 'typography', label: 'TYPOGRAPHY', rows: 2 },
        { key: 'spacing', label: 'SPACING STYLE', rows: 2 },
        { key: 'componentStyle', label: 'COMPONENT STYLE', rows: 3 },
        { key: 'iconography', label: 'ICONOGRAPHY', rows: 2 },
        { key: 'tone', label: 'TONE OF INTERFACE', rows: 2 },
        { key: 'dos', label: 'DO RULES', rows: 3 },
        { key: 'donts', label: 'DON\'T RULES', rows: 3 },
      ]}
      initialData={data}
    />
  );
}
