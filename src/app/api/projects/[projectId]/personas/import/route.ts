import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/prisma';
import openai, { resolveModel } from '@/lib/openai';
import mammoth from 'mammoth';

export async function POST(req: NextRequest, { params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 503 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    // Extract text from docx
    const buffer = Buffer.from(await file.arrayBuffer());
    const { value: rawText } = await mammoth.extractRawText({ buffer });

    if (!rawText.trim()) {
      return NextResponse.json({ error: 'Could not extract text from document' }, { status: 400 });
    }

    // Send to AI for structured extraction
    const model = resolveModel('gpt-4');
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.1,
      max_tokens: 8192,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a document parser that extracts persona/profile data from organizational documents.
You MUST translate ALL content to English (en-EN). The source document may be in any language.

Return a JSON object with this exact structure:
{
  "personas": [
    {
      "name": "Persona name in English",
      "role": "Their organizational role in English",
      "description": "What they do in the organization, translated to English",
      "goals": "Their main goals, translated to English",
      "painPoints": "Their challenges or frustrations, translated to English",
      "technicalLevel": "One of: Executive, Management, Operational, Technical, External",
      "workflows": "Their primary workflows/process interventions, translated to English",
      "needs": "What they need to succeed, translated to English",
      "risks": "Risks or frustrations they face, translated to English"
    }
  ]
}

Rules:
- Extract EVERY persona/profile from the document. Do not skip any.
- Translate everything to English. Be accurate and professional.
- Map the document's columns/fields intelligently to the persona fields above.
- For "technicalLevel", infer from context (e.g., "Órgão social" → "Executive", "Operacional interno" → "Operational").
- For "goals", infer from their role and responsibilities if not explicitly stated.
- For "painPoints", infer common challenges for their role type.
- For "needs", infer from their role and workflows.
- For "risks", infer from their responsibilities.
- Keep descriptions concise but complete.`
        },
        {
          role: 'user',
          content: `Extract all personas from this document:\n\n${rawText}`
        }
      ],
    });

    const response = completion.choices[0]?.message?.content || '';
    let parsed;
    try {
      parsed = JSON.parse(response);
    } catch {
      return NextResponse.json({ error: 'Failed to parse AI response' }, { status: 500 });
    }

    if (!parsed.personas || !Array.isArray(parsed.personas) || parsed.personas.length === 0) {
      return NextResponse.json({ error: 'No personas extracted from document' }, { status: 400 });
    }

    // Bulk create personas
    const created = [];
    for (const p of parsed.personas) {
      const persona = await prisma.projectPersona.create({
        data: {
          projectId,
          name: p.name || 'Unnamed',
          role: p.role || null,
          description: p.description || null,
          goals: p.goals || null,
          painPoints: p.painPoints || null,
          technicalLevel: p.technicalLevel || null,
          workflows: p.workflows || null,
          needs: p.needs || null,
          risks: p.risks || null,
        },
      });
      created.push(persona);
    }

    return NextResponse.json({
      imported: created.length,
      personas: created,
    });
  } catch (err: any) {
    console.error('[Persona Import Error]', err);
    return NextResponse.json(
      { error: err.message || 'Import failed' },
      { status: 500 }
    );
  }
}
