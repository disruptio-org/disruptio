import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const { agentId } = await req.json();

  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const agent = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });
  if (!agent || agent.projectId !== projectId) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  // Fetch full project context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      personas: true,
      guidelines: true,
      technology: true,
      designStyle: true,
      githubConnection: { include: { scans: { orderBy: { createdAt: 'desc' }, take: 1 } } },
      contextItems: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  // Build context summary
  const contextSummary = {
    hasDescription: !!project.description,
    hasBusinessGoal: !!project.businessGoal,
    personaCount: project.personas.length,
    hasGuidelines: !!project.guidelines,
    hasTechnology: !!project.technology,
    hasDesignStyle: !!project.designStyle,
    hasGithubConnection: !!project.githubConnection,
    hasGithubScan: !!(project.githubConnection?.scans?.length),
    contextItemCount: project.contextItems.length,
  };

  // Compute completeness
  const totalChecks = 8;
  const passedChecks = [
    contextSummary.hasDescription,
    contextSummary.hasBusinessGoal,
    contextSummary.personaCount > 0,
    contextSummary.hasGuidelines,
    contextSummary.hasTechnology,
    contextSummary.hasDesignStyle,
    contextSummary.hasGithubConnection,
    contextSummary.contextItemCount > 0,
  ].filter(Boolean).length;

  const completeness = Math.round((passedChecks / totalChecks) * 100);

  // Generate diagnostic output based on agent type
  let diagnosticOutput: Record<string, any> = {};
  let diagnosticStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
  const issues: string[] = [];
  const recommendations: string[] = [];

  switch (agent.agentType) {
    case 'solution-architect': {
      // Solution Architect: Product Context + Tech Views + GitHub scan
      if (!contextSummary.hasDescription) issues.push('Missing project description — cannot derive system boundaries');
      if (!contextSummary.hasBusinessGoal) issues.push('Missing business goal — architecture cannot be aligned to outcomes');
      if (!contextSummary.hasTechnology) issues.push('No technology decisions documented — cannot evaluate feasibility');
      if (!contextSummary.hasGithubConnection) recommendations.push('Connect GitHub repository for code structure analysis');
      if (!contextSummary.hasGithubScan) recommendations.push('Run repository scan to detect frameworks and dependencies');

      const techFields = project.technology;
      const techCoverage = techFields ? Object.values(techFields).filter(v => v && typeof v === 'string' && v.trim()).length - 4 : 0; // subtract id, projectId, createdAt, updatedAt

      diagnosticOutput = {
        title: 'Architecture Diagnostic',
        feasibilityIndex: `${completeness}%`,
        architectureReadiness: completeness >= 60 ? 'READY' : completeness >= 30 ? 'PARTIAL' : 'INSUFFICIENT',
        contextCoverage: {
          productContext: contextSummary.hasDescription && contextSummary.hasBusinessGoal ? 'COMPLETE' : 'INCOMPLETE',
          technologyView: techCoverage >= 5 ? 'COMPLETE' : techCoverage >= 2 ? 'PARTIAL' : 'MISSING',
          githubIntegration: contextSummary.hasGithubScan ? 'SCANNED' : contextSummary.hasGithubConnection ? 'CONNECTED' : 'NOT CONNECTED',
        },
        frameworkRisks: !contextSummary.hasTechnology ? ['No tech stack defined — high risk of misalignment'] : [],
        missingInfrastructure: [
          ...(!contextSummary.hasTechnology ? ['Technology decisions not documented'] : []),
          ...(!contextSummary.hasGithubConnection ? ['No repository connected'] : []),
        ],
      };
      break;
    }

    case 'design': {
      // Design Agent: Personas + Guidelines + Brand Style
      if (contextSummary.personaCount === 0) issues.push('No personas defined — cannot validate UI against user needs');
      if (!contextSummary.hasGuidelines) issues.push('No UX/UI guidelines — cannot enforce interaction standards');
      if (!contextSummary.hasDesignStyle) issues.push('No design style — cannot evaluate visual consistency');

      diagnosticOutput = {
        title: 'Design System Diagnostic',
        designReadiness: completeness >= 50 ? 'READY' : 'INSUFFICIENT',
        contextCoverage: {
          personas: contextSummary.personaCount > 0 ? `${contextSummary.personaCount} defined` : 'NONE',
          guidelines: contextSummary.hasGuidelines ? 'DEFINED' : 'MISSING',
          designStyle: contextSummary.hasDesignStyle ? 'DEFINED' : 'MISSING',
        },
        screenStructureReady: contextSummary.hasGuidelines && contextSummary.hasDesignStyle,
        responsiveBlueprint: contextSummary.hasGuidelines ? 'CAN GENERATE' : 'BLOCKED — needs guidelines',
        styleDiscrepancies: !contextSummary.hasDesignStyle ? ['No design style to check against'] : [],
        recommendedComponents: contextSummary.hasDesignStyle ? ['Review component style rules for consistency'] : ['Define design style first'],
      };
      break;
    }

    case 'planning': {
      // Planning Agent: Business Goals + Product Context + Personas
      if (!contextSummary.hasBusinessGoal) issues.push('No business goal — cannot derive epic structure');
      if (!contextSummary.hasDescription) issues.push('No product description — cannot scope work items');
      if (contextSummary.personaCount === 0) issues.push('No personas — cannot write user stories');

      diagnosticOutput = {
        title: 'Planning Diagnostic',
        planningReadiness: contextSummary.hasBusinessGoal && contextSummary.hasDescription ? 'READY' : 'INSUFFICIENT',
        contextCoverage: {
          businessGoal: contextSummary.hasBusinessGoal ? 'DEFINED' : 'MISSING',
          productContext: contextSummary.hasDescription ? 'DEFINED' : 'MISSING',
          personas: contextSummary.personaCount > 0 ? `${contextSummary.personaCount} defined` : 'NONE',
        },
        epicGeneration: contextSummary.hasBusinessGoal ? 'CAN GENERATE' : 'BLOCKED',
        storyGeneration: contextSummary.personaCount > 0 ? 'CAN GENERATE' : 'BLOCKED — needs personas',
        dependencyMapping: contextSummary.hasTechnology ? 'AVAILABLE' : 'LIMITED — no tech context',
        milestonePlanning: contextSummary.hasBusinessGoal && contextSummary.personaCount > 0 ? 'READY' : 'BLOCKED',
      };
      break;
    }

    case 'qa-test': {
      // QA/Test Agent: Guidelines + Personas + Tech choices
      if (!contextSummary.hasGuidelines) issues.push('No UX/UI guidelines — cannot derive acceptance criteria for UI behavior');
      if (contextSummary.personaCount === 0) issues.push('No personas — cannot write user-centric test scenarios');
      if (!contextSummary.hasTechnology) issues.push('No technology view — cannot plan integration tests');

      diagnosticOutput = {
        title: 'QA/Test Diagnostic',
        testReadiness: completeness >= 40 ? 'READY' : 'INSUFFICIENT',
        contextCoverage: {
          guidelines: contextSummary.hasGuidelines ? 'DEFINED' : 'MISSING',
          personas: contextSummary.personaCount > 0 ? `${contextSummary.personaCount} defined` : 'NONE',
          technology: contextSummary.hasTechnology ? 'DEFINED' : 'MISSING',
        },
        acceptanceCriteria: contextSummary.hasGuidelines && contextSummary.personaCount > 0 ? 'CAN GENERATE' : 'BLOCKED',
        integrationTestPlan: contextSummary.hasTechnology ? 'CAN GENERATE' : 'BLOCKED — needs tech view',
        uiErrorBoundaries: contextSummary.hasGuidelines ? 'CAN DERIVE' : 'BLOCKED — needs guidelines',
        securityRegression: contextSummary.hasTechnology ? 'CAN ANALYZE' : 'BLOCKED — needs tech view',
      };
      break;
    }

    default:
      diagnosticOutput = { title: 'Unknown Agent Type', error: `No diagnostic defined for agent type: ${agent.agentType}` };
  }

  // Determine status
  if (issues.length >= 3) diagnosticStatus = 'critical';
  else if (issues.length >= 1) diagnosticStatus = 'warning';
  else diagnosticStatus = 'healthy';

  // Store the run result
  const run = await prisma.agentRun.create({
    data: {
      agentConfigurationId: agentId,
      status: 'completed',
      input: { type: 'diagnostic', contextSummary },
      output: { diagnosticOutput, issues, recommendations, completeness, status: diagnosticStatus },
      startedAt: new Date(),
      completedAt: new Date(),
    },
  });

  return NextResponse.json({
    runId: run.id,
    status: diagnosticStatus,
    completeness,
    issues,
    recommendations,
    diagnostic: diagnosticOutput,
  });
}
