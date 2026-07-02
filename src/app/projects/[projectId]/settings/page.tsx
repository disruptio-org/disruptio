'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const projectId = params.projectId as string;
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    router.push('/projects');
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '600px' }}>
      <div className="ds-section-title">SETTINGS</div>
      <div className="ds-card">
        <div className="ds-label" style={{ marginBottom: '16px' }}>DANGER ZONE</div>
        <div style={{ color: '#8A8A8A', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
          Deleting this project will permanently remove all context, personas, guidelines, agent configurations, and run history. This action cannot be undone.
        </div>
        {!confirmDelete ? (
          <button className="ds-btn-ghost ds-btn-sm" style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }} onClick={() => setConfirmDelete(true)}>DELETE PROJECT</button>
        ) : (
          <div className="ds-form-row">
            <button className="ds-btn-primary" style={{ background: '#FF2A2A' }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'DELETING...' : 'CONFIRM DELETE'}
            </button>
            <button className="ds-btn-ghost" onClick={() => setConfirmDelete(false)}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  );
}
