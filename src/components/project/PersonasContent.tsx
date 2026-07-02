'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function PersonasContent({ project }: { project: any }) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', role: '', description: '', goals: '', painPoints: '', technicalLevel: '', workflows: '', needs: '', risks: '' });
  const [saving, setSaving] = useState(false);

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
    setForm({ name: '', role: '', description: '', goals: '', painPoints: '', technicalLevel: '', workflows: '', needs: '', risks: '' });
    router.refresh();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this persona?')) return;
    await fetch(`/api/projects/${project.id}/personas?personaId=${id}`, { method: 'DELETE' });
    router.refresh();
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div className="ds-section-title">PERSONAS</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A' }}>{project.personas.length} persona{project.personas.length !== 1 ? 's' : ''} defined</div>
        </div>
        <button className="ds-btn-primary ds-btn-sm" onClick={() => { setShowForm(true); setEditId(null); setForm({ name: '', role: '', description: '', goals: '', painPoints: '', technicalLevel: '', workflows: '', needs: '', risks: '' }); }}>+ ADD PERSONA</button>
      </div>

      {showForm && (
        <div style={{ border: '1px solid #FF2A2A', background: '#0D0D0D', padding: '24px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '.14em', color: '#FF2A2A', marginBottom: '20px', fontWeight: 700 }}>{editId ? 'EDIT PERSONA' : 'NEW PERSONA'}</div>
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
            <button className="ds-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'SAVING...' : editId ? 'UPDATE PERSONA' : 'CREATE PERSONA'}</button>
            <button className="ds-btn-ghost" onClick={() => setShowForm(false)}>CANCEL</button>
          </div>
        </div>
      )}

      {project.personas.length === 0 && !showForm && (
        <div style={{ border: '1px solid #2A2A2A', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No personas defined yet.</div>
          <div style={{ marginTop: '8px', color: '#6A6A6A', fontSize: '12px' }}>Personas shape requirements, UX decisions, and acceptance criteria.</div>
        </div>
      )}

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
        </div>
      ))}
    </div>
  );
}
