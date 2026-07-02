'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

export default function ConnectGitHubPage() {
  const router = useRouter();
  const [step, setStep] = useState<'connect' | 'select' | 'confirm'>('connect');
  const [owner, setOwner] = useState('');
  const [repo, setRepo] = useState('');
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = () => {
    setStep('select');
  };

  const handleSelect = () => {
    if (!owner.trim() || !repo.trim()) { setError('Owner and repository name are required'); return; }
    setProjectName(`${owner}/${repo}`);
    setError('');
    setStep('confirm');
  };

  const handleCreate = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName || `${owner}/${repo}`,
          source: 'github',
          githubOwner: owner,
          githubRepo: repo,
          githubUrl: `https://github.com/${owner}/${repo}`,
          defaultBranch: 'main',
        }),
      });
      if (!res.ok) throw new Error('Failed to create project');
      const project = await res.json();
      router.push(`/projects/${project.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="ds-header">
        <Image src="/logos/logo_white (1).svg" alt="disruptio" width={120} height={20} style={{ height: '20px', width: 'auto', cursor: 'pointer' }} onClick={() => router.push('/projects')} />
        <button className="ds-btn-ghost ds-btn-sm" onClick={() => router.push('/projects')}>← BACK</button>
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px' }} className="ds-page-enter">
        <div style={{ width: '100%', maxWidth: '480px' }}>
          {step === 'connect' && (
            <div style={{ textAlign: 'center' }}>
              <div className="ds-section-title">CONNECT GITHUB REPOSITORY</div>
              <div style={{ marginTop: '16px', color: '#8A8A8A', fontSize: '13px', lineHeight: 1.65 }}>
                Authorize disruptio to read your repository structure. Code stays on GitHub — we store metadata and summaries only.
              </div>
              <button className="ds-btn-primary" style={{ marginTop: '32px', width: '100%', padding: '15px 0' }} onClick={handleConnect}>
                AUTHORIZE GITHUB ACCESS
              </button>
              <div style={{ marginTop: '16px', color: '#4A4A4A', fontSize: '11px' }}>Read-only access · contents:read · metadata:read</div>
            </div>
          )}
          {step === 'select' && (
            <div>
              <div className="ds-section-title">SELECT REPOSITORY</div>
              <div style={{ marginTop: '8px', color: '#6A6A6A', fontSize: '12px' }}>Enter your GitHub organization/user and repository name.</div>
              <div style={{ marginTop: '28px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <label className="ds-form-group">
                  <span className="ds-label">OWNER / ORGANIZATION</span>
                  <input type="text" value={owner} onChange={e => setOwner(e.target.value)} className="ds-input" placeholder="e.g. disruptio" spellCheck={false} />
                </label>
                <label className="ds-form-group">
                  <span className="ds-label">REPOSITORY</span>
                  <input type="text" value={repo} onChange={e => setRepo(e.target.value)} className="ds-input" placeholder="e.g. platform" spellCheck={false} />
                </label>
                {error && <div style={{ color: '#FF2A2A', fontSize: '12px' }}>{error}</div>}
                <button className="ds-btn-primary" onClick={handleSelect}>SELECT REPOSITORY</button>
              </div>
            </div>
          )}
          {step === 'confirm' && (
            <div>
              <div className="ds-section-title">CONFIRM PROJECT</div>
              <div style={{ marginTop: '20px' }} className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                  <span style={{ color: '#6A6A6A' }}>repository</span>
                  <span style={{ color: '#FFFFFF' }}>{owner}/{repo}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                  <span style={{ color: '#6A6A6A' }}>branch</span>
                  <span style={{ color: '#FFFFFF' }}>main</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                  <span style={{ color: '#6A6A6A' }}>access</span>
                  <span style={{ color: '#2ECC71' }}>read-only</span>
                </div>
              </div>
              <label className="ds-form-group" style={{ marginTop: '20px' }}>
                <span className="ds-label">PROJECT NAME</span>
                <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="ds-input" />
              </label>
              {error && <div style={{ color: '#FF2A2A', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
              <div className="ds-form-row" style={{ marginTop: '24px' }}>
                <button className="ds-btn-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? 'CREATING...' : 'CREATE PROJECT'}
                </button>
                <button className="ds-btn-ghost" onClick={() => setStep('select')}>BACK</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
