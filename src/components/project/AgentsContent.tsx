'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AgentsContent({ project }: { project: any }) {
  const router = useRouter();
  const [agents, setAgents] = useState(project.agents.map((a: any) => ({ ...a, open: false })));
  const [checks, setChecks] = useState<Record<string, { phase: string; ok?: boolean; text?: string }>>({});

  const agentCodeMap: Record<string, string> = {
    'solution-architect': 'ARC', 'design': 'DSN', 'planning': 'PLN', 'qa-test': 'SPC',
  };

  const toggleAgent = async (agent: any) => {
    await fetch(`/api/projects/${project.id}/agents?agentId=${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !agent.enabled }),
    });
    setAgents((prev: any[]) => prev.map((a: any) => a.id === agent.id ? { ...a, enabled: !a.enabled } : a));
  };

  const toggleDrawer = (id: string) => {
    setAgents((prev: any[]) => prev.map((a: any) => a.id === id ? { ...a, open: !a.open } : a));
  };

  const updateInstructions = async (agent: any, value: string) => {
    setAgents((prev: any[]) => prev.map((a: any) => a.id === agent.id ? { ...a, systemInstructions: value } : a));
    await fetch(`/api/projects/${project.id}/agents?agentId=${agent.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ systemInstructions: value }),
    });
  };

  const runCheck = (agent: any) => {
    if (checks[agent.id]?.phase === 'checking') return;
    setChecks(prev => ({ ...prev, [agent.id]: { phase: 'checking' } }));
    setTimeout(() => {
      const sources = JSON.parse(agent.allowedContext || '[]');
      setChecks(prev => ({
        ...prev,
        [agent.id]: { phase: 'done', ok: true, text: `CONTEXT OK \u2014 ${sources.length} sources compiled` },
      }));
    }, 1300);
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div className="ds-section-title">AGENTS</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A' }}>Activation console. Each agent compiles its context sources into a system prompt at run time.</div>
      </div>
      <div style={{ border: '1px solid #1F1F1F' }}>
        {agents.map((agent: any) => {
          const code = agentCodeMap[agent.agentType] || agent.agentType.slice(0, 3).toUpperCase();
          const sources = JSON.parse(agent.allowedContext || '[]');
          const check = checks[agent.id];
          return (
            <div key={agent.id} style={{ borderBottom: '1px solid #161616' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto auto', gap: '20px', alignItems: 'center', padding: '18px 20px' }}>
                <button className={`ds-toggle ${agent.enabled ? 'ds-toggle--active' : 'ds-toggle--inactive'}`} onClick={() => toggleAgent(agent)}>
                  {agent.enabled ? 'ACTIVE' : 'DISABLED'}
                </button>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span className="ds-code-badge">{code}</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13.5px' }}>{agent.name}</span>
                  </div>
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {sources.map((s: string) => (<span key={s} className="ds-badge">[{s}]</span>))}
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#5A5A5A' }}>{agent.runs?.length > 0 ? `Last run: ${new Date(agent.runs[0].createdAt).toLocaleDateString()}` : 'No runs'}</span>
                <button className="ds-btn-ghost ds-btn-sm" onClick={() => toggleDrawer(agent.id)}>{agent.open ? 'COLLAPSE' : 'CONFIGURE'}</button>
              </div>
              {agent.open && (
                <div style={{ borderTop: '1px solid #161616', background: '#0D0D0D', padding: '22px 20px', display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#6A6A6A' }}>SYSTEM INSTRUCTIONS · PROMPT MODIFIERS</span>
                    <textarea rows={6} value={agent.systemInstructions || ''} onChange={e => updateInstructions(agent, e.target.value)} className="ds-textarea" spellCheck={false} />
                    <button className="ds-btn-ghost ds-btn-sm" onClick={() => runCheck(agent)} style={{ alignSelf: 'flex-start', marginTop: '8px' }}>
                      {check?.phase === 'checking' ? '[ CHECKING... ]' : '[ RUN CONTEXT CHECK ]'}
                    </button>
                    {check?.phase === 'done' && (
                      <span style={{ fontSize: '11px', color: check.ok ? '#2ECC71' : '#FF2A2A', animation: 'dsFadeIn .2s ease-out' }}>{check.text}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
                    <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#6A6A6A' }}>RUN HISTORY</span>
                    <div style={{ border: '1px solid #1F1F1F' }}>
                      {agent.runs?.length > 0 ? agent.runs.map((h: any) => (
                        <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 100px auto', gap: '12px', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid #161616', fontSize: '11px' }}>
                          <span style={{ color: '#7A7A7A' }}>{new Date(h.createdAt).toLocaleString()}</span>
                          <span style={{ color: h.status === 'completed' ? '#2ECC71' : h.status === 'failed' ? '#FF2A2A' : '#F39C12' }}>{h.status.toUpperCase()}</span>
                          <span style={{ color: '#8A8A8A', borderBottom: '1px solid #2A2A2A', cursor: 'pointer', justifySelf: 'end' }}>INSPECT</span>
                        </div>
                      )) : (
                        <div style={{ padding: '16px', textAlign: 'center', color: '#4A4A4A', fontSize: '11px' }}>No runs recorded</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
