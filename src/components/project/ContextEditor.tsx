'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ContextEditor({ project }: { project: any }) {
  const router = useRouter();
  const [objective, setObjective] = useState(project.businessGoal || '');
  const [vision, setVision] = useState(project.description || '');
  const [workflows, setWorkflows] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
      body: JSON.stringify({ businessGoal: objective, description: vision }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    router.refresh();
  };

  const tokenCount = compiledPrompt.split(/\s+/).length;

  return (
    <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', minHeight: 0 }}>
      {/* Left: form */}
      <div style={{ padding: '32px', borderRight: '1px solid #1F1F1F', display: 'flex', flexDirection: 'column', gap: '26px', overflowY: 'auto' }}>
        <div>
          <div className="ds-section-title">PRODUCT CONTEXT</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A', lineHeight: 1.6 }}>
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
          <textarea rows={6} value={workflows} onChange={e => setWorkflows(e.target.value)} placeholder={'One workflow per line, e.g.\nPM imports GitHub repo -> agents scan structure'} className="ds-textarea" spellCheck={false} />
        </label>
        <div className="ds-form-row">
          <button className="ds-btn-primary" onClick={handleSave} disabled={saving}>
            {saving ? 'SAVING...' : saved ? '✓ SAVED' : 'SAVE CONTEXT'}
          </button>
          <button className="ds-btn-ghost" onClick={() => { setObjective(project.businessGoal || ''); setVision(project.description || ''); setWorkflows(''); }}>DISCARD</button>
        </div>
      </div>
      {/* Right: compiled prompt */}
      <div style={{ background: '#000000', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ padding: '14px 24px', borderBottom: '1px solid #1F1F1F', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="ds-label">COMPILED AGENT PROMPT — READ ONLY</span>
          <span style={{ fontSize: '10.5px', color: '#4A4A4A' }}>{tokenCount} tokens · auto-compiled</span>
        </div>
        <pre style={{ margin: 0, padding: '24px', overflow: 'auto', flex: 1, fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.7, color: '#B3B3B3', whiteSpace: 'pre-wrap' }}>
          {compiledPrompt}
        </pre>
        <div style={{ padding: '12px 24px', borderTop: '1px solid #1F1F1F', fontSize: '10.5px', color: '#4A4A4A' }}>
          Injected into: <span style={{ color: '#8A8A8A' }}>[ARC] [DSN] [PLN] [SPC]</span> system instructions on next run.
        </div>
      </div>
    </div>
  );
}
