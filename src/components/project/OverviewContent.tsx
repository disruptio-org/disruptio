'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface OverviewProps {
  project: any;
}

export default function OverviewContent({ project }: OverviewProps) {
  const router = useRouter();
  const [checks, setChecks] = useState<Record<string, { phase: string; ok?: boolean; text?: string }>>({});

  const agentCodeMap: Record<string, string> = {
    'solution-architect': 'ARC',
    'design': 'DSN',
    'planning': 'PLN',
    'qa-test': 'SPC',
  };

  const checklist = [
    { label: 'Define Core Product Context', done: !!project.description, tab: 'context' },
    { label: 'Establish Target User Personas', done: project.personas?.length > 0, tab: 'personas' },
    { label: 'Configure UX/UI & Design Style Guidelines', done: !!project.guidelines, tab: 'ux-ui-guidelines' },
    { label: 'Document Technology Decisions', done: !!project.technology, tab: 'technology' },
    { label: 'Connect GitHub Repository', done: !!project.githubConnection, tab: 'github' },
    { label: 'Configure Agents', done: project.agents?.length > 0, tab: 'agents' },
  ];

  const completedCount = checklist.filter(c => c.done).length;
  const completionPct = Math.round((completedCount / checklist.length) * 100);

  const runCheck = async (agent: any) => {
    if (checks[agent.id]?.phase === 'checking') return;
    setChecks(prev => ({ ...prev, [agent.id]: { phase: 'checking' } }));
    setTimeout(() => {
      const sources = JSON.parse(agent.allowedContext || '[]');
      const ok = completedCount >= 4;
      setChecks(prev => ({
        ...prev,
        [agent.id]: {
          phase: 'done',
          ok,
          text: ok
            ? `CONTEXT OK — ${sources.length} sources compiled`
            : `INCOMPLETE CONTEXT — ${6 - completedCount} modules missing`,
        },
      }));
    }, 1300);
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px' }}>
      <div className="ds-section-title">OVERVIEW</div>

      {/* Top cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px' }}>
        <div className="ds-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span className="ds-label">SETUP COMPLETENESS</span>
            <span style={{ fontSize: '24px', fontWeight: 800, color: 'var(--accent)' }}>{completionPct}%</span>
          </div>
          <div className="ds-progress" style={{ marginTop: '14px' }}>
            <div className="ds-progress-fill" style={{ width: `${completionPct}%` }} />
          </div>
          <div style={{ marginTop: '12px', fontSize: '11.5px', color: 'var(--text-dim)' }}>
            {completedCount} of {checklist.length} context modules configured. Agents run at reduced precision until complete.
          </div>
        </div>
        <div className="ds-card" style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div className="ds-label">REPOSITORY</div>
          {project.githubConnection ? (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-dim)' }}>repo</span>
                <span style={{ color: 'var(--text-primary)' }}>{project.githubConnection.owner}/{project.githubConnection.repository}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-dim)' }}>branch</span>
                <span style={{ color: 'var(--text-primary)' }}>{project.githubConnection.defaultBranch || 'main'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px' }}>
                <span style={{ color: 'var(--text-dim)' }}>access</span>
                <span style={{ color: 'var(--success)' }}>read-only · OK</span>
              </div>
            </>
          ) : (
            <div style={{ color: 'var(--text-faint)', fontSize: '12px' }}>No repository connected</div>
          )}
        </div>
      </div>

      {/* Checklist */}
      <div style={{ border: '1px solid var(--border-default)' }}>
        <div style={{
          padding: '14px 20px', borderBottom: '1px solid var(--border-default)',
          background: 'var(--bg-surface)', fontSize: '11px', letterSpacing: '.14em', color: 'var(--text-muted)',
        }}>SETUP CHECKLIST</div>
        {checklist.map((c, i) => (
          <div
            key={i}
            onClick={() => router.push(`/projects/${project.id}/${c.tab}`)}
            style={{
              display: 'flex', alignItems: 'center', gap: '14px',
              padding: '14px 20px', borderBottom: '1px solid var(--border-subtle)',
              cursor: 'pointer', transition: 'background .1s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{
              fontSize: '14px', width: '22px', textAlign: 'center',
              color: c.done ? 'var(--success)' : 'var(--border-strong)',
            }}>{c.done ? '✓' : '→'}</span>
            <span style={{ flex: 1, color: c.done ? 'var(--text-dim)' : 'var(--text-primary)', fontSize: '13px', textDecoration: c.done ? 'line-through' : 'none' }}>{c.label}</span>
            <span style={{ fontSize: '11px', color: c.done ? 'var(--success)' : 'var(--text-faint)' }}>{c.done ? 'CONFIGURED' : 'PENDING'}</span>
          </div>
        ))}
      </div>

      {/* Agents */}
      <div>
        <div className="ds-label" style={{ marginBottom: '14px' }}>ACTIVE AGENTS</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {project.agents?.map((agent: any) => {
            const code = agentCodeMap[agent.agentType] || agent.agentType.slice(0, 3).toUpperCase();
            const check = checks[agent.id];
            return (
              <div key={agent.id} className="ds-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="ds-code-badge">{code}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>{agent.name}</span>
                  </div>
                  <span style={{
                    fontSize: '10px', letterSpacing: '.08em', padding: '3px 8px',
                    background: agent.enabled ? 'rgba(46,204,113,.12)' : 'var(--bg-hover)',
                    color: agent.enabled ? 'var(--success)' : 'var(--text-faint)',
                    border: `1px solid ${agent.enabled ? 'rgba(46,204,113,.2)' : 'var(--border-input)'}`,
                  }}>{agent.enabled ? 'ACTIVE' : 'DISABLED'}</span>
                </div>
                <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <button className="ds-btn-ghost ds-btn-sm" onClick={() => runCheck(agent)}>
                    {check?.phase === 'checking' ? '[ CHECKING... ]' : '[ RUN CONTEXT CHECK ]'}
                  </button>
                  {check?.phase === 'done' && (
                    <span style={{
                      fontSize: '11px', animation: 'dsFadeIn .2s ease-out',
                      color: check.ok ? 'var(--success)' : 'var(--accent)',
                    }}>{check.text}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
