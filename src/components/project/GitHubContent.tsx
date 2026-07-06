'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

export default function GitHubContent({ project }: { project: any }) {
  const router = useRouter();
  const conn = project.githubConnection;
  const agents = project.agents || [];
  const [scanning, setScanning] = useState(false);
  const [deepScanning, setDeepScanning] = useState(false);
  const [scanResult, setScanResult] = useState<any>(null);
  const [deepScanResult, setDeepScanResult] = useState<any>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState(agents[0]?.id || '');

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

  const handleDeepScan = async () => {
    if (!conn) return;
    setDeepScanning(true);
    setDeepScanResult(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/deep-scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: selectedAgent || null }),
      });
      if (res.ok) {
        const data = await res.json();
        setDeepScanResult(data);
        router.refresh();
      }
    } catch (e) {
      console.error('Deep scan error:', e);
    } finally {
      setDeepScanning(false);
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

  // Safely render JSON fields that might be objects
  const renderLanguages = (langs: any) => {
    if (!langs) return null;
    if (typeof langs === 'string') return langs;
    if (typeof langs === 'object') return Object.keys(langs).join(', ');
    return String(langs);
  };

  const renderFrameworks = (frameworks: any) => {
    if (!frameworks) return [];
    if (Array.isArray(frameworks)) return frameworks;
    if (typeof frameworks === 'string') return frameworks.split(', ');
    return [];
  };

  const renderFileTree = (summary: any) => {
    if (!summary) return null;
    if (typeof summary === 'string') return summary;
    if (typeof summary === 'object' && summary.summary) return summary.summary;
    return JSON.stringify(summary);
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

          {/* Agent selector + Deep scan controls */}
          <div className="ds-card" style={{ borderColor: '#FF2A2A33' }}>
            <div className="ds-label" style={{ marginBottom: '14px', color: '#FF2A2A' }}>DEEP SCAN — ARCHITECT MODE</div>
            <div style={{ fontSize: '11px', color: '#6A6A6A', lineHeight: 1.6, marginBottom: '16px' }}>
              Reads every file in the repository and builds a complete architectural understanding.
              Select an agent to produce an AI-powered file-by-file analysis.
            </div>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              {agents.length > 0 && (
                <select
                  value={selectedAgent}
                  onChange={(e) => setSelectedAgent(e.target.value)}
                  style={{
                    background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#B3B3B3',
                    padding: '8px 12px', fontSize: '11px', fontFamily: '"JetBrains Mono", monospace',
                    minWidth: '220px',
                  }}
                >
                  <option value="">No agent (structural scan only)</option>
                  {agents.map((a: any) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              )}
              <button
                className="ds-btn-primary ds-btn-sm"
                onClick={handleDeepScan}
                disabled={deepScanning}
                style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
              >
                {deepScanning ? '[ SCANNING... ]' : '[ RUN DEEP SCAN ]'}
              </button>
            </div>
            {deepScanning && (
              <div style={{ marginTop: '12px', fontSize: '10px', color: '#F39C12', letterSpacing: '.1em' }}>
                ● Reading all repository files and running agent analysis... This may take 30-60 seconds.
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
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

          {/* Deep scan result */}
          {deepScanResult && (
            <div className="ds-card" style={{ animation: 'dsFadeIn .3s ease-out', borderColor: '#FF2A2A33' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF2A2A' }} />
                <div className="ds-label" style={{ color: '#FF2A2A' }}>
                  {deepScanResult.agentUsed ? 'AI-POWERED DEEP SCAN COMPLETE' : 'STRUCTURAL DEEP SCAN COMPLETE'}
                </div>
                <span style={{ fontSize: '10px', color: '#5A5A5A', marginLeft: 'auto' }}>v{deepScanResult.scanVersion}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                {[
                  { label: 'FILES READ', value: deepScanResult.filesRead, color: '#2ECC71' },
                  { label: 'API ROUTES', value: deepScanResult.apiRouteCount },
                  { label: 'COMPONENTS', value: deepScanResult.componentCount },
                  { label: 'DB MODELS', value: deepScanResult.modelCount },
                ].map((m) => (
                  <div key={m.label} style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F' }}>
                    <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em' }}>{m.label}</div>
                    <div style={{ fontSize: '22px', color: m.color || '#FFFFFF', fontWeight: 700, marginTop: '6px' }}>{m.value}</div>
                  </div>
                ))}
              </div>

              {/* AI Analysis (detailed) */}
              {deepScanResult.aiAnalysis && (
                <div style={{ background: '#0D0D0D', padding: '18px', border: '1px solid #FF2A2A33', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.12em', marginBottom: '12px', fontWeight: 700 }}>
                    AI ARCHITECTURAL ANALYSIS
                  </div>
                  <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                    <MarkdownRenderer content={deepScanResult.aiAnalysis} />
                  </div>
                </div>
              )}

              {deepScanResult.architectureSummary && !deepScanResult.aiAnalysis && (
                <div style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '8px' }}>ARCHITECTURE SUMMARY</div>
                  <MarkdownRenderer content={deepScanResult.architectureSummary} />
                </div>
              )}
              {deepScanResult.techStackSummary && (
                <div style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F' }}>
                  <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '8px' }}>TECH STACK</div>
                  <pre style={{ fontSize: '11px', color: '#B3B3B3', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                    {deepScanResult.techStackSummary}
                  </pre>
                </div>
              )}
              <div style={{ marginTop: '12px', fontSize: '11px', color: '#2ECC71' }}>
                ✓ Repository knowledge stored. {deepScanResult.agentUsed ? 'AI analysis complete.' : 'Structural scan complete.'} Agents can now use this knowledge.
              </div>
            </div>
          )}

          {/* Live scan result */}
          {scanResult && !deepScanResult && (
            <div className="ds-card" style={{ animation: 'dsFadeIn .3s ease-out' }}>
              <div className="ds-label" style={{ marginBottom: '14px' }}>LIVE SCAN RESULTS</div>
              {scanResult.languages && (
                <div style={{ marginBottom: '10px' }}>
                  <span style={{ fontSize: '10.5px', color: '#6A6A6A', letterSpacing: '.1em' }}>LANGUAGES </span>
                  <span style={{ fontSize: '12px', color: '#B3B3B3' }}>{renderLanguages(scanResult.languages)}</span>
                </div>
              )}
              {scanResult.frameworks?.length > 0 && (
                <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {renderFrameworks(scanResult.frameworks).map((f: string) => (
                    <span key={f} className="ds-badge" style={{ color: '#2ECC71' }}>{f}</span>
                  ))}
                </div>
              )}
              {scanResult.fileTreeSummary && (
                <div style={{ fontSize: '11px', color: '#6A6A6A', marginBottom: '10px' }}>{renderFileTree(scanResult.fileTreeSummary)}</div>
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
          {conn.scans?.length > 0 && !scanResult && !deepScanResult && (
            <div className="ds-card">
              <div className="ds-label" style={{ marginBottom: '14px' }}>LATEST SCAN</div>
              <div style={{ color: '#8A8A8A', fontSize: '12px' }}>
                Scanned: {new Date(conn.scans[0].createdAt).toLocaleString()}
              </div>
              {conn.scans[0].detectedLanguages && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">LANGUAGES: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{renderLanguages(conn.scans[0].detectedLanguages)}</span>
                </div>
              )}
              {conn.scans[0].detectedFrameworks && (
                <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span className="ds-label">FRAMEWORKS: </span>
                  {renderFrameworks(conn.scans[0].detectedFrameworks).map((f: string) => (
                    <span key={f} className="ds-badge" style={{ color: '#2ECC71' }}>{f}</span>
                  ))}
                </div>
              )}
              {conn.scans[0].fileTreeSummary && (
                <div style={{ marginTop: '8px' }}>
                  <span className="ds-label">STRUCTURE: </span>
                  <span style={{ color: '#B3B3B3', fontSize: '12px' }}>{renderFileTree(conn.scans[0].fileTreeSummary)}</span>
                </div>
              )}
            </div>
          )}

          {/* Repository Knowledge — Stored Data (persisted) */}
          {project.repositoryKnowledge && !deepScanResult && (
            <div className="ds-card" style={{ borderColor: '#FF2A2A22' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2ECC71' }} />
                <div className="ds-label" style={{ color: '#2ECC71' }}>
                  {project.repositoryKnowledge.aiAnalysis ? 'AI-POWERED DEEP SCAN — STORED' : 'STRUCTURAL DEEP SCAN — STORED'}
                </div>
                <span style={{ fontSize: '10px', color: '#5A5A5A', marginLeft: 'auto' }}>
                  v{project.repositoryKnowledge.scanVersion} · Updated {new Date(project.repositoryKnowledge.updatedAt).toLocaleString()}
                </span>
              </div>

              {/* Metrics */}
              {project.repositoryKnowledge.architecture && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  {[
                    { label: 'TOTAL FILES', value: project.repositoryKnowledge.architecture.totalFiles, color: '#2ECC71' },
                    { label: 'API ROUTES', value: project.repositoryKnowledge.architecture.apiRouteCount },
                    { label: 'COMPONENTS', value: project.repositoryKnowledge.architecture.componentCount },
                    { label: 'DB MODELS', value: project.repositoryKnowledge.databaseModels ? Object.keys(project.repositoryKnowledge.databaseModels).length : 0 },
                  ].map((m) => (
                    <div key={m.label} style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F' }}>
                      <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em' }}>{m.label}</div>
                      <div style={{ fontSize: '22px', color: m.color || '#FFFFFF', fontWeight: 700, marginTop: '6px' }}>{m.value}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* AI Analysis */}
              {project.repositoryKnowledge.aiAnalysis && (
                <div style={{ background: '#0D0D0D', padding: '18px', border: '1px solid #FF2A2A33', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.12em', marginBottom: '12px', fontWeight: 700 }}>
                    AI ARCHITECTURAL ANALYSIS
                  </div>
                  <div style={{ maxHeight: '600px', overflow: 'auto' }}>
                    <MarkdownRenderer content={project.repositoryKnowledge.aiAnalysis} />
                  </div>
                </div>
              )}

              {/* Architecture summary (fallback if no AI) */}
              {project.repositoryKnowledge.architectureSummary && !project.repositoryKnowledge.aiAnalysis && (
                <div style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F', marginBottom: '12px' }}>
                  <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '8px' }}>ARCHITECTURE SUMMARY</div>
                  <MarkdownRenderer content={project.repositoryKnowledge.architectureSummary} />
                </div>
              )}

              {/* Tech Stack */}
              {project.repositoryKnowledge.techStackSummary && (
                <div style={{ background: '#0D0D0D', padding: '14px', border: '1px solid #1F1F1F' }}>
                  <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '8px' }}>TECH STACK</div>
                  <pre style={{ fontSize: '11px', color: '#B3B3B3', whiteSpace: 'pre-wrap', lineHeight: 1.6, margin: 0, fontFamily: '"JetBrains Mono", monospace' }}>
                    {project.repositoryKnowledge.techStackSummary}
                  </pre>
                </div>
              )}

              <div style={{ marginTop: '12px', fontSize: '11px', color: '#2ECC71' }}>
                ✓ Repository knowledge stored. All agents can use this data for implementation planning and code-aware recommendations.
              </div>
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
