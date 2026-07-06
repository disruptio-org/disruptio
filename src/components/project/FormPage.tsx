'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Field {
  key: string;
  label: string;
  rows: number;
}

interface Agent {
  id: string;
  name: string;
  agentType: string;
}

interface FormPageProps {
  title: string;
  subtitle: string;
  projectId: string;
  apiPath: string;
  fields: Field[];
  initialData: Record<string, any>;
  agents?: Agent[];
  hasDeepScan?: boolean;
  hasGithub?: boolean;
}

export default function FormPage({ title, subtitle, projectId, apiPath, fields, initialData, agents, hasDeepScan, hasGithub }: FormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, (initialData as any)?.[f.key] || '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI Assist state
  const [selectedAgent, setSelectedAgent] = useState(agents?.[0]?.id || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const update = (key: string, value: string) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/projects/${projectId}/${apiPath}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  const handleAiRun = async () => {
    if (!selectedAgent || aiLoading) return;
    setAiLoading(true);
    setAiError('');
    try {
      const fieldDescriptions = fields.map(f => `"${f.key}": "${f.label}"`).join(',\n  ');
      const prompt = `You are analyzing a software project to define its ${title}. Use ALL available project context, repository knowledge, architecture data, personas, and documentation to produce comprehensive, specific guidelines.

Return ONLY a valid JSON object with these exact keys:
{
  ${fieldDescriptions}
}

Rules:
- Each value should be a detailed, multi-line string with specific rules and guidelines.
- Be specific and grounded in the actual codebase, tech stack, and project data you have access to.
- Do NOT be generic — reference actual technologies, patterns, and conventions found in the project.
- Use numbered lists or bullet points (with line breaks) for clarity.
- Each field should have 3-8 specific rules or guidelines.`;

      const res = await fetch(`/api/projects/${projectId}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent, message: prompt }),
      });

      if (!res.ok) {
        const err = await res.json();
        setAiError(err.error || 'Agent execution failed');
        setAiLoading(false);
        return;
      }

      const data = await res.json();
      const raw = data.response || '';

      // Extract JSON
      let jsonStr = '';
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) {
        jsonStr = fenced[1].trim();
      } else {
        const objMatch = raw.match(/\{[\s\S]*\}/);
        jsonStr = objMatch?.[0] || '';
      }

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        const newForm = { ...form };
        for (const f of fields) {
          if (parsed[f.key]) newForm[f.key] = parsed[f.key];
        }
        setForm(newForm);
      } else {
        setAiError('Could not parse AI response');
      }
    } catch (err: any) {
      setAiError(err.message || 'Network error');
    }
    setAiLoading(false);
  };

  return (
    <div style={{ padding: '32px', maxWidth: '780px', display: 'flex', flexDirection: 'column', gap: '26px' }}>
      <div>
        <div className="ds-section-title">{title}</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A', lineHeight: 1.6 }}>{subtitle}</div>
      </div>
      {fields.map(f => (
        <label key={f.key} className="ds-form-group">
          <span className="ds-label">{f.label}</span>
          {f.rows > 0 ? (
            <textarea rows={f.rows} value={form[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-textarea" spellCheck={false} />
          ) : (
            <input type="text" value={form[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-input" spellCheck={false} />
          )}
        </label>
      ))}
      <div className="ds-form-row">
        <button className="ds-btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'SAVING...' : saved ? '\u2713 SAVED' : `SAVE ${title}`}
        </button>
        <button className="ds-btn-ghost" onClick={() => setForm(Object.fromEntries(fields.map(f => [f.key, (initialData as any)?.[f.key] || ''])))}>DISCARD</button>
      </div>

      {/* AI Agent Assist — only shown when agents are passed */}
      {agents && agents.length > 0 && (
        <div style={{ borderTop: '1px solid #1F1F1F', paddingTop: '24px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '.12em', color: '#FF2A2A', fontWeight: 700 }}>AI ASSIST</span>
            {hasGithub === false && (
              <span style={{ fontSize: '10px', color: '#6A6A6A' }}>⚠ No GitHub repo connected</span>
            )}
            {hasGithub && !hasDeepScan && (
              <span style={{ fontSize: '10px', color: '#F39C12' }}>⚠ Run a deep scan first for best results</span>
            )}
            {hasDeepScan && (
              <span style={{ fontSize: '10px', color: '#2ECC71' }}>● Deep scan available</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#B3B3B3',
                padding: '8px 12px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace',
                minWidth: '200px',
              }}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
            <button
              className="ds-btn-primary ds-btn-sm"
              onClick={handleAiRun}
              disabled={aiLoading || !selectedAgent}
              style={{ whiteSpace: 'nowrap', opacity: aiLoading ? 0.6 : 1 }}
            >
              {aiLoading ? '[ ANALYZING... ]' : '[ RUN AGENT ]'}
            </button>
          </div>
          {aiLoading && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#F39C12', letterSpacing: '.1em' }}>
              ● Agent is analyzing repository and project context...
            </div>
          )}
          {aiError && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: '#FF2A2A', letterSpacing: '.1em' }}>
              ✕ {aiError}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
