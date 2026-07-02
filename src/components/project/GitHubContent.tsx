'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function GitHubContent({ project }: { project: any }) {
  const router = useRouter();
  const conn = project.githubConnection;
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [disconnecting, setDisconnecting] = useState(false);

  const handleRescan = async () => {
    if (!conn) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/github/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          connectionId: conn.id,
          owner: conn.owner,
          repo: conn.repository,
          branch: conn.defaultBranch || 'main',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanResult(data.scan);
        router.refresh();
      }
    } catch (e) {
      console.error('Rescan error:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await fetch(`/api/projects/${project.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ disconnectGithub: true }),
      });
      router.refresh();
    } catch (e) {
      console.error('Disconnect error:', e);
    } finally {
      setDisconnecting(false);
    }
  };

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
                { label: 'last scanned', value: conn.lastScannedAt ? new Date(conn.lastScannedAt).toLocaleString() : 'never' },
              ].map((item, i) => (
                <div key={i} style={{ minWidth: '140px' }}>
                  <div style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em', marginBottom: '4px' }}>{item.label}</div>
                  <div style={{ fontSize: '13px', color: item.color || '#FFFFFF' }}>{item.value}</div>
                </div>
              ))}
            </div>
            {conn.accessTokenEncrypted && (
              <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71', display: 'inline-block' }} />
                <span style={{ fontSize: '11px', color: '#2ECC71' }}>OAuth token active — full permissions granted</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button className="ds-btn-ghost ds-btn-sm" onClick={handleRescan} disabled={scanning}>
              {scanning ? '[ SCANNING... ]' : 'RESCAN REPOSITORY'}
            </button>
            <button className="ds-btn-ghost ds-btn-sm" onClick={() => router.push('/projects/connect-github')}>CHANGE REPOSITORY</button>
            <button
              className="ds-btn-ghost ds-btn-sm"
              style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }}
              onClick={handleDisconnect}
              disabled={disconnecting}
            >
              {disconnecting ? 'DISCONNECTING...' : 'DISCONNECT'}
            </button>
          </div>

          {/* Live scan result */}
          {scanResult && (
            <div className="ds-card" style={{ animation: 'dsFadeIn .3s ease-out' }}>
              <div className="ds-label" style={{ marginBottom: '14px' }}>LIVE SCAN RESULTS</div>
              {scanResult.languages && (
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em' }}>LANGUAGES </span>
                  <span style={{ fontSize: '12px', color: '#B3B3B3' }}>{scanResult.languages}</span>
                </div>
              )}
              {scanResult.frameworks?.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {scanResult.frameworks.map((f: string) => (
                    <span key={f} className="ds-badge" style={{ color: '#2ECC71' }}>{f}</span>
                  ))}
                </div>
              )}
              {scanResult.fileTreeSummary && (
                <div style={{ fontSize: '11px', color: '#6A6A6A', marginBottom: '10px' }}>{scanResult.fileTreeSummary}</div>
              )}
              {scanResult.importantFiles?.length > 0 && (
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em' }}>KEY FILES </span>
                  <div style={{ marginTop: '6px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {scanResult.importantFiles.map((f: string) => (
                      <span key={f} className="ds-badge">{f}</span>
                    ))}
                  </div>
                </div>
              )}
              {scanResult.metadata && (
                <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {[
                    { label: 'total files', value: scanResult.metadata.totalFiles },
                    { label: 'stars', value: scanResult.metadata.stars },
                    { label: 'forks', value: scanResult.metadata.forks },
                    { label: 'open issues', value: scanResult.metadata.openIssues },
                    { label: 'visibility', value: scanResult.metadata.visibility },
                  ].map(m => (
                    <div key={m.label}>
                      <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.1em' }}>{m.label}</div>
                      <div style={{ fontSize: '13px', color: '#FFFFFF', marginTop: '2px' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}
              {scanResult.readmePreview && (
                <div style={{ marginTop: '14px', borderTop: '1px solid #1F1F1F', paddingTop: '14px' }}>
                  <div style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em', marginBottom: '8px' }}>README PREVIEW</div>
                  <div style={{ fontSize: '11px', color: '#8A8A8A', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: '200px', overflow: 'auto' }}>
                    {scanResult.readmePreview}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Stored scan history */}
          {conn.scans?.length > 0 && !scanResult && (
            <div className="ds-card">
              <div className="ds-label" style={{ marginBottom: '14px' }}>LATEST SCAN</div>
              <div style={{ color: '#8A8A8A', fontSize: '12px' }}>
                Scanned: {new Date(conn.scans[0].createdAt).toLocaleString()}
              </div>
              {conn.scans[0].detectedLanguages && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">LANGUAGES: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{conn.scans[0].detectedLanguages}</span>
                </div>
              )}
              {conn.scans[0].detectedFrameworks && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">FRAMEWORKS: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{conn.scans[0].detectedFrameworks}</span>
                </div>
              )}
              {conn.scans[0].fileTreeSummary && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">STRUCTURE: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{conn.scans[0].fileTreeSummary}</span>
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
