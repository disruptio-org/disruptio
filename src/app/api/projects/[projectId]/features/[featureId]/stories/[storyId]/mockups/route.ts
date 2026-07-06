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

  // Read actual CSS from the project for pixel-perfect matching
  const fs = await import('fs');
  const path = await import('path');
  let actualCSS = '';
  try {
    const cssPath = path.join(process.cwd(), 'src/app/globals.css');
    actualCSS = fs.readFileSync(cssPath, 'utf-8');
  } catch { /* fallback to manual tokens */ }

  const ds = project.designStyle;
  const gl = project.guidelines;

  const designContext = actualCSS ? `
## ACTUAL APPLICATION CSS (use this as the reference for pixel-perfect matching)
\`\`\`css
${actualCSS}
\`\`\`
` : ds ? `
## Design Style
- Brand Personality: ${ds.brandPersonality || 'Not specified'}
- Color Palette: ${ds.colorPalette || 'Dark mode, #FF2A2A accent'}
- Typography: ${ds.typography || 'JetBrains Mono, monospace'}
- Spacing: ${ds.spacing || 'Compact'}
- Component Style: ${ds.componentStyle || 'Sharp corners, no border-radius'}
` : `
## Design Style (defaults)
- Dark mode background: #0A0A0A, Accent: #FF2A2A, Font: JetBrains Mono
`;

  const uxContext = gl ? `
## UX Guidelines
- Navigation: ${gl.navigationPrinciples || 'Sidebar navigation'}
- Form Behavior: ${gl.formBehavior || 'Inline validation'}
- Empty States: ${gl.emptyStateRules || 'Show helpful message'}
` : '';

  const storyContext = `
## User Story
Feature: ${story.feature.title}
As a ${story.persona}, I want to ${story.action} so that ${story.benefit}

## Requirements
${JSON.stringify(story.requirements || [], null, 2)}

## Acceptance Criteria
${JSON.stringify(story.acceptanceCriteria || [], null, 2)}

## Gherkin Scenarios
${JSON.stringify(story.gherkinScenarios || [], null, 2)}
`;

  const systemPrompt = agentConfig?.systemInstructions
    ? `${agentConfig.systemInstructions}\n\nYou are generating an HTML mockup. Follow the rules below strictly.`
    : 'You are a senior UI/UX designer and frontend developer. You create pixel-perfect HTML mockups that exactly match the given CSS design system.';

  try {
    const client = createProjectClient(project);
    const model = project.aiModel || 'gpt-4o';
    const needsSystemMerge = /^(o1|o3|o4|gpt-5)/.test(model);

    const makeMessages = (sys: string, usr: string) => {
      const msgs: { role: 'system' | 'user' | 'assistant'; content: string }[] = needsSystemMerge
        ? [{ role: 'user', content: `${sys}\n\n---\n\n${usr}` }]
        : [{ role: 'system', content: sys }, { role: 'user', content: usr }];
      return msgs;
    };

    const cleanHtml = (raw: string) => {
      let h = raw.replace(/^```html\s*/i, '').replace(/\s*```\s*$/, '').trim();
      if (!h.startsWith('<!DOCTYPE') && !h.startsWith('<html') && !h.startsWith('<HTML')) {
        const idx = h.indexOf('<!DOCTYPE');
        if (idx > 0) h = h.substring(idx);
      }
      return h;
    };

    // ─── AUTO-GENERATE: Plan screens first, then generate each ───
    if (autoGenerate) {
      // Step 1: Plan which screens to generate
      const planPrompt = `Analyze this user story and identify the DISTINCT screens/views needed.

${storyContext}

Return a JSON array of screen objects. Each object has:
- "title": Short screen title (e.g., "Documentation List View")
- "description": What this screen shows and what the user does here

RULES:
- Only include screens directly relevant to this user story
- Do NOT include a login/authentication screen unless the story explicitly mentions it
- Each screen should represent a DIFFERENT step in the user flow
- Order them in the natural user journey sequence
- Typically 2-5 screens per user story
- Return ONLY the JSON array, no markdown, no explanation

Example output:
[{"title":"Documentation Types List","description":"Shows all available documentation types with generate buttons and status"},{"title":"Generated Document View","description":"Shows a fully rendered document with export options"}]`;

      const planCompletion = await safeCompletion(client, {
        model,
        messages: makeMessages(systemPrompt, planPrompt),
        temperature: 0.3,
        max_completion_tokens: 2048,
      });

      let planRaw = planCompletion.choices[0]?.message?.content || '[]';
      planRaw = planRaw.replace(/^```json?\s*/i, '').replace(/\s*```\s*$/, '').trim();
      
      let screens: { title: string; description: string }[] = [];
      try {
        screens = JSON.parse(planRaw);
        if (!Array.isArray(screens)) screens = [screens];
      } catch {
        screens = [{ title: `${story.feature.title} — Main View`, description: `Main screen for: ${story.action}` }];
      }

      // Step 2: Generate each screen
      const existingMockups = (story.mockups as any[]) || [];
      const newMockups: any[] = [];

      for (let i = 0; i < screens.length; i++) {
        const screen = screens[i];
        const screenPrompt = `Generate a COMPLETE, self-contained HTML page for this specific screen:

# Screen: ${screen.title}
${screen.description}

This is screen ${i + 1} of ${screens.length} in the user flow for this story.

${storyContext}
${designContext}
${uxContext}

# STRICT RULES
1. Return ONLY valid HTML — no markdown, no explanation, no backticks
2. Copy the CSS classes and variables from the application CSS above into a <style> block
3. Include: <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
4. Use the EXACT same CSS classes as the real app (ds-card, ds-btn-primary, ds-input, ds-sidebar, ds-sidebar-item, etc.)
5. The sidebar should have these exact items: Overview, Product Context, Personas, UX/UI Guidelines, Design Style, Technology View, GitHub Repository, Agents, Features, Documentation, Settings
6. Use REALISTIC data — actual labels matching the user story context. No placeholder text.
7. Include hover effects and transitions matching the CSS
8. The layout must be: fixed sidebar (236px) + scrollable main content
9. The HTML must start with <!DOCTYPE html>
10. DO NOT include any text before or after the HTML`;

        const screenCompletion = await safeCompletion(client, {
          model,
          messages: makeMessages(systemPrompt, screenPrompt),
          temperature: 0.4,
          max_completion_tokens: 16384,
        });

        const html = cleanHtml(screenCompletion.choices[0]?.message?.content || '');
        if (html) {
          newMockups.push({
            id: `screen-${Date.now()}-${i}`,
            title: screen.title,
            description: screen.description,
            html,
            status: 'draft',
            order: existingMockups.length + i,
            createdAt: new Date().toISOString(),
          });
        }
      }

      if (newMockups.length === 0) {
        return NextResponse.json({ error: 'AI failed to generate any screens' }, { status: 500 });
      }

      const updatedMockups = [...existingMockups, ...newMockups];
      await prisma.userStory.update({
        where: { id: storyId },
        data: { mockups: updatedMockups },
      });

      return NextResponse.json({ ok: true, mockups: newMockups, total: updatedMockups.length });
    }

    // ─── MANUAL PROMPT: Generate a single screen ───
    const screenDescription = prompt || 'Generate the main screen for this user story.';

    const userMessage = `Generate a COMPLETE, self-contained HTML page for this screen:

# Screen Description
${screenDescription}

${storyContext}
${designContext}
${uxContext}

# STRICT RULES
1. Return ONLY valid HTML — no markdown, no explanation, no backticks
2. Copy the CSS classes and variables from the application CSS above into a <style> block
3. Include: <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
4. Use the EXACT same CSS classes as the real app (ds-card, ds-btn-primary, ds-input, ds-sidebar, ds-sidebar-item, etc.)
5. The sidebar should have these exact items: Overview, Product Context, Personas, UX/UI Guidelines, Design Style, Technology View, GitHub Repository, Agents, Features, Documentation, Settings
6. Use REALISTIC data — actual labels matching the user story context
7. Include hover effects and transitions matching the CSS
8. The layout must be: fixed sidebar (236px) + scrollable main content
9. The HTML must start with <!DOCTYPE html>
10. DO NOT include any text before or after the HTML`;

    const completion = await safeCompletion(client, {
      model,
      messages: makeMessages(systemPrompt, userMessage),
      temperature: 0.4,
      max_completion_tokens: 16384,
    });

    const html = cleanHtml(completion.choices[0]?.message?.content || '');
    if (!html) {
      return NextResponse.json({ error: 'AI returned empty response' }, { status: 500 });
    }

    const existingMockups = (story.mockups as any[]) || [];
    const newMockup = {
      id: `screen-${Date.now()}`,
      title: prompt && prompt.length > 60 ? prompt.slice(0, 57) + '...' : prompt || 'Generated Screen',
      description: prompt || 'Custom screen',
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
