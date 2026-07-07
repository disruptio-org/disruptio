'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function CreateProjectPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '', description: '', productType: '', businessGoal: '',
    targetUsers: '', currentStage: '', techStack: '', designNotes: '', repoUrl: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const update = (field: string, value: string) => setForm(prev => ({ ...prev, [field]: value }));

  const handleSubmit = async () => {
    if (!form.name.trim()) { setError('Project name is required'); return; }
    setSaving(true); setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (e: any) {
      setError(e.message);
      setSaving(false);
    }
  };

  const fields = [
    { key: 'name', label: 'PROJECT NAME', required: true, rows: 0 },
    { key: 'description', label: 'PROJECT DESCRIPTION', rows: 3 },
    { key: 'productType', label: 'PRODUCT TYPE', rows: 0 },
    { key: 'businessGoal', label: 'BUSINESS GOAL', rows: 2 },
    { key: 'targetUsers', label: 'TARGET USERS', rows: 2 },
    { key: 'currentStage', label: 'CURRENT STAGE', rows: 0 },
    { key: 'techStack', label: 'TECH STACK (OPTIONAL)', rows: 2 },
    { key: 'designNotes', label: 'DESIGN NOTES (OPTIONAL)', rows: 2 },
    { key: 'repoUrl', label: 'REPOSITORY URL (OPTIONAL)', rows: 0 },
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="ds-header">
        <Image src="/logos/logo_white (1).svg" alt="disruptio" width={120} height={20} style={{ height: '20px', width: 'auto', cursor: 'pointer' }} onClick={() => router.push('/projects')} />
        <button className="ds-btn-ghost ds-btn-sm" onClick={() => router.push('/projects')}>← BACK TO PROJECTS</button>
      </div>
      <div style={{ flex: 1, padding: '36px 28px', maxWidth: '720px', width: '100%', margin: '0 auto' }} className="ds-page-enter">
        <div className="ds-section-title">CREATE PROJECT</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-dim)', lineHeight: 1.6 }}>
          Define your project context. All fields feed into agent intelligence compilation.
        </div>
        <div style={{ marginTop: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {fields.map(f => (
            <label key={f.key} className="ds-form-group">
              <span className="ds-label">{f.label}{f.required ? ' *' : ''}</span>
              {f.rows > 0 ? (
                <textarea rows={f.rows} value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-textarea" spellCheck={false} />
              ) : (
                <input type="text" value={(form as any)[f.key]} onChange={e => update(f.key, e.target.value)} className="ds-input" spellCheck={false} />
              )}
            </label>
          ))}
          {error && <div style={{ color: 'var(--accent)', fontSize: '12px' }}>{error}</div>}
          <div className="ds-form-row">
            <button className="ds-btn-primary" onClick={handleSubmit} disabled={saving}>
              {saving ? 'CREATING...' : 'CREATE PROJECT'}
            </button>
            <button className="ds-btn-ghost" onClick={() => router.push('/projects')}>CANCEL</button>
          </div>
        </div>
      </div>
    </div>
  );
}
