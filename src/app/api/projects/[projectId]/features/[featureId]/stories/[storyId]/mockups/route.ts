import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectClient, safeCompletion } from '@/lib/openai';

/**
 * POST /api/projects/[projectId]/features/[featureId]/stories/[storyId]/mockups
 * Generate a new mockup screen using AI
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }
) {
  const { projectId, storyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { prompt, autoGenerate, agentId } = await req.json();
  if (!prompt && !autoGenerate) return NextResponse.json({ error: 'prompt or autoGenerate is required' }, { status: 400 });

  // Load story
  const story = await prisma.userStory.findUnique({ where: { id: storyId }, include: { feature: true } });
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

  // Load project with design context
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { designStyle: true, guidelines: true, technology: true, repositoryKnowledge: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Load agent if specified
  let agentConfig = null;
  if (agentId) {
    agentConfig = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });
  }

  // Build design context
  const ds = project.designStyle;
  const gl = project.guidelines;
  const designContext = ds ? `
## Design Style
- Brand Personality: ${ds.brandPersonality || 'Not specified'}
- Color Palette: ${ds.colorPalette || 'Dark mode, #FF2A2A accent'}
- Typography: ${ds.typography || 'JetBrains Mono, monospace'}
- Spacing: ${ds.spacing || 'Compact'}
- Component Style: ${ds.componentStyle || 'Sharp corners, no border-radius'}
- Iconography: ${ds.iconography || 'Minimal'}
- Tone: ${ds.tone || 'Professional, technical'}
- DO: ${ds.dos || 'Use consistent spacing'}
- DON'T: ${ds.donts || 'Use rounded corners'}
` : `
## Design Style (defaults)
- Dark mode background: #0A0A0A
- Accent color: #FF2A2A
- Font: 'JetBrains Mono', monospace
- Sharp corners (border-radius: 0)
- Border color: #1F1F1F
- Text colors: #FFFFFF (headings), #B3B3B3 (body), #5A5A5A (labels)
`;

  const uxContext = gl ? `
## UX Guidelines
- UX Principles: ${gl.uxPrinciples || 'Not specified'}
- Navigation: ${gl.navigationPrinciples || 'Sidebar navigation'}
- Form Behavior: ${gl.formBehavior || 'Inline validation'}
- Empty States: ${gl.emptyStateRules || 'Show helpful message'}
- Loading States: ${gl.loadingStateRules || 'Show spinner'}
- Error States: ${gl.errorStateRules || 'Show red error message'}
- Responsive: ${gl.responsiveRules || 'Desktop first'}
` : '';

  // Build story context
  const storyContext = `
## User Story
Feature: ${story.feature.title}
As a ${story.persona}, I want to ${story.action} so that ${story.benefit}

## Requirements
${JSON.stringify(story.requirements || [], null, 2)}

## Acceptance Criteria
${JSON.stringify(story.acceptanceCriteria || [], null, 2)}
`;

  // System prompt
  const systemPrompt = agentConfig?.systemInstructions
    ? `${agentConfig.systemInstructions}\n\nYou are generating an HTML mockup. Follow the rules below strictly.`
    : 'You are a senior UI/UX designer and frontend developer specializing in creating pixel-perfect HTML mockups.';

  // Build the screen description — auto-generate from story if no prompt
  let screenDescription = prompt;
  if (!screenDescription || autoGenerate) {
    // Build a rich description from story context
    const reqsList = (story.requirements as any[]) || [];
    const funcReqs = reqsList.filter((r: any) => r.type === 'functional').map((r: any) => r.description).join('; ');
    const criteria = story.acceptanceCriteria as any;
    const criteriaStr = Array.isArray(criteria) ? criteria.join('; ') : '';
    const gherkins = (story.gherkinScenarios as any[]) || [];
    const gherkinStr = gherkins.map((g: any) => `${g.title}: Given ${g.given}, When ${g.when}, Then ${g.then}`).join('\n');

    screenDescription = `Generate the main screen for this user story.

User Story: As a ${story.persona}, I want to ${story.action} so that ${story.benefit}.
Feature: ${story.feature.title}

Key functional requirements:
${funcReqs || 'Not specified'}

Acceptance criteria to satisfy:
${criteriaStr || 'Not specified'}

User scenarios to support:
${gherkinStr || 'Not specified'}

Create the PRIMARY screen that would be needed to fulfill this user story. Include all interactive elements (buttons, forms, lists, navigation) that the requirements describe. Use realistic data and labels.`;
  }

  const userMessage = `Generate a COMPLETE, self-contained HTML page for the following screen mockup.

# Screen Description
${screenDescription}

${storyContext}
${designContext}
${uxContext}

# STRICT RULES
1. Return ONLY valid HTML — no markdown, no explanation, no backticks, no \`\`\`html wrapper
2. Use ONLY inline <style> blocks — no external CSS, no CDN links
3. Include the Google Font link for JetBrains Mono: <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
4. Match the project design system EXACTLY:
   - Background: #0A0A0A
   - Cards/panels: #0D0D0D with border: 1px solid #1F1F1F
   - Accent: #FF2A2A
   - Font: 'JetBrains Mono', monospace
   - Border radius: 0 (sharp corners everywhere)
   - Text: #B3B3B3 (body), #FFFFFF (headings), #5A5A5A (labels)
   - Buttons: background #FF2A2A, text #FFFFFF, no border-radius
   - Input fields: background #0A0A0A, border 1px solid #2A2A2A, no border-radius
5. Use REALISTIC data — actual labels, names, numbers. No "Lorem ipsum"
6. Include hover effects with CSS transitions (0.15s ease)
7. Make it responsive — use flexbox/grid
8. Include a left sidebar navigation if the screen is a full page view
9. The HTML must start with <!DOCTYPE html> and be a complete valid document
10. DO NOT include any text before or after the HTML`;

  try {
    const client = createProjectClient(project);
    const model = project.aiModel || 'gpt-4o';

    const needsSystemMerge = /^(o1|o3|o4|gpt-5)/.test(model);

    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = needsSystemMerge
      ? [{ role: 'user', content: `${systemPrompt}\n\n---\n\n${userMessage}` }]
      : [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ];

    const completion = await safeCompletion(client, {
      model,
      messages,
      temperature: 0.4,
      max_completion_tokens: 16384,
    });

    let html = completion.choices[0]?.message?.content || '';
    if (!html) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    // Clean up — strip markdown wrappers if present
    html = html.replace(/^```html\s*/i, '').replace(/\s*```\s*$/, '').trim();
    if (!html.startsWith('<!DOCTYPE') && !html.startsWith('<html') && !html.startsWith('<HTML')) {
      // Try to find the HTML start
      const idx = html.indexOf('<!DOCTYPE');
      if (idx > 0) html = html.substring(idx);
    }

    // Create mockup entry
    const existingMockups = (story.mockups as any[]) || [];
    const newMockup = {
      id: `screen-${Date.now()}`,
      title: autoGenerate
        ? `${story.feature.title} — Main Screen`
        : (prompt && prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt || 'Generated Screen'),
      description: autoGenerate
        ? `Auto-generated from user story: As a ${story.persona}, I want to ${story.action}`
        : prompt || 'Custom screen',
      html,
      status: 'draft',
      order: existingMockups.length,
      createdAt: new Date().toISOString(),
    };

    const updatedMockups = [...existingMockups, newMockup];

    await prisma.userStory.update({
      where: { id: storyId },
      data: { mockups: updatedMockups },
    });

    return NextResponse.json({ ok: true, mockup: newMockup, total: updatedMockups.length });
  } catch (err: any) {
    console.error('[Mockup Generation Error]', err);
    return NextResponse.json({ error: err.message || 'Failed to generate mockup' }, { status: 500 });
  }
}

/**
 * PATCH — Update a mockup (status, title, html)
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }
) {
  const { storyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { mockupId, ...updates } = await req.json();
  if (!mockupId) return NextResponse.json({ error: 'mockupId is required' }, { status: 400 });

  const story = await prisma.userStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

  const mockups = (story.mockups as any[]) || [];
  const idx = mockups.findIndex((m: any) => m.id === mockupId);
  if (idx === -1) return NextResponse.json({ error: 'Mockup not found' }, { status: 404 });

  mockups[idx] = { ...mockups[idx], ...updates };

  await prisma.userStory.update({
    where: { id: storyId },
    data: { mockups },
  });

  return NextResponse.json({ ok: true, mockup: mockups[idx] });
}

/**
 * DELETE — Remove a mockup screen
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ projectId: string; featureId: string; storyId: string }> }
) {
  const { storyId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mockupId = req.nextUrl.searchParams.get('mockupId');
  if (!mockupId) return NextResponse.json({ error: 'mockupId is required' }, { status: 400 });

  const story = await prisma.userStory.findUnique({ where: { id: storyId } });
  if (!story) return NextResponse.json({ error: 'Story not found' }, { status: 404 });

  const mockups = ((story.mockups as any[]) || []).filter((m: any) => m.id !== mockupId);

  await prisma.userStory.update({
    where: { id: storyId },
    data: { mockups },
  });

  return NextResponse.json({ ok: true, remaining: mockups.length });
}
