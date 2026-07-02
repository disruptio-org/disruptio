'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface DiagnosticResult {
  runId: string;
  status: 'healthy' | 'warning' | 'critical';
  completeness: number;
  issues: string[];
  recommendations: string[];
  diagnostic: Record<string, any>;
}

export default function AgentsContent({ project }: { project: any }) {
  const router = useRouter();
  const [agents, setAgents] = useState(project.agents.map((a: any) => ({ ...a, open: false })));
  const [diagnostics, setDiagnostics] = useState<Record<string, { loading: boolean; result?: DiagnosticResult }>>({});

  const agentCodeMap: Record<string, string> = {
    'solution-architect': 'ARC', 'design': 'DSN', 'planning': 'PLN', 'qa-test': 'SPC',
  };

  const statusColors: Record<string, string> = {
    healthy: '#2ECC71', warning: '#F39C12', critical: '#FF2A2A',
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

  const runDryRun = async (agent: any) => {
    setDiagnostics(prev => ({ ...prev, [agent.id]: { loading: true } }));
    try {
      const res = await fetch(`/api/projects/${project.id}/agents/dry-run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id }),
      });
      if (res.ok) {
        const result = await res.json();
        setDiagnostics(prev => ({ ...prev, [agent.id]: { loading: false, result } }));
      } else {
        setDiagnostics(prev => ({ ...prev, [agent.id]: { loading: false } }));
      }
    } catch {
      setDiagnostics(prev => ({ ...prev, [agent.id]: { loading: false } }));
    }
  };

  const renderDiagnosticValue = (key: string, value: any): React.ReactNode => {
    if (typeof value === 'object' && !Array.isArray(value)) {
      return (
        <div style={{ paddingLeft: '14px', borderLeft: '2px solid #1F1F1F' }}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
              <span style={{ color: '#6A6A6A' }}>{k}</span>
              <span style={{ color: typeof v === 'string' && (v.includes('COMPLETE') || v.includes('READY') || v.includes('SCANNED') || v.includes('CAN ')) ? '#2ECC71' : typeof v === 'string' && (v.includes('MISSING') || v.includes('BLOCKED') || v.includes('INSUFFICIENT')) ? '#FF2A2A' : '#B3B3B3' }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: '#2ECC71', fontSize: '11px' }}>None</span>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {value.map((v, i) => <span key={i} style={{ fontSize: '11px', color: '#FF9A9A' }}>• {String(v)}</span>)}
        </div>
      );
    }
    const strVal = String(value);
    const isPositive = strVal.includes('READY') || strVal.includes('COMPLETE') || strVal.includes('HEALTHY');
    const isNegative = strVal.includes('INSUFFICIENT') || strVal.includes('MISSING') || strVal.includes('CRITICAL');
    return <span style={{ fontSize: '12px', color: isPositive ? '#2ECC71' : isNegative ? '#FF2A2A' : '#B3B3B3' }}>{strVal}</span>;
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div>
        <div className="ds-section-title">AGENTS</div>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A' }}>Activation console. Each agent compiles its context sources into a system prompt at run time. Run diagnostics to evaluate context health.</div>
      </div>
      <div style={{ border: '1px solid #1F1F1F' }}>
        {agents.map((agent: any) => {
          const code = agentCodeMap[agent.agentType] || agent.agentType.slice(0, 3).toUpperCase();
          const sources = Array.isArray(agent.allowedContext) ? agent.allowedContext : [];
          const diag = diagnostics[agent.id];
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
                <span style={{ fontSize: '11px', color: '#5A5A5A' }}>
                  {diag?.result ? (
                    <span style={{ color: statusColors[diag.result.status] }}>
                      {diag.result.status.toUpperCase()} · {diag.result.completeness}%
                    </span>
                  ) : 'No diagnostics'}
                </span>
                <button className="ds-btn-ghost ds-btn-sm" onClick={() => toggleDrawer(agent.id)}>{agent.open ? 'COLLAPSE' : 'CONFIGURE'}</button>
              </div>
              {agent.open && (
                <div style={{ borderTop: '1px solid #161616', background: '#0D0D0D', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#6A6A6A' }}>SYSTEM INSTRUCTIONS · PROMPT MODIFIERS</span>
                      <textarea rows={6} value={agent.systemInstructions || ''} onChange={e => updateInstructions(agent, e.target.value)} className="ds-textarea" spellCheck={false} />
                      <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
                        <button
                          className="ds-btn-primary ds-btn-sm"
                          onClick={() => runDryRun(agent)}
                          disabled={diag?.loading}
                          style={{ letterSpacing: '.1em' }}
                        >
                          {diag?.loading ? '[ RUNNING DIAGNOSTIC... ]' : '[ RUN DIAGNOSTIC ]'}
                        </button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', minWidth: 0 }}>
                      <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#6A6A6A' }}>RUN HISTORY</span>
                      <div style={{ border: '1px solid #1F1F1F' }}>
                        {agent.runs?.length > 0 ? agent.runs.slice(0, 5).map((h: any) => (
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

                  {/* Diagnostic Results Panel */}
                  {diag?.result && (
                    <div style={{ borderTop: '1px solid #1F1F1F', paddingTop: '20px', animation: 'dsFadeIn .3s ease-out' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: statusColors[diag.result.status] }} />
                        <span className="ds-label">{diag.result.diagnostic.title || 'DIAGNOSTIC RESULTS'}</span>
                        <span style={{ fontSize: '11px', color: statusColors[diag.result.status], fontWeight: 700 }}>
                          {diag.result.status.toUpperCase()} · {diag.result.completeness}% context completeness
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        {/* Diagnostic details */}
                        <div className="ds-card" style={{ padding: '16px' }}>
                          <div className="ds-label" style={{ marginBottom: '12px' }}>ANALYSIS</div>
                          {Object.entries(diag.result.diagnostic).filter(([k]) => k !== 'title').map(([key, value]) => (
                            <div key={key} style={{ marginBottom: '10px' }}>
                              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                              {renderDiagnosticValue(key, value)}
                            </div>
                          ))}
                        </div>

                        {/* Issues & Recommendations */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {diag.result.issues.length > 0 && (
                            <div className="ds-card" style={{ padding: '16px', borderColor: '#FF2A2A22' }}>
                              <div className="ds-label" style={{ color: '#FF2A2A', marginBottom: '10px' }}>ISSUES ({diag.result.issues.length})</div>
                              {diag.result.issues.map((issue, i) => (
                                <div key={i} style={{ fontSize: '11px', color: '#FF9A9A', marginBottom: '6px', paddingLeft: '14px', borderLeft: '2px solid #FF2A2A44' }}>
                                  {issue}
                                </div>
                              ))}
                            </div>
                          )}
                          {diag.result.recommendations.length > 0 && (
                            <div className="ds-card" style={{ padding: '16px' }}>
                              <div className="ds-label" style={{ color: '#F39C12', marginBottom: '10px' }}>RECOMMENDATIONS</div>
                              {diag.result.recommendations.map((rec, i) => (
                                <div key={i} style={{ fontSize: '11px', color: '#D4A574', marginBottom: '6px', paddingLeft: '14px', borderLeft: '2px solid #F39C1244' }}>
                                  {rec}
                                </div>
                              ))}
                            </div>
                          )}
                          {diag.result.issues.length === 0 && (
                            <div className="ds-card" style={{ padding: '16px', borderColor: '#2ECC7122' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: '#2ECC71', fontSize: '13px' }}>✓</span>
                                <span style={{ fontSize: '12px', color: '#2ECC71' }}>All context checks passed — agent ready</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
