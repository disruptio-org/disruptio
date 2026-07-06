'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ContextEditor({ project }: { project: any }) {
  const router = useRouter();
  const [objective, setObjective] = useState(project.businessGoal || '');
  const [vision, setVision] = useState(project.description || '');
  const [workflows, setWorkflows] = useState(project.coreWorkflows || '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // AI Assist state
  const agents: { id: string; name: string; agentType: string }[] = project.agents || [];
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');

  const hasDeepScan = !!project.repositoryKnowledge?.id;
  const hasGithub = !!project.githubConnection?.id;

  const compiledPrompt = [
    '## PRODUCT CONTEXT — ' + project.name,
    '',
    '### OBJECTIVE',
    objective.trim() || '[ NOT DEFINED — agents will flag missing context ]',
    '',
    '### VISION',
    vision.trim() || '[ NOT DEFINED — agents will flag missing context ]',
    '',
    '### CORE USER WORKFLOWS',
    workflows.trim()
      ? workflows.trim().split('\n').filter(Boolean).map((l: string, i: number) => `${i + 1}. ${l.trim()}`).join('\n')
      : '[ NOT DEFINED — agents will flag missing context ]',
    '',
    '---',
    'CONSTRAINT: Treat every statement above as ground truth.',
    'CONSTRAINT: If a required section reads NOT DEFINED, halt and request context.',
  ].join('\n');

  const handleSave = async () => {
    setSaving(true);
    await fetch(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessGoal: objective, description: vision, coreWorkflows: workflows }),
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
      const prompt = `You are analyzing a software project to define its Product Context. Use ALL available project context, repository knowledge, architecture data, and documentation to produce a comprehensive analysis.

Return ONLY a valid JSON object with these exact keys:
{
  "objective": "A clear, specific product objective (2-3 sentences). What problem does this product solve? Who is it for? What value does it deliver?",
  "vision": "A compelling vision statement (2-3 sentences). Where does this product win in 3 years? What is the long-term aspiration?",
  "workflows": "Core user workflows, one per line. Each should describe a key user action flow (e.g., 'User creates project → connects GitHub repo → agents analyze codebase'). Include 4-8 workflows."
}

Be specific and grounded in the actual codebase and project data you have access to. Do NOT be generic.`;

      const res = await fetch(`/api/projects/${project.id}/agents/run`, {
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
        if (parsed.objective) setObjective(parsed.objective);
        if (parsed.vision) setVision(parsed.vision);
        if (parsed.workflows) {
          // Handle both string (newline-separated) and array formats
          const wf = Array.isArray(parsed.workflows)
            ? parsed.workflows.join('\n')
            : parsed.workflows;
          setWorkflows(wf);
        }
      } else {
        setAiError('Could not parse AI response');
      }
    } catch (err: any) {
      setAiError(err.message || 'Network error');
    }
    setAiLoading(false);
  };

  const tokenCount = compiledPrompt.split(/\s+/).length;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
      {/* Left: form */}
      <div style={{ padding: '32px', borderRight: '1px solid var(--border-default)', display: 'flex', flexDirection: 'column', gap: '26px', overflowY: 'auto' }}>
        <div>
          <div className="ds-section-title">PRODUCT CONTEXT</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
            Structured input compiles directly into agent system prompts. Structure = precision.
          </div>
        </div>
        <label className="ds-form-group">
          <span className="ds-label">PRODUCT OBJECTIVE</span>
          <textarea rows={4} value={objective} onChange={e => setObjective(e.target.value)} className="ds-textarea" spellCheck={false} />
        </label>
        <label className="ds-form-group">
          <span className="ds-label">VISION STATEMENT</span>
          <textarea rows={3} value={vision} onChange={e => setVision(e.target.value)} placeholder="Where does this product win in 3 years?" className="ds-textarea" spellCheck={false} />
        </label>
        <label className="ds-form-group">
          <span className="ds-label">CORE USER WORKFLOWS</span>
          <textarea rows={6} value={workflows} onChange={e => setWorkflows(e.target.value)} placeholder={'One workflow per line, e.g.\nPM imports GitHub repo → agents scan structure'} className="ds-textarea" spellCheck={false} />
        </label>
        <div className="ds-form-row">
          <button className="ds-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE CONTEXT'}
          </button>
          <button className="ds-btn-ghost" onClick={() => { setObjective(project.businessGoal || ''); setVision(project.description || ''); setWorkflows(project.coreWorkflows || ''); }}>DISCARD</button>
        </div>

        {/* AI Agent Assist */}
        <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '24px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
            <span style={{ fontSize: '10px', letterSpacing: '.12em', color: 'var(--accent)', fontWeight: 700 }}>AI ASSIST</span>
            {!hasGithub && (
              <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>⚠ No GitHub repo connected</span>
            )}
            {hasGithub && !hasDeepScan && (
              <span style={{ fontSize: '10px', color: 'var(--warning)' }}>⚠ Run a deep scan first for best results</span>
            )}
            {hasDeepScan && (
              <span style={{ fontSize: '10px', color: 'var(--success)' }}>● Deep scan available</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                background: 'var(--bg-elevated)', border: '1px solid var(--border-input)', color: 'var(--text-secondary)',
                padding: '8px 12px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace',
                minWidth: '200px',
              }}
            >
              {agents.length === 0 && <option value="">No agents available</option>}
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
            <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--warning)', letterSpacing: '.1em' }}>
              ● Agent is analyzing repository and project context...
            </div>
          )}
          {aiError && (
            <div style={{ marginTop: '10px', fontSize: '10px', color: 'var(--accent)', letterSpacing: '.1em' }}>
              ✕ {aiError}
            </div>
          )}
        </div>
      </div>
      {/* Right: compiled prompt */}
      <div style={{ background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid var(--border-default)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="ds-label">COMPILED AGENT PROMPT — READ ONLY</span>
          <span style={{ fontSize: '10.5px', color: 'var(--text-ghost)' }}>{tokenCount} tokens · auto-compiled</span>
        </div>
        <pre style={{ margin: 0, padding: '24px', overflow: 'auto', flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.7, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>
          {compiledPrompt}
        </pre>
        <div style={{ padding: '12px 24px', borderTop: '1px solid var(--border-default)', fontSize: '10.5px', color: 'var(--text-ghost)' }}>
          Injected into: <span style={{ color: 'var(--text-muted)' }}>[ARC] [DSN] [PLN] [SPC]</span> system instructions on next run.
        </div>
      </div>
    </div>
  );
}
