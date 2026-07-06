'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

export default function PersonasContent({ project }: { project: any }) {
  const router = useRouter();
  const confirm = useConfirm();
  const agents = project.agents || [];

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', role: '', description: '', goals: '', painPoints: '', technicalLevel: '', workflows: '', needs: '', risks: '' });
  const [saving, setSaving] = useState(false);

  // Agent AI state
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');
  const [generating, setGenerating] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [aiStatus, setAiStatus] = useState('');

  // Import state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ count: number; error?: string } | null>(null);

  const fields = [
    { key: 'name', label: 'PERSONA NAME', required: true, rows: 0 },
    { key: 'role', label: 'ROLE', rows: 0 },
    { key: 'description', label: 'DESCRIPTION', rows: 3 },
    { key: 'goals', label: 'GOALS', rows: 2 },
    { key: 'painPoints', label: 'PAIN POINTS', rows: 2 },
    { key: 'technicalLevel', label: 'TECHNICAL LEVEL', rows: 0 },
    { key: 'workflows', label: 'PRIMARY WORKFLOWS', rows: 2 },
    { key: 'needs', label: 'NEEDS', rows: 2 },
    { key: 'risks', label: 'RISKS / FRUSTRATIONS', rows: 2 },
  ];

  const emptyForm = { name: '', role: '', description: '', goals: '', painPoints: '', technicalLevel: '', workflows: '', needs: '', risks: '' };
  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const openEdit = (persona: any) => {
    setForm({ name: persona.name, role: persona.role || '', description: persona.description || '', goals: persona.goals || '', painPoints: persona.painPoints || '', technicalLevel: persona.technicalLevel || '', workflows: persona.workflows || '', needs: persona.needs || '', risks: persona.risks || '' });
    setEditId(persona.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    const url = editId ? `/api/projects/${project.id}/personas?personaId=${editId}` : `/api/projects/${project.id}/personas`;
    await fetch(url, { method: editId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setSaving(false);
    setShowForm(false);
    setEditId(null);
    setForm(emptyForm);
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: 'DELETE PERSONA', message: 'Delete this persona? This action cannot be undone.', confirmLabel: 'DELETE', danger: true });
    if (!ok) return;
    await fetch(`/api/projects/${project.id}/personas?personaId=${id}`, { method: 'DELETE' });
    router.refresh();
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/projects/${project.id}/personas/import`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setImportResult({ count: 0, error: data.error || 'Import failed' });
      } else {
        setImportResult({ count: data.imported });
        router.refresh();
      }
    } catch (err: any) {
      setImportResult({ count: 0, error: err.message || 'Network error' });
    }
    setImporting(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // AI: Suggest personas based on product context
  const handleAiSuggest = async () => {
    setGenerating(true);
    setAiStatus('Analyzing product context and generating personas...');
    try {
      const res = await fetch(`/api/projects/${project.id}/personas/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent || null,
          mode: 'suggest',
          existingPersonas: project.personas,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setAiStatus(`✓ Created ${data.count} persona${data.count !== 1 ? 's' : ''}`);
        router.refresh();
        setTimeout(() => setAiStatus(''), 4000);
      } else {
        setAiStatus(`✕ ${data.error || 'Generation failed'}`);
      }
    } catch (err: any) {
      setAiStatus(`✕ ${err.message || 'Network error'}`);
    }
    setGenerating(false);
  };

  // AI: Enhance the current form (fill in empty fields, improve existing)
  const handleAiEnhance = async () => {
    setEnhancing(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/personas/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentId: selectedAgent || null,
          mode: 'enhance',
          existingPersonas: form,
        }),
      });
      const data = await res.json();
      if (res.ok && data.persona) {
        setForm({
          name: data.persona.name || form.name,
          role: data.persona.role || form.role,
          description: data.persona.description || form.description,
          goals: data.persona.goals || form.goals,
          painPoints: data.persona.painPoints || form.painPoints,
          technicalLevel: data.persona.technicalLevel || form.technicalLevel,
          workflows: data.persona.workflows || form.workflows,
          needs: data.persona.needs || form.needs,
          risks: data.persona.risks || form.risks,
        });
      }
    } catch { /* ignore */ }
    setEnhancing(false);
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <div className="ds-section-title">PERSONAS</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A' }}>
            {project.personas.length} persona{project.personas.length !== 1 ? 's' : ''} defined
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input ref={fileInputRef} type="file" accept=".docx,.doc" onChange={handleImport} style={{ display: 'none' }} />
          <button className="ds-btn-ghost ds-btn-sm" onClick={() => fileInputRef.current?.click()} disabled={importing} style={{ whiteSpace: 'nowrap' }}>
            {importing ? '[ IMPORTING... ]' : '[ IMPORT FILE ]'}
          </button>
          <button className="ds-btn-primary ds-btn-sm" onClick={() => { setShowForm(true); setEditId(null); setForm(emptyForm); }}>
            + ADD PERSONA
          </button>
        </div>
      </div>

      {/* AI Assist Bar — always visible */}
      <div className="ds-card" style={{ borderColor: '#FF2A2A33', padding: '16px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ fontSize: '10px', letterSpacing: '.14em', color: '#FF2A2A', fontWeight: 700, marginRight: '4px' }}>
            AI ASSIST
          </div>
          {agents.length > 0 && (
            <select
              value={selectedAgent}
              onChange={(e) => setSelectedAgent(e.target.value)}
              style={{
                background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#B3B3B3',
                padding: '6px 10px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace',
                minWidth: '200px',
              }}
            >
              <option value="">No agent (default AI)</option>
              {agents.map((a: any) => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          )}
          <button
            className="ds-btn-primary ds-btn-sm"
            onClick={handleAiSuggest}
            disabled={generating}
            style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
          >
            {generating ? '[ GENERATING... ]' : '[ SUGGEST PERSONAS ]'}
          </button>
          <div style={{ fontSize: '10px', color: '#5A5A5A', marginLeft: '4px' }}>
            Generate personas based on product context
          </div>
        </div>
        {generating && (
          <div style={{ marginTop: '10px', fontSize: '10px', color: '#F39C12', letterSpacing: '.1em' }}>
            ● {aiStatus}
          </div>
        )}
        {!generating && aiStatus && (
          <div style={{ marginTop: '10px', fontSize: '10px', letterSpacing: '.1em', color: aiStatus.startsWith('✓') ? '#2ECC71' : '#FF2A2A' }}>
            {aiStatus}
          </div>
        )}
      </div>

      {/* Import status */}
      {importing && (
        <div style={{ padding: '12px 16px', background: '#0D0D0D', border: '1px solid #2A2A2A', fontSize: '11px', color: '#F39C12', letterSpacing: '.1em' }}>
          ● Parsing document and extracting personas with AI... This may take a moment.
        </div>
      )}
      {importResult && (
        <div style={{
          padding: '12px 16px', background: '#0D0D0D',
          border: `1px solid ${importResult.error ? '#FF2A2A' : '#2ECC71'}`,
          fontSize: '11px', letterSpacing: '.1em',
          color: importResult.error ? '#FF2A2A' : '#2ECC71',
        }}>
          {importResult.error ? `✕ ${importResult.error}` : `✓ Successfully imported ${importResult.count} persona${importResult.count !== 1 ? 's' : ''} from document`}
        </div>
      )}

      {/* New / Edit form */}
      {showForm && (
        <div style={{ border: '1px solid #FF2A2A', background: '#0D0D0D', padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <div style={{ fontSize: '12px', letterSpacing: '.14em', color: '#FF2A2A', fontWeight: 700 }}>
              {editId ? 'EDIT PERSONA' : 'NEW PERSONA'}
            </div>
            {/* AI Enhance button inside the form */}
            <button
              className="ds-btn-ghost ds-btn-sm"
              onClick={handleAiEnhance}
              disabled={enhancing}
              style={{ color: '#FF2A2A', borderColor: '#FF2A2A33', fontSize: '10px', letterSpacing: '.1em' }}
            >
              {enhancing ? '[ ENHANCING... ]' : '✦ AI ENHANCE'}
            </button>
          </div>
          {enhancing && (
            <div style={{ marginBottom: '14px', padding: '8px 12px', background: '#111', border: '1px solid #FF2A2A22', fontSize: '10px', color: '#F39C12', letterSpacing: '.1em' }}>
              ● Agent is analyzing and filling in persona details...
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            {fields.map(f => (
              <label key={f.key} className="ds-form-group" style={f.rows > 1 ? { gridColumn: 'span 2' } : {}}>
                <span className="ds-label">{f.label}{f.required ? ' *' : ''}</span>
                {f.rows > 0 ? (
                  <textarea rows={f.rows} value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-textarea" spellCheck={false} />
                ) : (
                  <input type="text" value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-input" spellCheck={false} />
                )}
              </label>
            ))}
          </div>
          <div className="ds-form-row" style={{ marginTop: '20px' }}>
            <button className="ds-btn-primary" onClick={handleSave} disabled={saving}>
              {saving ? 'SAVING...' : editId ? 'UPDATE PERSONA' : 'CREATE PERSONA'}
            </button>
            <button className="ds-btn-ghost" onClick={() => setShowForm(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {project.personas.length === 0 && !showForm && (
        <div style={{ border: '1px solid #2A2A2A', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No personas defined yet.</div>
          <div style={{ marginTop: '8px', color: '#6A6A6A', fontSize: '12px', maxWidth: '400px', margin: '8px auto 0' }}>
            Personas shape requirements, UX decisions, and acceptance criteria. Use the AI Assist above to generate personas, or add them manually.
          </div>
        </div>
      )}

      {/* Persona cards */}
      {project.personas.map((p: any) => (
        <div key={p.id} className="ds-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '14px' }}>{p.name}</span>
              {p.role && <span className="ds-badge">{p.role}</span>}
              {p.technicalLevel && <span className="ds-badge">{p.technicalLevel}</span>}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="ds-btn-ghost ds-btn-sm" onClick={() => openEdit(p)}>EDIT</button>
              <button className="ds-btn-ghost ds-btn-sm" style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }} onClick={() => handleDelete(p.id)}>DELETE</button>
            </div>
          </div>
          {p.description && <div style={{ marginTop: '12px', color: '#B3B3B3', fontSize: '12.5px', lineHeight: 1.6 }}>{p.description}</div>}
          <div style={{ marginTop: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {p.goals && <div><span className="ds-label">GOALS</span><div style={{ marginTop: '4px', color: '#8A8A8A', fontSize: '12px' }}>{p.goals}</div></div>}
            {p.painPoints && <div><span className="ds-label">PAIN POINTS</span><div style={{ marginTop: '4px', color: '#8A8A8A', fontSize: '12px' }}>{p.painPoints}</div></div>}
          </div>
          {(p.workflows || p.needs || p.risks) && (
            <div style={{ marginTop: '12px', display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {p.workflows && <div><span className="ds-label">WORKFLOWS</span><div style={{ marginTop: '4px', color: '#8A8A8A', fontSize: '12px' }}>{p.workflows}</div></div>}
              {p.needs && <div><span className="ds-label">NEEDS</span><div style={{ marginTop: '4px', color: '#8A8A8A', fontSize: '12px' }}>{p.needs}</div></div>}
              {p.risks && <div><span className="ds-label">RISKS</span><div style={{ marginTop: '4px', color: '#8A8A8A', fontSize: '12px' }}>{p.risks}</div></div>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
