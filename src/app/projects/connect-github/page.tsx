'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';

interface Repo {
  id: number;
  fullName: string;
  owner: string;
  name: string;
  description: string | null;
  visibility: string;
  defaultBranch: string;
  language: string | null;
  updatedAt: string;
  htmlUrl: string;
  permissions: { admin: boolean; push: boolean; pull: boolean };
}

function ConnectGitHubContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState<'connect' | 'select' | 'confirm'>('connect');
  const [repos, setRepos] = useState<Repo[]>([]);
  const [filteredRepos, setFilteredRepos] = useState<Repo[]>([]);
  const [search, setSearch] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [projectName, setProjectName] = useState('');
  const [loading, setLoading] = useState(false);
  const [reposLoading, setReposLoading] = useState(false);
  const [error, setError] = useState('');
  const [ghUser, setGhUser] = useState<{ login: string; avatarUrl: string; name: string } | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanning, setScanning] = useState(false);

  // Check if we returned from GitHub OAuth
  useEffect(() => {
    const authorized = searchParams.get('authorized');
    const oauthError = searchParams.get('error');

    if (oauthError) {
      setError(
        oauthError === 'access_denied'
          ? 'GitHub authorization was denied.'
          : `GitHub authorization failed: ${oauthError}`
      );
    } else if (authorized === 'true') {
      setStep('select');
      fetchRepos();
    }
  }, [searchParams]);

  const fetchRepos = async () => {
    setReposLoading(true);
    setError('');
    try {
      const res = await fetch('/api/github/repos');
      if (!res.ok) throw new Error('Failed to fetch repositories');
      const data = await res.json();
      setRepos(data.repos);
      setFilteredRepos(data.repos);
      setGhUser(data.user);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setReposLoading(false);
    }
  };

  useEffect(() => {
    if (search.trim()) {
      setFilteredRepos(
        repos.filter(r =>
          r.fullName.toLowerCase().includes(search.toLowerCase()) ||
          (r.description?.toLowerCase().includes(search.toLowerCase()))
        )
      );
    } else {
      setFilteredRepos(repos);
    }
  }, [search, repos]);

  const handleAuthorize = () => {
    // Redirect to our authorize endpoint which redirects to GitHub
    window.location.href = '/api/github/authorize';
  };

  const handleSelectRepo = (repo: Repo) => {
    setSelectedRepo(repo);
    setProjectName(repo.name);
    setStep('confirm');
    // Trigger scan
    runScan(repo);
  };

  const runScan = async (repo: Repo) => {
    setScanning(true);
    setScanResult(null);
    try {
      const res = await fetch('/api/github/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner: repo.owner,
          repo: repo.name,
          branch: repo.defaultBranch,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setScanResult(data.scan);
      }
    } catch (e) {
      console.error('Scan error:', e);
    } finally {
      setScanning(false);
    }
  };

  const handleCreate = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: projectName || selectedRepo.name,
          source: 'github',
          githubOwner: selectedRepo.owner,
          githubRepo: selectedRepo.name,
          githubUrl: selectedRepo.htmlUrl,
          defaultBranch: selectedRepo.defaultBranch,
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '48px' }} className="ds-page-enter">
        <div style={{ width: '100%', maxWidth: step === 'select' ? '700px' : '480px' }}>

          {/* Step 1: Authorize */}
          {step === 'connect' && (
            <div style={{ textAlign: 'center' }}>
              <div className="ds-section-title">CONNECT GITHUB REPOSITORY</div>
              <div style={{ marginTop: '16px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.65 }}>
                Authorize disruptio to access your GitHub repositories. Full permissions are requested to enable complete code intelligence and repository management.
              </div>
              <div style={{ marginTop: '28px', border: '1px solid var(--border-default)', padding: '20px', textAlign: 'left' }}>
                <div className="ds-label" style={{ marginBottom: '14px' }}>PERMISSIONS REQUESTED</div>
                {[
                  { scope: 'repo', desc: 'Full control of repositories' },
                  { scope: 'admin:org', desc: 'Organization management' },
                  { scope: 'admin:repo_hook', desc: 'Repository webhooks' },
                  { scope: 'workflow', desc: 'GitHub Actions workflows' },
                  { scope: 'delete_repo', desc: 'Repository deletion' },
                  { scope: 'read:user', desc: 'User profile data' },
                ].map(p => (
                  <div key={p.scope} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--border-subtle)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--success)', fontFamily: 'var(--font-mono)' }}>{p.scope}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{p.desc}</span>
                  </div>
                ))}
              </div>
              {error && <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '16px' }}>{error}</div>}
              <button className="ds-btn-primary" style={{ marginTop: '28px', width: '100%', padding: '15px 0' }} onClick={handleAuthorize}>
                AUTHORIZE GITHUB ACCESS
              </button>
              <div style={{ marginTop: '16px', color: 'var(--text-ghost)', fontSize: '11px' }}>
                You will be redirected to GitHub to grant access
              </div>
            </div>
          )}

          {/* Step 2: Select repository */}
          {step === 'select' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div className="ds-section-title">SELECT REPOSITORY</div>
                  {ghUser && (
                    <div style={{ marginTop: '8px', color: 'var(--text-dim)', fontSize: '12px' }}>
                      Authenticated as <span style={{ color: 'var(--success)' }}>{ghUser.login}</span> · {repos.length} repositories accessible
                    </div>
                  )}
                </div>
              </div>
              <div style={{ marginTop: '20px' }}>
                <input
                  type="text"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search repositories..."
                  className="ds-input"
                  spellCheck={false}
                  style={{ width: '100%' }}
                />
              </div>
              {reposLoading ? (
                <div style={{ marginTop: '40px', textAlign: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
                  <div style={{ animation: 'dsSpin 1s linear infinite', display: 'inline-block', marginBottom: '12px' }}>⟳</div>
                  <br />LOADING REPOSITORIES...
                </div>
              ) : (
                <div style={{ marginTop: '14px', border: '1px solid var(--border-default)', maxHeight: '480px', overflowY: 'auto' }}>
                  {filteredRepos.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '12px' }}>
                      No repositories found
                    </div>
                  ) : (
                    filteredRepos.map(repo => (
                      <div
                        key={repo.id}
                        onClick={() => handleSelectRepo(repo)}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr auto auto',
                          gap: '14px',
                          alignItems: 'center',
                          padding: '14px 16px',
                          borderBottom: '1px solid var(--border-subtle)',
                          cursor: 'pointer',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>{repo.owner}/</span>
                            <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>{repo.name}</span>
                            <span className={`ds-badge ${repo.visibility === 'private' ? 'ds-badge-manual' : 'ds-badge-github'}`}>
                              {repo.visibility.toUpperCase()}
                            </span>
                          </div>
                          {repo.description && (
                            <div style={{ marginTop: '4px', color: 'var(--text-dim)', fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {repo.description}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {repo.language && <span className="ds-badge">{repo.language}</span>}
                        </div>
                        <div style={{ fontSize: '11px', color: 'var(--text-ghost)' }}>
                          {repo.permissions?.admin ? 'admin' : repo.permissions?.push ? 'write' : 'read'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
              {error && <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '12px' }}>{error}</div>}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 'confirm' && selectedRepo && (
            <div>
              <div className="ds-section-title">CONFIRM PROJECT</div>
              <div style={{ marginTop: '20px' }} className="ds-card">
                <div className="ds-label" style={{ marginBottom: '14px' }}>REPOSITORY DETAILS</div>
                {[
                  { label: 'repository', value: selectedRepo.fullName },
                  { label: 'branch', value: selectedRepo.defaultBranch },
                  { label: 'visibility', value: selectedRepo.visibility, color: selectedRepo.visibility === 'private' ? 'var(--warning)' : 'var(--success)' },
                  { label: 'language', value: selectedRepo.language || '—' },
                  { label: 'access', value: selectedRepo.permissions?.admin ? 'admin (full)' : selectedRepo.permissions?.push ? 'write' : 'read', color: 'var(--success)' },
                ].map(item => (
                  <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', marginBottom: '8px' }}>
                    <span style={{ color: 'var(--text-dim)' }}>{item.label}</span>
                    <span style={{ color: item.color || 'var(--text-primary)' }}>{item.value}</span>
                  </div>
                ))}
              </div>

              {/* Scan results */}
              {scanning && (
                <div style={{ marginTop: '16px', padding: '20px', border: '1px solid var(--border-default)', textAlign: 'center' }}>
                  <div style={{ color: 'var(--text-faint)', fontSize: '12px' }}>
                    <span style={{ animation: 'dsSpin 1s linear infinite', display: 'inline-block', marginRight: '8px' }}>⟳</span>
                    SCANNING REPOSITORY...
                  </div>
                </div>
              )}
              {scanResult && (
                <div style={{ marginTop: '16px' }} className="ds-card">
                  <div className="ds-label" style={{ marginBottom: '14px' }}>SCAN RESULTS</div>
                  {scanResult.languages && (
                    <div style={{ marginBottom: '10px' }}>
                      <span style={{ fontSize: '10.5px', color: 'var(--text-dim)', letterSpacing: '.1em' }}>LANGUAGES </span>
                      <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{scanResult.languages}</span>
                    </div>
                  )}
                  {scanResult.frameworks?.length > 0 && (
                    <div style={{ marginBottom: '10px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {scanResult.frameworks.map((f: string) => (
                        <span key={f} className="ds-badge" style={{ color: 'var(--success)' }}>{f}</span>
                      ))}
                    </div>
                  )}
                  {scanResult.fileTreeSummary && (
                    <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{scanResult.fileTreeSummary}</div>
                  )}
                  {scanResult.metadata && (
                    <div style={{ marginTop: '12px', display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      {[
                        { label: 'files', value: scanResult.metadata.totalFiles },
                        { label: 'stars', value: scanResult.metadata.stars },
                        { label: 'forks', value: scanResult.metadata.forks },
                        { label: 'issues', value: scanResult.metadata.openIssues },
                      ].map(m => (
                        <div key={m.label}>
                          <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.1em' }}>{m.label} </span>
                          <span style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{m.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <label className="ds-form-group" style={{ marginTop: '20px' }}>
                <span className="ds-label">PROJECT NAME</span>
                <input type="text" value={projectName} onChange={e => setProjectName(e.target.value)} className="ds-input" />
              </label>
              {error && <div style={{ color: 'var(--accent)', fontSize: '12px', marginTop: '8px' }}>{error}</div>}
              <div className="ds-form-row" style={{ marginTop: '24px' }}>
                <button className="ds-btn-primary" onClick={handleCreate} disabled={loading}>
                  {loading ? 'CREATING...' : 'CREATE PROJECT'}
                </button>
                <button className="ds-btn-ghost" onClick={() => { setStep('select'); setSelectedRepo(null); setScanResult(null); }}>BACK</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConnectGitHubPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-faint)', fontSize: '12px' }}>
        LOADING...
      </div>
    }>
      <ConnectGitHubContent />
    </Suspense>
  );
}
