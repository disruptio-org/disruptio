'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

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
  const confirm = useConfirm();
  const [agents, setAgents] = useState(project.agents.map((a: any) => ({ ...a, open: false })));
  const [diagnostics, setDiagnostics] = useState<Record<string, { loading: boolean; result?: DiagnosticResult }>>({}); 
  const [planFeature, setPlanFeature] = useState('');
  const [planStory, setPlanStory] = useState('');
  const [planning, setPlanning] = useState(false);
  const [implementationPlan, setImplementationPlan] = useState<any>(null);
  const hasKnowledge = !!project.repositoryKnowledge;

  // Agent chat state
  const [chatInputs, setChatInputs] = useState<Record<string, string>>({});
  const [chatLoading, setChatLoading] = useState<Record<string, boolean>>({});
  const [chatResponses, setChatResponses] = useState<Record<string, { response: string; model: string; tokensUsed: { prompt: number; completion: number; total: number } } | null>>({});

  const runAgentChat = async (agentId: string) => {
    const msg = chatInputs[agentId];
    if (!msg?.trim() || chatLoading[agentId]) return;
    setChatLoading((p) => ({ ...p, [agentId]: true }));
    setChatResponses((p) => ({ ...p, [agentId]: null }));
    try {
      const res = await fetch(`/api/projects/${project.id}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message: msg }),
      });
      if (res.ok) {
        const data = await res.json();
        setChatResponses((p) => ({ ...p, [agentId]: data }));
      } else {
        const err = await res.json();
        setChatResponses((p) => ({ ...p, [agentId]: { response: `Error: ${err.error}`, model: 'N/A', tokensUsed: { prompt: 0, completion: 0, total: 0 } } }));
      }
    } catch {
      setChatResponses((p) => ({ ...p, [agentId]: { response: 'Network error', model: 'N/A', tokensUsed: { prompt: 0, completion: 0, total: 0 } } }));
    }
    setChatLoading((p) => ({ ...p, [agentId]: false }));
  };

  // Create agent state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newAgent, setNewAgent] = useState({
    name: '', agentType: '', description: '', systemInstructions: '',
    allowedContext: [] as string[], model: 'gpt-4', temperature: 0.3,
  });

  const CONTEXT_OPTIONS = ['Product Context', 'Tech View', 'GitHub Repo', 'Repository Knowledge', 'Personas', 'UX/UI Rules', 'Design Style', 'Features'];

  const createAgent = async () => {
    if (!newAgent.name.trim() || !newAgent.agentType.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/agents`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAgent),
      });
      if (res.ok) {
        const agent = await res.json();
        setAgents((prev: any[]) => [...prev, { ...agent, open: false }]);
        setNewAgent({ name: '', agentType: '', description: '', systemInstructions: '', allowedContext: [], model: 'gpt-4', temperature: 0.3 });
        setShowCreate(false);
      }
    } catch { /* */ }
    setCreating(false);
  };

  const deleteAgent = async (agentId: string) => {
    const ok = await confirm({ title: 'DELETE AGENT', message: 'Delete this agent? This action cannot be undone.', confirmLabel: 'DELETE', danger: true });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${project.id}/agents?agentId=${agentId}`, { method: 'DELETE' });
      if (res.ok) {
        setAgents((prev: any[]) => prev.filter((a) => a.id !== agentId));
      }
    } catch { /* */ }
  };

  const requestPlan = async () => {
    if (!planFeature.trim() || planning) return;
    setPlanning(true);
    setImplementationPlan(null);
    try {
      const res = await fetch(`/api/projects/${project.id}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: planFeature, userStory: planStory || undefined }),
      });
      if (res.ok) {
        setImplementationPlan(await res.json());
      }
    } catch { /* */ }
    setPlanning(false);
  };

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

  const layerColors: Record<string, string> = {
    database: '#9B59B6', backend: '#3498DB', frontend: '#E67E22', testing: '#2ECC71', config: '#7F8C8D',
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="ds-section-title">AGENTS</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: '#6A6A6A' }}>Activation console. Each agent compiles its context sources into a system prompt at run time. Run diagnostics to evaluate context health.</div>
        </div>
        <button className="ds-btn-primary ds-btn-sm" onClick={() => setShowCreate(true)} style={{ letterSpacing: '.1em' }}>[ + NEW AGENT ]</button>
      </div>

      {/* Create Agent Form */}
      {showCreate && (
        <div className="ds-card" style={{ animation: 'dsFadeIn .2s ease-out', borderColor: '#FF2A2A33' }}>
          <div className="ds-label" style={{ marginBottom: '14px', color: '#FF2A2A' }}>CREATE CUSTOM AGENT</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>AGENT NAME</div>
                <input className="ds-input" style={{ width: '100%' }} value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="e.g. Security Auditor" autoFocus />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>AGENT TYPE (CODE)</div>
                <input className="ds-input" style={{ width: '100%' }} value={newAgent.agentType} onChange={(e) => setNewAgent({ ...newAgent, agentType: e.target.value })} placeholder="e.g. security-auditor" />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>DESCRIPTION</div>
              <input className="ds-input" style={{ width: '100%' }} value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="What does this agent do?" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>SYSTEM INSTRUCTIONS</div>
              <textarea className="ds-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={newAgent.systemInstructions} onChange={(e) => setNewAgent({ ...newAgent, systemInstructions: e.target.value })} placeholder="You are a... Your responsibilities include..." />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '6px' }}>CONTEXT SOURCES</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CONTEXT_OPTIONS.map((ctx) => {
                  const isSelected = newAgent.allowedContext.includes(ctx);
                  return (
                    <button key={ctx} onClick={() => setNewAgent({ ...newAgent, allowedContext: isSelected ? newAgent.allowedContext.filter((c) => c !== ctx) : [...newAgent.allowedContext, ctx] })} style={{ padding: '3px 10px', fontSize: '10px', letterSpacing: '.08em', cursor: 'pointer', background: isSelected ? '#FF2A2A18' : 'transparent', border: `1px solid ${isSelected ? '#FF2A2A' : '#2A2A2A'}`, color: isSelected ? '#FF2A2A' : '#5A5A5A' }}>
                      {ctx}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>MODEL</div>
                <select className="ds-input" style={{ width: '100%', appearance: 'none', cursor: 'pointer' }} value={newAgent.model} onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}>
                  <option value="gpt-4">GPT-4</option>
                  <option value="gpt-4o">GPT-4o</option>
                  <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  <option value="claude-3.5-sonnet">Claude 3.5 Sonnet</option>
                  <option value="gemini-pro">Gemini Pro</option>
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>TEMPERATURE ({newAgent.temperature})</div>
                <input type="range" min="0" max="1" step="0.1" value={newAgent.temperature} onChange={(e) => setNewAgent({ ...newAgent, temperature: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: '#FF2A2A' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button className="ds-btn-primary ds-btn-sm" onClick={createAgent} disabled={creating || !newAgent.name.trim() || !newAgent.agentType.trim()}>
                {creating ? 'CREATING...' : '[ CREATE AGENT ]'}
              </button>
              <button className="ds-btn-ghost ds-btn-sm" onClick={() => setShowCreate(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Implementation Planner — Solution Architect */}
      <div className="ds-card" style={{ borderColor: '#FF2A2A33' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span className="ds-code-badge">ARC</span>
          <span style={{ color: '#FF2A2A', fontWeight: 700, fontSize: '13px', letterSpacing: '.08em' }}>SOLUTION ARCHITECT — IMPLEMENTATION PLANNER</span>
          {hasKnowledge && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: '#2ECC71' }}>● KNOWLEDGE ACTIVE v{project.repositoryKnowledge.scanVersion}</span>
          )}
        </div>

        {!hasKnowledge ? (
          <div style={{ padding: '20px', textAlign: 'center', color: '#6A6A6A', fontSize: '12px', border: '1px dashed #2A2A2A' }}>
            Deep scan required. Go to GitHub Repository → click [ DEEP SCAN — ARCHITECT MODE ] to enable implementation planning.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '6px' }}>FEATURE / REQUIREMENT</div>
                <input
                  type="text"
                  value={planFeature}
                  onChange={(e) => setPlanFeature(e.target.value)}
                  placeholder="e.g. Add user notification system with email and in-app alerts"
                  className="ds-input"
                  style={{ width: '100%' }}
                  onKeyDown={(e) => e.key === 'Enter' && requestPlan()}
                />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '6px' }}>USER STORY (OPTIONAL)</div>
                <input
                  type="text"
                  value={planStory}
                  onChange={(e) => setPlanStory(e.target.value)}
                  placeholder="As a user, I want to receive notifications so I stay informed about project updates"
                  className="ds-input"
                  style={{ width: '100%' }}
                />
              </div>
              <button
                className="ds-btn-primary ds-btn-sm"
                onClick={requestPlan}
                disabled={planning || !planFeature.trim()}
                style={{ alignSelf: 'flex-start', letterSpacing: '.1em', marginTop: '4px' }}
              >
                {planning ? '[ ANALYZING CODEBASE... ]' : '[ GENERATE IMPLEMENTATION PLAN ]'}
              </button>
            </div>

            {/* Implementation Plan Result */}
            {implementationPlan && (
              <div style={{ marginTop: '20px', borderTop: '1px solid #1F1F1F', paddingTop: '20px', animation: 'dsFadeIn .3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#FF2A2A' }} />
                  <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13px' }}>IMPLEMENTATION PLAN</span>
                  <span style={{ fontSize: '10px', color: '#5A5A5A' }}>{implementationPlan.totalSubtasks} subtasks · {implementationPlan.impactAnalysis.affectedLayers.length} layers</span>
                </div>

                {/* Subtasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {implementationPlan.subtasks.map((task: any) => (
                    <div key={task.id} style={{ background: '#0D0D0D', border: '1px solid #1A1A1A', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '9px', padding: '2px 8px', letterSpacing: '.1em', fontWeight: 700,
                          color: layerColors[task.layer] || '#888', border: `1px solid ${layerColors[task.layer] || '#333'}44`,
                          background: `${layerColors[task.layer] || '#333'}11`,
                        }}>
                          {task.layer.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '9px', padding: '2px 6px', color: '#5A5A5A', border: '1px solid #2A2A2A' }}>
                          {task.type.toUpperCase()}
                        </span>
                        <span style={{ color: '#FFFFFF', fontSize: '12.5px', fontWeight: 600 }}>{task.title}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: '9px', letterSpacing: '.08em',
                          color: task.estimatedComplexity === 'high' ? '#FF2A2A' : task.estimatedComplexity === 'medium' ? '#F39C12' : '#2ECC71',
                        }}>
                          {task.estimatedComplexity.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#8A8A8A', lineHeight: 1.5 }}>{task.description}</div>
                      {task.files.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {task.files.map((f: string) => (
                            <span key={f} style={{ fontSize: '10px', color: '#6A6A6A', background: '#151515', padding: '2px 6px', fontFamily: '"JetBrains Mono", monospace' }}>
                              {f}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Impact Analysis */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  {implementationPlan.impactAnalysis.existingFilesToModify.length > 0 && (
                    <div style={{ background: '#0D0D0D', border: '1px solid #1A1A1A', padding: '14px' }}>
                      <div style={{ fontSize: '10px', color: '#F39C12', letterSpacing: '.12em', marginBottom: '8px' }}>FILES TO MODIFY</div>
                      {implementationPlan.impactAnalysis.existingFilesToModify.slice(0, 8).map((f: string) => (
                        <div key={f} style={{ fontSize: '10.5px', color: '#8A8A8A', fontFamily: '"JetBrains Mono", monospace', marginBottom: '3px' }}>{f}</div>
                      ))}
                    </div>
                  )}
                  {implementationPlan.risks.length > 0 && (
                    <div style={{ background: '#0D0D0D', border: '1px solid #FF2A2A22', padding: '14px' }}>
                      <div style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.12em', marginBottom: '8px' }}>RISKS</div>
                      {implementationPlan.risks.map((r: string, i: number) => (
                        <div key={i} style={{ fontSize: '11px', color: '#FF9A9A', marginBottom: '6px', paddingLeft: '10px', borderLeft: '2px solid #FF2A2A33' }}>{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ border: '1px solid #1F1F1F' }}>
        {agents.map((agent: any) => {
          const code = agentCodeMap[agent.agentType] || agent.agentType.slice(0, 3).toUpperCase();
          const sources = Array.isArray(agent.allowedContext) ? agent.allowedContext : [];
          const diag = diagnostics[agent.id];
          return (
            <div key={agent.id} style={{ borderBottom: '1px solid #161616' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto auto auto', gap: '20px', alignItems: 'center', padding: '18px 20px' }}>
                <button className={`ds-toggle ${agent.enabled ? 'ds-toggle--active' : 'ds-toggle--inactive'}`} onClick={() => toggleAgent(agent)}>
                  {agent.enabled ? 'ACTIVE' : 'DISABLED'}
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ds-code-badge">{code}</span>
                    <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '13.5px' }}>{agent.name}</span>
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {sources.map((s: string) => (
                      <span key={s} className="ds-badge">[{s}]</span>
                    ))}
                  </div>
                </div>
                <button
                  className="ds-btn-ghost ds-btn-sm"
                  style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }}
                  onClick={() => deleteAgent(agent.id)}
                >DELETE</button>
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

                  {/* Agent Chat — Run with AI */}
                  <div style={{ borderTop: '1px solid #1F1F1F', paddingTop: '16px' }}>
                    <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: '#FF2A2A' }}>RUN AGENT · OPENAI</span>
                    <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
                      <input
                        className="ds-input"
                        style={{ flex: 1 }}
                        value={chatInputs[agent.id] || ''}
                        onChange={(e) => setChatInputs((p) => ({ ...p, [agent.id]: e.target.value }))}
                        placeholder={`Ask ${agent.name} a question...`}
                        onKeyDown={(e) => e.key === 'Enter' && runAgentChat(agent.id)}
                      />
                      <button
                        className="ds-btn-primary ds-btn-sm"
                        onClick={() => runAgentChat(agent.id)}
                        disabled={chatLoading[agent.id] || !chatInputs[agent.id]?.trim()}
                        style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
                      >
                        {chatLoading[agent.id] ? '[ THINKING... ]' : '[ RUN ]'}
                      </button>
                    </div>
                    {chatResponses[agent.id] && (
                      <div style={{ marginTop: '12px', animation: 'dsFadeIn .2s ease-out' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#2ECC71' }} />
                          <span style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.1em' }}>
                            {chatResponses[agent.id]!.model} · {chatResponses[agent.id]!.tokensUsed.total} tokens
                          </span>
                        </div>
                        <div style={{
                          background: '#0A0A0A', border: '1px solid #1A1A1A', padding: '16px',
                          fontSize: '12px', color: '#B3B3B3', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                          fontFamily: '"JetBrains Mono", monospace', maxHeight: '400px', overflowY: 'auto',
                        }}>
                          {chatResponses[agent.id]!.response}
                        </div>
                      </div>
                    )}
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
