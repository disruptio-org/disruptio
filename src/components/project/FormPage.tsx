'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Field {
  key: string;
  label: string;
  rows: number;
}

interface FormPageProps {
  title: string;
  subtitle: string;
  projectId: string;
  apiPath: string;
  fields: Field[];
  initialData: Record<string, any>;
}

export default function FormPage({ title, subtitle, projectId, apiPath, fields, initialData }: FormPageProps) {
  const router = useRouter();
  const [form, setForm] = useState<Record<string, string>>(
    Object.fromEntries(fields.map(f => [f.key, (initialData as any)?.[f.key] || '']))
  );
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

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
    </div>
  );
}
