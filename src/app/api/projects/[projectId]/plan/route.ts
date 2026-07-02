import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';

// POST: Generate an implementation plan for a feature/user story
export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { feature, userStory, scope } = await req.json();

  if (!feature?.trim()) {
    return NextResponse.json({ error: 'Feature description required' }, { status: 400 });
  }

  // Load repository knowledge
  const knowledge = await prisma.repositoryKnowledge.findUnique({
    where: { projectId },
  });

  if (!knowledge) {
    return NextResponse.json({
      error: 'Deep scan required before planning. Run a deep scan first.',
      action: 'DEEP_SCAN_REQUIRED',
    }, { status: 400 });
  }

  // Load project context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: {
      personas: true,
      guidelines: true,
      technology: true,
      designStyle: true,
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const arch = knowledge.architecture as any;
  const apiRoutes = (knowledge.apiRoutes || []) as any[];
  const components = (knowledge.components || []) as any[];
  const dbModels = (knowledge.databaseModels || {}) as Record<string, any>;
  const deps = (knowledge.dependencies || {}) as any;
  const fileIndex = (knowledge.fileIndex || []) as any[];
  const fileContents = (knowledge.fileContents || {}) as Record<string, string>;
  const testStructure = (knowledge.testStructure || {}) as any;

  // Analyze the feature request against the codebase
  const featureLower = feature.toLowerCase();
  const storyLower = (userStory || '').toLowerCase();
  const combined = featureLower + ' ' + storyLower;

  // Identify affected layers
  const needsNewApiRoute = combined.includes('api') || combined.includes('endpoint') || combined.includes('backend') || combined.includes('crud');
  const needsNewComponent = combined.includes('ui') || combined.includes('page') || combined.includes('component') || combined.includes('button') || combined.includes('form') || combined.includes('dashboard');
  const needsDbChange = combined.includes('model') || combined.includes('database') || combined.includes('schema') || combined.includes('table') || combined.includes('field');
  const needsAuth = combined.includes('auth') || combined.includes('login') || combined.includes('permission') || combined.includes('role');
  const needsTest = true; // Always need tests

  // Find related existing files
  const keywords = combined.split(/\s+/).filter((w: string) => w.length > 3);
  const relatedFiles = fileIndex.filter((f: any) => {
    const pathLower = f.path.toLowerCase();
    return keywords.some((k: string) => pathLower.includes(k));
  });

  const relatedApiRoutes = apiRoutes.filter((r: any) => {
    const pathLower = r.path.toLowerCase();
    return keywords.some((k: string) => pathLower.includes(k));
  });

  const relatedComponents = components.filter((c: any) => {
    const nameLower = (c.name || '').toLowerCase();
    const fileLower = (c.file || '').toLowerCase();
    return keywords.some((k: string) => nameLower.includes(k) || fileLower.includes(k));
  });

  const relatedModels = Object.entries(dbModels).filter(([name]) => {
    const nameLower = name.toLowerCase();
    return keywords.some((k: string) => nameLower.includes(k));
  });

  // Generate subtasks
  const subtasks: {
    id: number;
    title: string;
    layer: 'backend' | 'frontend' | 'database' | 'testing' | 'config';
    type: 'create' | 'modify' | 'delete';
    files: string[];
    description: string;
    estimatedComplexity: 'low' | 'medium' | 'high';
    dependencies: number[];
  }[] = [];

  let taskId = 1;

  // Database layer
  if (needsDbChange) {
    subtasks.push({
      id: taskId++,
      title: 'Update Prisma schema',
      layer: 'database',
      type: 'modify',
      files: ['prisma/schema.prisma'],
      description: `Add or modify models related to: ${feature}. Current models: ${Object.keys(dbModels).join(', ')}. Run prisma db push after changes.`,
      estimatedComplexity: 'medium',
      dependencies: [],
    });
  }

  // Backend layer
  if (needsNewApiRoute) {
    const existingRoutes = relatedApiRoutes.map((r: any) => `${r.methods.join('/')} ${r.path}`).join(', ');

    subtasks.push({
      id: taskId++,
      title: 'Create/update API route',
      layer: 'backend',
      type: relatedApiRoutes.length > 0 ? 'modify' : 'create',
      files: relatedApiRoutes.length > 0
        ? relatedApiRoutes.map((r: any) => r.file)
        : [`src/app/api/${feature.toLowerCase().replace(/\s+/g, '-')}/route.ts`],
      description: relatedApiRoutes.length > 0
        ? `Modify existing routes: ${existingRoutes}. Add new handlers as needed.`
        : `Create new API route. Follow existing patterns in ${arch?.pattern || 'Next.js App Router'}. Import prisma from @/lib/prisma.`,
      estimatedComplexity: 'medium',
      dependencies: needsDbChange ? [1] : [],
    });
  }

  // If no explicit backend need but DB changes exist, still need route updates
  if (!needsNewApiRoute && needsDbChange) {
    subtasks.push({
      id: taskId++,
      title: 'Update existing API routes for new schema',
      layer: 'backend',
      type: 'modify',
      files: relatedApiRoutes.map((r: any) => r.file).slice(0, 5),
      description: 'Update Prisma queries and includes to use the new/modified models.',
      estimatedComplexity: 'low',
      dependencies: [1],
    });
  }

  // Frontend layer
  if (needsNewComponent) {
    const relatedCompNames = relatedComponents.map((c: any) => `${c.name} (${c.file})`).join(', ');

    // Page task
    subtasks.push({
      id: taskId++,
      title: 'Create/update page component',
      layer: 'frontend',
      type: relatedComponents.length > 0 ? 'modify' : 'create',
      files: relatedComponents.length > 0
        ? relatedComponents.map((c: any) => c.file)
        : [`src/app/${feature.toLowerCase().replace(/\s+/g, '-')}/page.tsx`],
      description: relatedComponents.length > 0
        ? `Modify existing components: ${relatedCompNames}. Follow existing Disruptio design system (ds-* classes, dark theme, #FF2A2A accent).`
        : `Create new page. Use 'use client' for interactivity. Follow Disruptio design: black bg, red accent, JetBrains Mono, ds-* CSS classes.`,
      estimatedComplexity: 'medium',
      dependencies: needsNewApiRoute ? [subtasks.find((s) => s.layer === 'backend')?.id || 0].filter(Boolean) : [],
    });

    // Component task (if complex)
    if (!relatedComponents.length) {
      subtasks.push({
        id: taskId++,
        title: 'Create reusable component',
        layer: 'frontend',
        type: 'create',
        files: [`src/components/${feature.toLowerCase().replace(/\s+/g, '-')}/${feature.replace(/\s+/g, '')}Content.tsx`],
        description: 'Create as a client component with state management. Use existing ds-card, ds-btn-primary, ds-label CSS classes.',
        estimatedComplexity: 'medium',
        dependencies: [taskId - 2],
      });
    }
  }

  // Auth layer
  if (needsAuth) {
    subtasks.push({
      id: taskId++,
      title: 'Add authentication/authorization',
      layer: 'backend',
      type: 'modify',
      files: ['src/lib/auth.ts', ...relatedApiRoutes.map((r: any) => r.file)],
      description: 'Add getServerSession checks to new routes. Follow existing auth pattern with next-auth.',
      estimatedComplexity: 'low',
      dependencies: [],
    });
  }

  // Testing layer
  if (needsTest) {
    subtasks.push({
      id: taskId++,
      title: 'Write unit/integration tests',
      layer: 'testing',
      type: 'create',
      files: [`__tests__/unit/${feature.toLowerCase().replace(/\s+/g, '-')}.test.ts`],
      description: `Write Vitest tests covering the new functionality. ${testStructure.hasVitest ? 'Vitest is configured.' : 'Set up Vitest first.'} Follow existing test patterns.`,
      estimatedComplexity: 'medium',
      dependencies: subtasks.filter((s) => s.layer !== 'testing').map((s) => s.id),
    });
  }

  // Build the implementation plan
  const plan = {
    feature,
    userStory: userStory || null,
    scope: scope || 'full-stack',
    timestamp: new Date().toISOString(),
    scanVersion: knowledge.scanVersion,

    // Architecture context
    architectureContext: {
      pattern: arch?.pattern,
      totalFiles: arch?.totalFiles,
      existingApiRoutes: apiRoutes.length,
      existingComponents: components.length,
      existingModels: Object.keys(dbModels).length,
      testFramework: testStructure.hasVitest ? 'Vitest' : testStructure.hasJest ? 'Jest' : 'None',
    },

    // Impact analysis
    impactAnalysis: {
      affectedLayers: [...new Set(subtasks.map((s) => s.layer))],
      existingFilesToModify: relatedFiles.filter((f: any) => f.category !== 'config').map((f: any) => f.path),
      newFilesToCreate: subtasks.filter((s) => s.type === 'create').flatMap((s) => s.files),
      relatedApiRoutes: relatedApiRoutes.map((r: any) => ({ path: r.path, methods: r.methods })),
      relatedComponents: relatedComponents.map((c: any) => ({ name: c.name, file: c.file, complexity: c.estimatedComplexity })),
      relatedDbModels: relatedModels.map(([name, info]) => ({ name, fieldCount: info.fieldCount })),
    },

    // Subtasks
    subtasks,
    totalSubtasks: subtasks.length,

    // Execution order
    executionOrder: subtasks
      .sort((a, b) => {
        const layerOrder: Record<string, number> = { database: 0, backend: 1, frontend: 2, config: 3, testing: 4 };
        return (layerOrder[a.layer] || 5) - (layerOrder[b.layer] || 5);
      })
      .map((s) => ({ id: s.id, title: s.title, layer: s.layer })),

    // Risk assessment
    risks: [
      ...(needsDbChange ? ['Schema changes require prisma db push and may affect existing data'] : []),
      ...(relatedApiRoutes.length > 3 ? ['Multiple API routes affected — high blast radius'] : []),
      ...(relatedComponents.length > 3 ? ['Many components affected — test UI regressions thoroughly'] : []),
      ...(!testStructure.hasVitest && !testStructure.hasJest ? ['No test framework — add testing infrastructure first'] : []),
    ],

    // File contents for reference (only related files)
    referenceCode: Object.fromEntries(
      relatedFiles
        .filter((f: any) => fileContents[f.path])
        .slice(0, 10)
        .map((f: any) => [f.path, fileContents[f.path]])
    ),
  };

  // Store as an agent run
  const architectAgent = await prisma.agentConfiguration.findFirst({
    where: { projectId, agentType: 'solution-architect' },
  });

  if (architectAgent) {
    await prisma.agentRun.create({
      data: {
        agentConfigurationId: architectAgent.id,
        status: 'completed',
        input: { type: 'implementation-plan', feature, userStory, scope },
        output: plan,
        startedAt: new Date(),
        completedAt: new Date(),
      },
    });
  }

  return NextResponse.json(plan);
}
