import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import { createProjectClient, resolveModel } from '@/lib/openai';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId, mode, existingPersonas } = await req.json();
  // mode: 'suggest' = suggest new personas, 'enhance' = enhance the current form

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { personas: true },
  });
  if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 });

  // Load agent if selected
  let agent: any = null;
  if (agentId) {
    agent = await prisma.agentConfiguration.findUnique({ where: { id: agentId } });
  }

  // Build context
  const projectContext = [
    project.name && `Product: ${project.name}`,
    project.description && `Description: ${project.description}`,
    project.productType && `Product Type: ${project.productType}`,
    project.businessGoal && `Business Goal: ${project.businessGoal}`,
    project.targetUsers && `Target Users: ${project.targetUsers}`,
    project.coreWorkflows && `Core Workflows: ${project.coreWorkflows}`,
  ].filter(Boolean).join('\n');

  const existingPersonasSummary = (existingPersonas || project.personas || [])
    .map((p: any) => `- ${p.name} (${p.role || 'no role'}): ${p.description || 'no description'}`)
    .join('\n');

  const systemPrompt = agent?.systemInstructions
    ? `${agent.systemInstructions}\n\nYou are helping define user personas for a software product.`
    : 'You are a senior UX researcher and product strategist helping define user personas for a software product.';

  const userPrompt = mode === 'suggest'
    ? `Based on the following product context, suggest 3-5 comprehensive user personas. Each persona should be realistic and actionable for UX and product decisions.

## Product Context
${projectContext || 'No product context available. Generate generic but useful personas based on common product patterns.'}

${existingPersonasSummary ? `## Existing Personas (do NOT duplicate these)\n${existingPersonasSummary}` : ''}

Respond with a JSON array of persona objects. Each object must have these fields:
- name: string (a realistic persona name, e.g., "Sarah Chen")
- role: string (their job title or role)
- description: string (2-3 sentences about who they are)
- goals: string (what they want to achieve)
- painPoints: string (what frustrates them)
- technicalLevel: string (e.g., "Beginner", "Intermediate", "Advanced", "Expert")
- workflows: string (their primary workflows)
- needs: string (what they need from the product)
- risks: string (risks or frustrations)

Return ONLY valid JSON array, no markdown, no code fences, no explanation.`
    : `Based on the following product context, enhance and complete this persona with detailed, realistic information. Fill in any empty fields and improve existing ones.

## Product Context
${projectContext}

## Current Persona Data
${JSON.stringify(existingPersonas, null, 2)}

Respond with a single JSON object with the same fields (name, role, description, goals, painPoints, technicalLevel, workflows, needs, risks).
Return ONLY valid JSON object, no markdown, no code fences, no explanation.`;

  try {
    const client = createProjectClient(project);
    const model = resolveModel(agent?.model || project.aiModel || 'gpt-4');

    const completion = await client.chat.completions.create({
      model,
      temperature: 0.4,
      max_tokens: 4096,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    let content = completion.choices[0]?.message?.content || '';

    // Strip markdown code fences if present
    content = content.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();

    const parsed = JSON.parse(content);

    if (mode === 'suggest') {
      // Save all personas to DB
      const personas = Array.isArray(parsed) ? parsed : [parsed];
      const created = [];

      for (const p of personas) {
        const persona = await prisma.projectPersona.create({
          data: {
            projectId,
            name: p.name || 'Unnamed Persona',
            role: p.role || '',
            description: p.description || '',
            goals: p.goals || '',
            painPoints: p.painPoints || '',
            technicalLevel: p.technicalLevel || '',
            workflows: p.workflows || '',
            needs: p.needs || '',
            risks: p.risks || '',
          },
        });
        created.push(persona);
      }

      return NextResponse.json({ mode: 'suggest', personas: created, count: created.length });
    } else {
      // Return the enhanced persona data (don't save yet — let user review)
      return NextResponse.json({ mode: 'enhance', persona: parsed });
    }
  } catch (err: any) {
    console.error('[Persona AI Error]', err);
    return NextResponse.json({ error: err.message || 'AI generation failed' }, { status: 500 });
  }
}
