'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { AI_PROVIDERS, getModelsForProvider } from '@/lib/ai-providers';

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

  // Create/Edit agent state
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [editingAgentId, setEditingAgentId] = useState<string | null>(null);
  const emptyAgent = {
    name: '', agentType: '', description: '', systemInstructions: '',
    allowedContext: [] as string[], model: 'gpt-4', temperature: 0.3,
  };
  const [newAgent, setNewAgent] = useState({ ...emptyAgent });

  const CONTEXT_OPTIONS = ['Product Context', 'Tech View', 'GitHub Repo', 'Repository Knowledge', 'Personas', 'UX/UI Rules', 'Design Style', 'Features'];

  // Determine available models from the project's configured provider
  const projectProvider = project.aiProvider || 'openai';
  const availableModels = getModelsForProvider(projectProvider);

  const openEditForm = (agent: any) => {
    setEditingAgentId(agent.id);
    setNewAgent({
      name: agent.name || '',
      agentType: agent.agentType || '',
      description: agent.description || '',
      systemInstructions: agent.systemInstructions || '',
      allowedContext: Array.isArray(agent.allowedContext) ? [...agent.allowedContext] : [],
      model: agent.model || 'gpt-4',
      temperature: agent.temperature ?? 0.3,
    });
    setShowCreate(true);
  };

  const closeForm = () => {
    setShowCreate(false);
    setEditingAgentId(null);
    setNewAgent({ ...emptyAgent });
  };

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
        closeForm();
      }
    } catch { /* */ }
    setCreating(false);
  };

  const updateAgent = async () => {
    if (!editingAgentId || !newAgent.name.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/agents?agentId=${editingAgentId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newAgent.name,
          agentType: newAgent.agentType,
          description: newAgent.description,
          systemInstructions: newAgent.systemInstructions,
          allowedContext: newAgent.allowedContext,
          model: newAgent.model,
          temperature: newAgent.temperature,
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setAgents((prev: any[]) => prev.map((a: any) => a.id === editingAgentId ? { ...a, ...updated, open: a.open } : a));
        closeForm();
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
    healthy: 'var(--success)', warning: 'var(--warning)', critical: 'var(--accent)',
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
        <div style={{ paddingLeft: '14px', borderLeft: '2px solid var(--border-default)' }}>
          {Object.entries(value).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: '11px' }}>
              <span style={{ color: 'var(--text-dim)' }}>{k}</span>
              <span style={{ color: typeof v === 'string' && (v.includes('COMPLETE') || v.includes('READY') || v.includes('SCANNED') || v.includes('CAN ')) ? 'var(--success)' : typeof v === 'string' && (v.includes('MISSING') || v.includes('BLOCKED') || v.includes('INSUFFICIENT')) ? 'var(--accent)' : 'var(--text-secondary)' }}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      );
    }
    if (Array.isArray(value)) {
      if (value.length === 0) return <span style={{ color: 'var(--success)', fontSize: '11px' }}>None</span>;
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {value.map((v, i) => <span key={i} style={{ fontSize: '11px', color: 'var(--accent)' }}>• {String(v)}</span>)}
        </div>
      );
    }
    const strVal = String(value);
    const isPositive = strVal.includes('READY') || strVal.includes('COMPLETE') || strVal.includes('HEALTHY');
    const isNegative = strVal.includes('INSUFFICIENT') || strVal.includes('MISSING') || strVal.includes('CRITICAL');
    return <span style={{ fontSize: '12px', color: isPositive ? 'var(--success)' : isNegative ? 'var(--accent)' : 'var(--text-secondary)' }}>{strVal}</span>;
  };

  const layerColors: Record<string, string> = {
    database: '#9B59B6', backend: '#3498DB', frontend: 'var(--warning)', testing: 'var(--success)', config: 'var(--text-muted)',
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="ds-section-title">AGENTS</div>
          <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--text-dim)' }}>Activation console. Each agent compiles its context sources into a system prompt at run time. Run diagnostics to evaluate context health.</div>
        </div>
        <button className="ds-btn-primary ds-btn-sm" onClick={() => { setEditingAgentId(null); setNewAgent({ ...emptyAgent }); setShowCreate(true); }} style={{ letterSpacing: '.1em' }}>[ + NEW AGENT ]</button>
      </div>

      {/* Create Agent Form */}
      {showCreate && (
        <div className="ds-card" style={{ animation: 'dsFadeIn .2s ease-out', borderColor: '#FF2A2A33' }}>
          <div className="ds-label" style={{ marginBottom: '14px', color: 'var(--accent)' }}>{editingAgentId ? 'EDIT AGENT' : 'CREATE CUSTOM AGENT'}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>AGENT NAME</div>
                <input className="ds-input" style={{ width: '100%' }} value={newAgent.name} onChange={(e) => setNewAgent({ ...newAgent, name: e.target.value })} placeholder="e.g. Security Auditor" autoFocus />
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>AGENT TYPE (CODE)</div>
                <input className="ds-input" style={{ width: '100%' }} value={newAgent.agentType} onChange={(e) => setNewAgent({ ...newAgent, agentType: e.target.value })} placeholder="e.g. security-auditor" disabled={!!editingAgentId} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>DESCRIPTION</div>
              <input className="ds-input" style={{ width: '100%' }} value={newAgent.description} onChange={(e) => setNewAgent({ ...newAgent, description: e.target.value })} placeholder="What does this agent do?" />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>SYSTEM INSTRUCTIONS</div>
              <textarea className="ds-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={newAgent.systemInstructions} onChange={(e) => setNewAgent({ ...newAgent, systemInstructions: e.target.value })} placeholder="You are a... Your responsibilities include..." />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '6px' }}>CONTEXT SOURCES</div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {CONTEXT_OPTIONS.map((ctx) => {
                  const isSelected = newAgent.allowedContext.includes(ctx);
                  return (
                    <button key={ctx} onClick={() => setNewAgent({ ...newAgent, allowedContext: isSelected ? newAgent.allowedContext.filter((c) => c !== ctx) : [...newAgent.allowedContext, ctx] })} style={{ padding: '3px 10px', fontSize: '10px', letterSpacing: '.08em', cursor: 'pointer', background: isSelected ? '#FF2A2A18' : 'transparent', border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-input)'}`, color: isSelected ? 'var(--accent)' : 'var(--text-faint)' }}>
                      {ctx}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>MODEL <span style={{ color: 'var(--border-strong)' }}>({AI_PROVIDERS.find(p => p.id === projectProvider)?.name || projectProvider})</span></div>
                <select className="ds-input" style={{ width: '100%', cursor: 'pointer' }} value={newAgent.model} onChange={(e) => setNewAgent({ ...newAgent, model: e.target.value })}>
                  {availableModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>TEMPERATURE ({newAgent.temperature})</div>
                <input type="range" min="0" max="1" step="0.1" value={newAgent.temperature} onChange={(e) => setNewAgent({ ...newAgent, temperature: parseFloat(e.target.value) })} style={{ width: '100%', accentColor: 'var(--accent)' }} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button className="ds-btn-primary ds-btn-sm" onClick={editingAgentId ? updateAgent : createAgent} disabled={creating || !newAgent.name.trim() || (!editingAgentId && !newAgent.agentType.trim())}>
                {creating ? 'SAVING...' : editingAgentId ? '[ SAVE CHANGES ]' : '[ CREATE AGENT ]'}
              </button>
              <button className="ds-btn-ghost ds-btn-sm" onClick={closeForm}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Implementation Planner — Solution Architect */}
      <div className="ds-card" style={{ borderColor: '#FF2A2A33' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
          <span className="ds-code-badge">ARC</span>
          <span style={{ color: 'var(--accent)', fontWeight: 700, fontSize: '13px', letterSpacing: '.08em' }}>SOLUTION ARCHITECT — IMPLEMENTATION PLANNER</span>
          {hasKnowledge && (
            <span style={{ marginLeft: 'auto', fontSize: '10px', color: 'var(--success)' }}>● KNOWLEDGE ACTIVE v{project.repositoryKnowledge.scanVersion}</span>
          )}
        </div>

        {!hasKnowledge ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '12px', border: '1px dashed var(--border-input)' }}>
            Deep scan required. Go to GitHub Repository → click [ DEEP SCAN — ARCHITECT MODE ] to enable implementation planning.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '6px' }}>FEATURE / REQUIREMENT</div>
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
                <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '6px' }}>USER STORY (OPTIONAL)</div>
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
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-default)', paddingTop: '20px', animation: 'dsFadeIn .3s ease-out' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                  <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--accent)' }} />
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13px' }}>IMPLEMENTATION PLAN</span>
                  <span style={{ fontSize: '10px', color: 'var(--text-faint)' }}>{implementationPlan.totalSubtasks} subtasks · {implementationPlan.impactAnalysis.affectedLayers.length} layers</span>
                </div>

                {/* Subtasks */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
                  {implementationPlan.subtasks.map((task: any) => (
                    <div key={task.id} style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-hover)', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                        <span style={{
                          fontSize: '9px', padding: '2px 8px', letterSpacing: '.1em', fontWeight: 700,
                          color: layerColors[task.layer] || 'var(--text-muted)', border: `1px solid ${layerColors[task.layer] || 'var(--border-input)'}44`,
                          background: `${layerColors[task.layer] || 'var(--border-input)'}11`,
                        }}>
                          {task.layer.toUpperCase()}
                        </span>
                        <span style={{ fontSize: '9px', padding: '2px 6px', color: 'var(--text-faint)', border: '1px solid var(--border-input)' }}>
                          {task.type.toUpperCase()}
                        </span>
                        <span style={{ color: 'var(--text-primary)', fontSize: '12.5px', fontWeight: 600 }}>{task.title}</span>
                        <span style={{
                          marginLeft: 'auto', fontSize: '9px', letterSpacing: '.08em',
                          color: task.estimatedComplexity === 'high' ? 'var(--accent)' : task.estimatedComplexity === 'medium' ? 'var(--warning)' : 'var(--success)',
                        }}>
                          {task.estimatedComplexity.toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{task.description}</div>
                      {task.files.length > 0 && (
                        <div style={{ marginTop: '8px', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          {task.files.map((f: string) => (
                            <span key={f} style={{ fontSize: '10px', color: 'var(--text-dim)', background: 'var(--bg-primary)', padding: '2px 6px', fontFamily: '"JetBrains Mono", monospace' }}>
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
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--bg-hover)', padding: '14px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--warning)', letterSpacing: '.12em', marginBottom: '8px' }}>FILES TO MODIFY</div>
                      {implementationPlan.impactAnalysis.existingFilesToModify.slice(0, 8).map((f: string) => (
                        <div key={f} style={{ fontSize: '10.5px', color: 'var(--text-muted)', fontFamily: '"JetBrains Mono", monospace', marginBottom: '3px' }}>{f}</div>
                      ))}
                    </div>
                  )}
                  {implementationPlan.risks.length > 0 && (
                    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--accent-subtle)', padding: '14px' }}>
                      <div style={{ fontSize: '10px', color: 'var(--accent)', letterSpacing: '.12em', marginBottom: '8px' }}>RISKS</div>
                      {implementationPlan.risks.map((r: string, i: number) => (
                        <div key={i} style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', paddingLeft: '10px', borderLeft: '2px solid var(--accent-subtle)' }}>{r}</div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <div style={{ border: '1px solid var(--border-default)' }}>
        {agents.map((agent: any) => {
          const code = agentCodeMap[agent.agentType] || agent.agentType.slice(0, 3).toUpperCase();
          const sources = Array.isArray(agent.allowedContext) ? agent.allowedContext : [];
          const diag = diagnostics[agent.id];
          return (
            <div key={agent.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr auto auto auto', gap: '20px', alignItems: 'center', padding: '18px 20px' }}>
                <button className={`ds-toggle ${agent.enabled ? 'ds-toggle--active' : 'ds-toggle--inactive'}`} onClick={() => toggleAgent(agent)}>
                  {agent.enabled ? 'ACTIVE' : 'DISABLED'}
                </button>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="ds-code-badge">{code}</span>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 700, fontSize: '13.5px' }}>{agent.name}</span>
                  </div>
                  <div style={{ marginTop: '4px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {sources.map((s: string) => (
                      <span key={s} className="ds-badge">[{s}]</span>
                    ))}
                  </div>
                </div>
                <button
                  className="ds-btn-ghost ds-btn-sm"
                  style={{ color: 'var(--accent)', borderColor: 'var(--accent)' }}
                  onClick={() => deleteAgent(agent.id)}
                >DELETE</button>
                <span style={{ fontSize: '11px', color: 'var(--text-faint)' }}>
                  {diag?.result ? (
                    <span style={{ color: statusColors[diag.result.status] }}>
                      {diag.result.status.toUpperCase()} · {diag.result.completeness}%
                    </span>
                  ) : 'No diagnostics'}
                </span>
                <button className="ds-btn-ghost ds-btn-sm" onClick={() => { if (agent.open) { toggleDrawer(agent.id); } else { openEditForm(agent); } }}>{agent.open ? 'COLLAPSE' : 'CONFIGURE'}</button>
              </div>
              {agent.open && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)', padding: '22px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                      <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: 'var(--text-dim)' }}>SYSTEM INSTRUCTIONS · PROMPT MODIFIERS</span>
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
                      <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: 'var(--text-dim)' }}>RUN HISTORY</span>
                      <div style={{ border: '1px solid var(--border-default)' }}>
                        {agent.runs?.length > 0 ? agent.runs.slice(0, 5).map((h: any) => (
                          <div key={h.id} style={{ display: 'grid', gridTemplateColumns: '1.3fr 100px auto', gap: '12px', alignItems: 'center', padding: '9px 12px', borderBottom: '1px solid var(--border-subtle)', fontSize: '11px' }}>
                            <span style={{ color: 'var(--text-muted)' }}>{new Date(h.createdAt).toLocaleString()}</span>
                            <span style={{ color: h.status === 'completed' ? 'var(--success)' : h.status === 'failed' ? 'var(--accent)' : 'var(--warning)' }}>{h.status.toUpperCase()}</span>
                            <span style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-input)', cursor: 'pointer', justifySelf: 'end' }}>INSPECT</span>
                          </div>
                        )) : (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-ghost)', fontSize: '11px' }}>No runs recorded</div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Agent Chat — Run with AI */}
                  <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '10.5px', letterSpacing: '.14em', color: 'var(--accent)' }}>RUN AGENT · OPENAI</span>
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
                          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--success)' }} />
                          <span style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.1em' }}>
                            {chatResponses[agent.id]!.model} · {chatResponses[agent.id]!.tokensUsed.total} tokens
                          </span>
                        </div>
                        <div style={{
                          background: 'var(--bg-primary)', border: '1px solid var(--bg-hover)', padding: '16px',
                          fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.7, whiteSpace: 'pre-wrap',
                          fontFamily: '"JetBrains Mono", monospace', maxHeight: '400px', overflowY: 'auto',
                        }}>
                          {chatResponses[agent.id]!.response}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Diagnostic Results Panel */}
                  {diag?.result && (
                    <div style={{ borderTop: '1px solid var(--border-default)', paddingTop: '20px', animation: 'dsFadeIn .3s ease-out' }}>
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
                              <div style={{ fontSize: '10px', color: 'var(--text-faint)', letterSpacing: '.12em', marginBottom: '4px' }}>{key.replace(/([A-Z])/g, ' $1').toUpperCase()}</div>
                              {renderDiagnosticValue(key, value)}
                            </div>
                          ))}
                        </div>

                        {/* Issues & Recommendations */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                          {diag.result.issues.length > 0 && (
                            <div className="ds-card" style={{ padding: '16px', borderColor: '#FF2A2A22' }}>
                              <div className="ds-label" style={{ color: 'var(--accent)', marginBottom: '10px' }}>ISSUES ({diag.result.issues.length})</div>
                              {diag.result.issues.map((issue, i) => (
                                <div key={i} style={{ fontSize: '11px', color: 'var(--accent)', marginBottom: '6px', paddingLeft: '14px', borderLeft: '2px solid var(--accent)44' }}>
                                  {issue}
                                </div>
                              ))}
                            </div>
                          )}
                          {diag.result.recommendations.length > 0 && (
                            <div className="ds-card" style={{ padding: '16px' }}>
                              <div className="ds-label" style={{ color: 'var(--warning)', marginBottom: '10px' }}>RECOMMENDATIONS</div>
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
                                <span style={{ color: 'var(--success)', fontSize: '13px' }}>✓</span>
                                <span style={{ fontSize: '12px', color: 'var(--success)' }}>All context checks passed — agent ready</span>
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
