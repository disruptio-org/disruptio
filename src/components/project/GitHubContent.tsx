'use client';

import { useRouter } from 'next/navigation';

export default function GitHubContent({ project }: { project: any }) {
  const router = useRouter();
  const conn = project.githubConnection;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div className="ds-section-title">GITHUB REPOSITORY</div>
      {conn ? (
        <>
          <div className="ds-card">
            <div className="ds-label" style={{ marginBottom: '14px' }}>CONNECTION STATUS</div>
            <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
              {[
                { label: 'status', value: conn.status, color: conn.status === 'connected' ? '#2ECC71' : '#FF2A2A' },
                { label: 'owner', value: conn.owner },
                { label: 'repository', value: conn.repository },
                { label: 'branch', value: conn.defaultBranch || 'main' },
                { label: 'url', value: conn.repositoryUrl },
                { label: 'connected', value: new Date(conn.connectedAt).toLocaleDateString() },
              ].map((item, i) => (
                <div key={i} style={{ minWidth: '140px' }}>
                  <div style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: item.color || '#FFFFFF' }}>{item.value}</div>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="ds-btn-ghost ds-btn-sm">RESCAN REPOSITORY</button>
            <button className="ds-btn-ghost ds-btn-sm">CHANGE REPOSITORY</button>
            <button className="ds-btn-ghost ds-btn-sm" style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }}>DISCONNECT</button>
          </div>
          {conn.scans?.length > 0 && (
            <div className="ds-card">
              <div className="ds-label" style={{ marginBottom: '14px' }}>LATEST SCAN</div>
              <div style={{ color: '#8A8A8A', fontSize: '12px' }}>
                Scanned: {new Date(conn.scans[0].createdAt).toLocaleString()}
              </div>
              {conn.scans[0].detectedLanguages && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">DETECTED LANGUAGES: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{conn.scans[0].detectedLanguages}</span>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div style={{ border: '1px solid #2A2A2A', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No repository connected.</div>
          <div style={{ marginTop: '8px', color: '#6A6A6A', fontSize: '12px' }}>Connect a GitHub repository to enable code intelligence.</div>
          <button className="ds-btn-primary" style={{ marginTop: '24px' }} onClick={() => router.push('/projects/connect-github')}>CONNECT REPOSITORY</button>
        </div>
      )}
    </div>
  );
}
