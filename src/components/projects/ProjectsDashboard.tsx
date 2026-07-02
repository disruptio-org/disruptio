'use client';

import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { formatRelativeTime } from '@/lib/utils';

interface Project {
  id: string;
  name: string;
  source: string;
  status: string;
  updatedAt: string | Date;
  githubConnection: { repository: string; owner: string } | null;
  agents: { agentType: string; enabled: boolean }[];
}

export default function ProjectsDashboard({ projects, workspaceId }: { projects: Project[]; workspaceId: string }) {
  const router = useRouter();
  const hasProjects = projects.length > 0;

  const agentCodeMap: Record<string, string> = {
    'solution-architect': 'ARC',
    'design': 'DSN',
    'planning': 'PLN',
    'qa-test': 'SPC',
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div className="ds-header">
        <Image src="/logos/logo_white (1).svg" alt="disruptio" width={120} height={20} style={{ height: '20px', width: 'auto' }} />
        <div style={{ display: 'flex', gap: '12px' }}>
          <button className="ds-btn-ghost ds-btn-sm" style={{ letterSpacing: '.1em' }} onClick={() => router.push('/projects/new')}>
            + CREATE PROJECT
          </button>
          <button className="ds-btn-primary ds-btn-sm" style={{ letterSpacing: '.1em' }} onClick={() => router.push('/projects/connect-github')}>
            CONNECT GITHUB
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ flex: 1, padding: '36px 28px', maxWidth: '1240px', width: '100%', margin: '0 auto' }} className="ds-page-enter">
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '14px' }}>
          <div className="ds-section-title">PROJECTS</div>
          <div style={{ fontSize: '12px', color: '#5A5A5A' }}>{projects.length} workspace{projects.length !== 1 ? 's' : ''}</div>
        </div>

        {hasProjects ? (
          <div className="ds-table" style={{ marginTop: '20px' }}>
            <div className="ds-table-header">
              <div>PROJECT NAME</div>
              <div>SOURCE</div>
              <div>CONNECTED REPO</div>
              <div>LAST ACTIVE</div>
              <div>AGENTS</div>
              <div>STATUS</div>
            </div>
            {projects.map(p => (
              <div key={p.id} className="ds-table-row" onClick={() => router.push(`/projects/${p.id}`)}>
                <div style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13.5px' }}>{p.name}</div>
                <div>
                  <span className={p.source === 'github' ? 'ds-badge ds-badge-github' : 'ds-badge ds-badge-manual'}>
                    {p.source === 'github' ? 'GITHUB' : 'MANUAL'}
                  </span>
                </div>
                <div style={{ color: '#9A9A9A', fontSize: '12.5px' }}>
                  {p.githubConnection ? `${p.githubConnection.owner}/${p.githubConnection.repository}` : '—'}
                </div>
                <div style={{ color: '#7A7A7A', fontSize: '12px' }}>{formatRelativeTime(p.updatedAt)}</div>
                <div style={{ display: 'flex', gap: '5px' }}>
                  {p.agents.filter(a => a.enabled).map(a => (
                    <span key={a.agentType} className="ds-badge">{agentCodeMap[a.agentType] || a.agentType.slice(0, 3).toUpperCase()}</span>
                  ))}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <span className={`ds-status-dot ${p.status === 'active' ? 'ds-status-dot--active' : 'ds-status-dot--inactive'}`} />
                  <span style={{ fontSize: '11px', color: '#8A8A8A' }}>{p.status === 'active' ? 'Active' : 'Paused'}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            marginTop: '20px',
            border: '1px solid #2A2A2A',
            padding: '88px 40px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            textAlign: 'center',
          }}>
            <Image src="/logos/icon_white (3).png" alt="" width={44} height={44} style={{ height: '44px', width: 'auto', opacity: 0.35 }} />
            <div style={{ marginTop: '26px', fontSize: '20px', fontWeight: 700, color: '#FFFFFF' }}>
              No active workspaces detected.
            </div>
            <div style={{ marginTop: '12px', maxWidth: '520px', color: '#8A8A8A', fontSize: '13px', lineHeight: 1.65 }}>
              Create a project from scratch to build custom intelligence, or hook your GitHub repository directly to map your codebase structure.
            </div>
            <div style={{ marginTop: '32px', display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
              <button className="ds-btn-ghost" onClick={() => router.push('/projects/new')}>
                [ CREATE PROJECT FROM SCRATCH ]
              </button>
              <button className="ds-btn-primary" onClick={() => router.push('/projects/connect-github')}>
                CONNECT GITHUB REPOSITORY
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
