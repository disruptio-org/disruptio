export function formatRelativeTime(date: Date | string): string {
  const now = new Date();
  const d = new Date(date);
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString();
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}

export const DEFAULT_AGENTS = [
  {
    agentType: 'solution-architect',
    name: 'Solution Architect Agent',
    description: 'Understands the product context, GitHub repository, technology decisions, and creates technical architecture recommendations.',
    systemInstructions: 'You are the Solution Architect. Derive system boundaries, data contracts and integration points strictly from the compiled Product Context and Technology View. Flag any decision that lacks documented context.',
    allowedContext: ['Product Context', 'Tech View', 'GitHub Repo'],
    model: 'gpt-4',
    temperature: 0.3,
  },
  {
    agentType: 'design',
    name: 'Design Agent',
    description: 'Turns product requirements into UX/UI structure while respecting the design style and component system.',
    systemInstructions: 'You are the Design Agent. Enforce the documented design style and UX/UI guidelines on every screen specification. Reject generic SaaS patterns not grounded in the style guide.',
    allowedContext: ['Personas', 'UX/UI Rules', 'Design Style'],
    model: 'gpt-4',
    temperature: 0.4,
  },
  {
    agentType: 'planning',
    name: 'Planning Agent',
    description: 'Breaks work into epics, stories, milestones, dependencies, and execution sequence.',
    systemInstructions: 'You are the Planning Agent. Decompose the product objective into an ordered, dependency-aware build plan. Every task must cite the context module that motivates it.',
    allowedContext: ['Product Context', 'Personas', 'Tech View'],
    model: 'gpt-4',
    temperature: 0.2,
    enabled: false,
  },
  {
    agentType: 'qa-test',
    name: 'QA/Test Agent',
    description: 'Creates acceptance criteria, Given/When/Then scenarios, regression risks, and test plans.',
    systemInstructions: 'You are the QA/Test Agent. Produce implementation-ready specifications from the compiled context. Keep language testable: every requirement gets an observable acceptance criterion.',
    allowedContext: ['Product Context', 'Personas', 'UX/UI Rules', 'Tech View'],
    model: 'gpt-4',
    temperature: 0.2,
  },
];
