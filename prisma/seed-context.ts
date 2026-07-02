import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find the project
  const project = await prisma.project.findFirst({
    where: { name: 'disruptio' },
    include: { guidelines: true, technology: true, designStyle: true, personas: true },
  });

  if (!project) {
    console.error('Project "disruptio" not found');
    process.exit(1);
  }

  console.log(`Found project: ${project.id} (${project.name})`);

  // 1. Update project core fields
  await prisma.project.update({
    where: { id: project.id },
    data: {
      description: 'Disruptio is an AI-driven product delivery platform that turns product chaos into executable software intelligence. It captures product context (goals, personas, guidelines, design style, technology decisions) and connects to GitHub repositories to give specialized AI agents deep codebase understanding — enabling them to generate implementation plans, architecture diagnostics, and feature breakdowns with file-level precision.',
      productType: 'B2B SaaS Platform',
      businessGoal: 'Replace vibe-coded prototypes with structured, agent-assisted software delivery. Enable product teams to define intent once and have AI agents translate it into architecture decisions, implementation plans, and acceptance criteria — eliminating the gap between product vision and engineering execution.',
      targetUsers: 'Technical founders, product managers, and engineering leads who need to translate product requirements into structured implementation plans without losing context between ideation and development.',
      currentStage: 'MVP — Core platform with project context capture, GitHub integration, agent diagnostics, deep scan, and implementation planning operational.',
    },
  });
  console.log('✓ Project core fields updated');

  // 2. Create/update guidelines
  await prisma.projectGuidelines.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      uxPrinciples: 'Context-first: every screen serves a single context module. No multi-purpose views. Structured data entry with immediate visual feedback. Agent outputs are primary — human inputs are configuration.',
      navigationPrinciples: 'Persistent sidebar with project-scoped navigation. Overview → Context Modules → GitHub → Agents. No breadcrumbs — the sidebar IS the navigation. Active state is red underline.',
      formBehavior: 'Auto-save on blur. No submit buttons for text fields. Textarea for long-form content. Inline validation with red border on error. Disabled states are visually distinct (opacity 0.4).',
      emptyStateRules: 'Every empty state has: 1) A clear statement of what is missing. 2) A primary action button to fill it. 3) Contextual hint text explaining why this matters. No illustrations or decorative elements.',
      loadingStateRules: 'Skeleton screens for page loads. Inline "[ LOADING... ]" text for async operations. Button text changes during operations (e.g., "SCANNING..." → "RESCAN REPOSITORY"). No spinners.',
      errorStateRules: 'Red border on affected element. Error message below the element in #FF2A2A. API errors show user-friendly messages, never stack traces. Network errors show retry button.',
      permissionBehavior: 'Session-based auth via NextAuth. GitHub OAuth with full repository permissions. No role-based access in MVP — single admin user per workspace.',
      accessibilityRules: 'Minimum contrast ratio 4.5:1 for body text. All interactive elements keyboard-navigable. Focus states visible. ARIA labels on icon-only buttons.',
      responsiveRules: 'Desktop-first. Sidebar collapses on screens < 1024px. Minimum supported width: 768px. No mobile-specific layouts in MVP.',
    },
    update: {
      uxPrinciples: 'Context-first: every screen serves a single context module. No multi-purpose views. Structured data entry with immediate visual feedback. Agent outputs are primary — human inputs are configuration.',
      navigationPrinciples: 'Persistent sidebar with project-scoped navigation. Overview → Context Modules → GitHub → Agents. No breadcrumbs — the sidebar IS the navigation. Active state is red underline.',
      formBehavior: 'Auto-save on blur. No submit buttons for text fields. Textarea for long-form content. Inline validation with red border on error. Disabled states are visually distinct (opacity 0.4).',
      emptyStateRules: 'Every empty state has: 1) A clear statement of what is missing. 2) A primary action button to fill it. 3) Contextual hint text explaining why this matters.',
      loadingStateRules: 'Skeleton screens for page loads. Inline "[ LOADING... ]" text for async operations. Button text changes during operations. No spinners.',
      errorStateRules: 'Red border on affected element. Error message below in #FF2A2A. API errors show user-friendly messages, never stack traces.',
      permissionBehavior: 'Session-based auth via NextAuth. GitHub OAuth with full repository permissions.',
      accessibilityRules: 'Minimum contrast ratio 4.5:1 for body text. All interactive elements keyboard-navigable.',
      responsiveRules: 'Desktop-first. Sidebar collapses < 1024px. Minimum supported width: 768px.',
    },
  });
  console.log('✓ Guidelines created');

  // 3. Create/update technology view
  await prisma.projectTechnology.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      frontend: 'Next.js 16 (App Router, Turbopack), React 19, Vanilla CSS with custom design system (ds-* classes). Client components for interactivity, server components for data fetching.',
      backend: 'Next.js API Routes (Route Handlers). RESTful design. Prisma ORM for database access. Server-side session management via NextAuth.',
      database: 'PostgreSQL 16 (Docker). Prisma 6 ORM with 14 models. Schema-first approach. Json? fields for flexible agent data storage.',
      authentication: 'NextAuth v4 with credentials provider (email/password). GitHub OAuth for repository access (separate flow via custom authorize/callback routes). HttpOnly cookies for token storage.',
      aiLayer: 'Agent harness with 4 specialized agents (Solution Architect, Design, Planning, QA/Test). Diagnostic dry-runs evaluate context completeness. Deep scan builds RepositoryKnowledge for implementation planning. Tool registry with 6 sandboxed tools.',
      githubIntegration: 'Octokit SDK (@octokit/rest). Full OAuth flow with admin:org, repo, workflow scopes. Deep scan reads file contents (batched, rate-limit aware). Scan results stored as native JSON in PostgreSQL.',
      deployment: 'Docker Compose for local PostgreSQL. Docker sandbox container for agent execution. Development on localhost:8000.',
      testing: 'Vitest for unit tests. Husky pre-commit hooks (secret scan, type-check, test suite). Eval framework with datasets and rubrics.',
      security: 'Non-root Docker containers. Explicit tool registry (no free-form script execution). Pre-commit secret scanning. Whitelisted API inputs.',
      decisions: 'Vanilla CSS over Tailwind (control + brand consistency). PostgreSQL over SQLite (Json? support, production readiness). Octokit over raw fetch (type safety, pagination). Vitest over Jest (speed, ESM native).',
      openQuestions: 'LLM provider selection for agent execution. Rate limiting strategy for GitHub API. Multi-user workspace support. CI/CD pipeline configuration.',
    },
    update: {
      frontend: 'Next.js 16 (App Router, Turbopack), React 19, Vanilla CSS with custom design system (ds-* classes).',
      backend: 'Next.js API Routes (Route Handlers). RESTful design. Prisma ORM for database access.',
      database: 'PostgreSQL 16 (Docker). Prisma 6 ORM with 14 models. Json? fields for flexible agent data.',
      authentication: 'NextAuth v4 credentials + GitHub OAuth. HttpOnly cookies for token storage.',
      aiLayer: 'Agent harness with 4 agents. Diagnostic dry-runs. Deep scan. Tool registry.',
      githubIntegration: 'Octokit SDK. Full OAuth. Deep scan reads file contents. Native JSON storage.',
      deployment: 'Docker Compose. Development on localhost:8000.',
      testing: 'Vitest. Husky pre-commit. Eval framework.',
      security: 'Non-root Docker. Explicit tool registry. Pre-commit secret scanning.',
      decisions: 'Vanilla CSS over Tailwind. PostgreSQL over SQLite. Octokit over raw fetch. Vitest over Jest.',
      openQuestions: 'LLM provider. Rate limiting. Multi-user support. CI/CD pipeline.',
    },
  });
  console.log('✓ Technology view created');

  // 4. Create/update design style
  await prisma.projectDesignStyle.upsert({
    where: { projectId: project.id },
    create: {
      projectId: project.id,
      brandPersonality: 'Dark, calm, high-confidence, minimal. Disruptio is the surgical instrument, not the finger paint. The interface communicates precision and intelligence — never playfulness or friendliness.',
      colorPalette: 'Background: #000000, #0A0A0A. Surface: #0D0D0D, #121212, #1A1A1A. Border: #1F1F1F, #2A2A2A. Text primary: #FFFFFF. Text secondary: #B3B3B3. Text muted: #6A6A6A, #5A5A5A. Accent: #FF2A2A (Disruptio Red). Success: #2ECC71. Warning: #F39C12. Error: #FF2A2A. BANNED: #3B82F6 (generic blue), any pastel, any gradient.',
      typography: 'System sans-serif for body text. JetBrains Mono for code, badges, technical data, and agent output. Font sizes: 10px labels, 11-12px body, 13px headings, 16px section titles. Letter-spacing: .08em-.14em on uppercase labels.',
      spacing: '8px base unit. Padding: 14-22px for cards, 32px for page content. Gap: 6-12px between elements, 20-24px between sections. Consistent 1px borders.',
      componentStyle: 'Sharp edges (no border-radius or max 2px). 1px solid borders. Dark cards (#0D0D0D) on black backgrounds. Toggle buttons with active/inactive states. Ghost buttons with uppercase text. Code badges with monospace font.',
      iconography: 'No icons in MVP. Status indicated by colored dots (8-10px circles). Visual hierarchy through typography weight, size, and color — not iconography.',
      tone: 'Technical, direct, uppercase for labels and section titles. No exclamation marks. No emoji in UI. Status messages are terse: "ACTIVE", "CONNECTED", "SCANNING...".',
      dos: 'Use ds-* CSS classes. Use uppercase for labels. Use JetBrains Mono for data. Use red (#FF2A2A) for primary actions. Use green (#2ECC71) for success states. Use thin borders (1px solid). Use animation: dsFadeIn for revealing content.',
      donts: 'No light mode. No rounded corners > 2px. No generic SaaS blue. No gradients. No shadows. No illustrations. No emoji. No friendly copy. No hover color changes on text. No underlines except active nav state.',
    },
    update: {
      brandPersonality: 'Dark, calm, high-confidence, minimal. Surgical precision, never playfulness.',
      colorPalette: 'Background: #000000-#0A0A0A. Accent: #FF2A2A. Text: #FFFFFF/#B3B3B3/#6A6A6A. Success: #2ECC71. BANNED: #3B82F6.',
    },
  });
  console.log('✓ Design style created');

  // 5. Create personas
  const personaData = [
    {
      name: 'Alex — Technical Founder',
      role: 'CEO / Technical Co-founder',
      description: 'Building their startup product and wearing multiple hats. Needs to translate vision into executable specs without a large team.',
      goals: 'Ship a structured MVP. Avoid "vibe coding" that creates unmaintainable software. Get from idea to implementation plan in hours, not weeks.',
      painPoints: 'Context loss between ideation and implementation. No time to write detailed specs. Past AI tools generated generic code that missed business intent.',
      technicalLevel: 'Senior — can code but needs to focus on strategy. Wants AI to handle the translation from product intent to architecture.',
      workflows: 'Define product context → Connect GitHub → Deep scan → Request implementation plans → Execute with confidence.',
      decisionInfluence: 'Primary decision maker. Approves all architecture choices.',
      needs: 'Speed, precision, and trust in agent outputs. Every recommendation must be grounded in actual code, not generic patterns.',
      risks: 'Might skip context modules and go straight to agent planning, leading to incomplete outputs.',
    },
    {
      name: 'Jordan — Product Manager',
      role: 'Product Manager',
      description: 'Defines what gets built and in what order. Needs to communicate intent to engineering without ambiguity.',
      goals: 'Create clear product context that agents can consume. Generate user stories and acceptance criteria automatically. Track which features have implementation plans.',
      painPoints: 'Engineers misinterpret requirements. Context scattered across Notion, Slack, and meetings. No single source of truth for product decisions.',
      technicalLevel: 'Intermediate — understands architecture at a high level but does not write code.',
      workflows: 'Fill in Product Context → Define Personas → Set UX Guidelines → Review agent-generated plans.',
      decisionInfluence: 'Defines what gets built. Engineering defines how.',
      needs: 'A structured way to capture product intent that AI agents can reliably consume.',
      risks: 'Might over-specify UX guidelines and conflict with engineering constraints.',
    },
    {
      name: 'Sam — Engineering Lead',
      role: 'Senior Engineer / Tech Lead',
      description: 'Reviews agent-generated implementation plans and executes them. Needs plans to be precise, not vague.',
      goals: 'Get implementation plans that specify exact files, code changes, and execution order. Reduce time spent on architecture decisions for routine features.',
      painPoints: 'Vague specs from product team. AI-generated code that ignores existing patterns. Plans that do not account for the current codebase state.',
      technicalLevel: 'Expert — deep knowledge of the tech stack. Validates agent outputs against actual code.',
      workflows: 'Review deep scan accuracy → Validate implementation plans → Execute subtasks → Run diagnostics.',
      decisionInfluence: 'Final authority on technical implementation. Can reject agent plans.',
      needs: 'File-level precision in plans. Risk assessment. Awareness of existing patterns in the codebase.',
      risks: 'Might distrust agent outputs initially and bypass the planning system.',
    },
  ];

  for (const p of personaData) {
    await prisma.projectPersona.create({
      data: { projectId: project.id, ...p },
    });
  }
  console.log(`✓ ${personaData.length} personas created`);

  // 6. Add a context item
  await prisma.projectContextItem.create({
    data: {
      projectId: project.id,
      type: 'document',
      title: 'Product Vision Statement',
      content: 'Disruptio transforms product chaos into executable software intelligence. By capturing structured product context and connecting it to real codebases through GitHub, Disruptio enables AI agents to generate implementation plans with the precision of a senior tech lead. The platform eliminates the gap between product intent and engineering execution — no more lost context, no more vague specs, no more vibe coding.',
      source: 'founding-team',
    },
  });
  console.log('✓ Context item created');

  console.log('\n✅ All context modules populated. Run diagnostic again to verify 100% completeness.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
