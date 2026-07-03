'use client';

import { useState, useCallback } from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/navigation';

interface Requirement { type: 'functional' | 'non-functional'; description: string; priority: string; }
interface GherkinScenario { title: string; given: string; when: string; then: string; status: string; }
interface TechReviewData { notes: string; impactAnalysis: string; risks: string[]; architectureNotes: string; }
interface SubTask { title: string; layer: string; assignee: string; estimate: string; status: string; }
interface PlanningData { subtasks: SubTask[]; totalEstimate: string; notes: string; }

const TABS = [
  { key: 'story', label: 'USER STORY', num: '01' },
  { key: 'requirements', label: 'REQUIREMENTS', num: '02' },
  { key: 'acceptance', label: 'ACCEPTANCE CRITERIA', num: '03' },
  { key: 'gherkin', label: 'GHERKIN SCENARIOS', num: '04' },
  { key: 'techreview', label: 'TECH REVIEW', num: '05' },
  { key: 'planning', label: 'PLANNING', num: '06' },
] as const;

type TabKey = typeof TABS[number]['key'];

const STATUS_COLORS: Record<string, string> = { draft: '#6A6A6A', 'in-progress': '#F39C12', ready: '#2ECC71', done: '#5A5A5A' };
const COMPLEXITY_COLORS: Record<string, string> = { low: '#2ECC71', medium: '#F39C12', high: '#FF2A2A' };

export default function UserStoryDetail({ story: initialStory, project }: { story: any; project: any }) {
  const router = useRouter();
  const [story, setStory] = useState(initialStory);
  const [activeTab, setActiveTab] = useState<TabKey>('story');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const apiUrl = `/api/projects/${project.id}/features/${story.featureId}/stories/${story.id}`;
  const agents: { id: string; name: string; agentType: string }[] = project.agents || [];

  const save = useCallback(async (patch: Record<string, any>) => {
    setSaving(true);
    setSaved(false);
    try {
      const res = await fetch(apiUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (res.ok) {
        const updated = await res.json();
        setStory((prev: any) => ({ ...updated, feature: updated.feature || prev.feature }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } catch { /* */ }
    setSaving(false);
  }, [apiUrl]);

  // --- AI ASSIST ---
  const [aiAgent, setAiAgent] = useState<Record<string, string>>({});
  const [aiLoading, setAiLoading] = useState<Record<string, boolean>>({});
  const [aiDone, setAiDone] = useState<Record<string, boolean>>({});

  const storyContext = `User Story: As a ${story.persona}, I want to ${story.action} so that ${story.benefit}.\nComplexity: ${story.complexity}\nStatus: ${story.status}\nFeature: ${story.feature?.title || 'N/A'}`;

  const tabPrompts: Record<TabKey, string> = {
    story: `Refine and improve this user story. Return ONLY a JSON object with these exact keys: {"persona": "...", "action": "...", "benefit": "...", "complexity": "low|medium|high"}. Make the story specific, measurable, and actionable. Keep the persona name the same.\n\n${storyContext}`,
    requirements: `Generate a comprehensive list of functional and non-functional requirements for this user story. Return ONLY a JSON array, no explanation: [{"type": "functional", "description": "...", "priority": "must"}, {"type": "non-functional", "description": "...", "priority": "should"}]. Use priorities: must, should, could, wont.\n\n${storyContext}`,
    acceptance: `Generate acceptance criteria for this user story. Return ONLY a JSON array of strings, no explanation: ["criterion 1", "criterion 2", ...]. Each should be clear and testable.\n\n${storyContext}`,
    gherkin: `Generate Gherkin (BDD) test scenarios for this user story. Return ONLY a JSON array, no explanation: [{"title": "...", "given": "...", "when": "...", "then": "...", "status": "draft"}]\n\n${storyContext}`,
    techreview: `Perform a technical review of this user story. Return ONLY a JSON object, no explanation: {"notes": "...", "impactAnalysis": "...", "risks": ["risk1", "risk2"], "architectureNotes": "..."}\n\n${storyContext}`,
    planning: `Create an implementation plan with subtasks for this user story. Return ONLY a JSON object, no explanation: {"subtasks": [{"title": "...", "layer": "database|backend|frontend|testing|devops|config", "assignee": "", "estimate": "2h", "status": "todo"}], "totalEstimate": "...", "notes": "..."}\n\n${storyContext}`,
  };

  const runAiAssist = async (tab: TabKey) => {
    const agentId = aiAgent[tab];
    if (!agentId || aiLoading[tab]) return;
    setAiLoading((p) => ({ ...p, [tab]: true }));
    setAiDone((p) => ({ ...p, [tab]: false }));
    try {
      const res = await fetch(`/api/projects/${project.id}/agents/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, message: tabPrompts[tab] }),
      });
      if (!res.ok) { setAiLoading((p) => ({ ...p, [tab]: false })); return; }
      const data = await res.json();
      const raw = data.response || '';

      // Try to extract JSON — handle markdown code fences too
      let jsonStr = '';
      const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (fenced) {
        jsonStr = fenced[1].trim();
      } else {
        const arrMatch = raw.match(/\[[\s\S]*\]/);
        const objMatch = raw.match(/\{[\s\S]*\}/);
        jsonStr = (arrMatch || objMatch)?.[0] || '';
      }

      if (jsonStr) {
        const parsed = JSON.parse(jsonStr);
        let patch: Record<string, any> | null = null;

        if (tab === 'story' && parsed.action) patch = { persona: parsed.persona || story.persona, action: parsed.action, benefit: parsed.benefit || story.benefit, complexity: parsed.complexity || story.complexity };
        else if (tab === 'requirements' && Array.isArray(parsed)) patch = { requirements: parsed };
        else if (tab === 'acceptance' && Array.isArray(parsed)) patch = { acceptanceCriteria: parsed };
        else if (tab === 'gherkin' && Array.isArray(parsed)) patch = { gherkinScenarios: parsed };
        else if (tab === 'techreview') {
          // Normalize field names — AI may use different casing
          patch = { techReview: {
            notes: parsed.notes || parsed.technical_review_notes || parsed.review_notes || parsed.technicalNotes || '',
            impactAnalysis: parsed.impactAnalysis || parsed.impact_analysis || parsed.impact || '',
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            architectureNotes: parsed.architectureNotes || parsed.architecture_notes || parsed.architecture || '',
          }};
        }
        else if (tab === 'planning') {
          // Normalize planning fields
          patch = { planning: {
            subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : (Array.isArray(parsed.tasks) ? parsed.tasks : []),
            totalEstimate: parsed.totalEstimate || parsed.total_estimate || '',
            notes: parsed.notes || parsed.planning_notes || '',
          }};
        }

        console.log(`[AI Assist] Tab: ${tab}, Patch:`, JSON.stringify(patch).substring(0, 200));

        if (patch) {
          // Force synchronous state update so the tab re-mount reads new data
          flushSync(() => {
            setStory((prev: any) => ({ ...prev, ...patch }));
          });
          // Now force tab re-mount — story state is guaranteed to be committed
          setRefreshKey((k) => k + 1);
          // Persist to database in background
          fetch(apiUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });
          setAiDone((p) => ({ ...p, [tab]: true }));
          setTimeout(() => setAiDone((p) => ({ ...p, [tab]: false })), 3000);
        }
      }
    } catch (err) {
      console.error('[AI Assist] Error:', err);
    }
    setAiLoading((p) => ({ ...p, [tab]: false }));
  };

  const AiAssistPanel = ({ tab }: { tab: TabKey }) => (
    <div style={{ marginTop: '16px', borderTop: '1px solid #1F1F1F', paddingTop: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '10px', letterSpacing: '.14em', color: '#FF2A2A', fontWeight: 700 }}>AI ASSIST</span>
        <select
          className="ds-input"
          style={{ width: '220px', fontSize: '11px' }}
          value={aiAgent[tab] || ''}
          onChange={(e) => setAiAgent((p) => ({ ...p, [tab]: e.target.value }))}
        >
          <option value="">Select agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <button
          className="ds-btn-primary ds-btn-sm"
          onClick={() => runAiAssist(tab)}
          disabled={!aiAgent[tab] || aiLoading[tab]}
          style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
        >
          {aiLoading[tab] ? '[ GENERATING... ]' : '[ GENERATE WITH AI ]'}
        </button>
        {aiDone[tab] && (
          <span style={{ fontSize: '10px', color: '#2ECC71', letterSpacing: '.1em', animation: 'dsFadeIn .2s ease-out' }}>
            ● FIELDS UPDATED
          </span>
        )}
      </div>
    </div>
  );

  // --- TAB 1: USER STORY ---
  const StoryTab = () => {
    const [persona, setPersona] = useState(story.persona);
    const [action, setAction] = useState(story.action);
    const [benefit, setBenefit] = useState(story.benefit);
    const [complexity, setComplexity] = useState(story.complexity);
    const [status, setStatus] = useState(story.status);

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>USER STORY DEFINITION</div>
          <div style={{ fontSize: '14px', color: '#B3B3B3', lineHeight: 1.8, marginBottom: '20px', fontStyle: 'italic' }}>
            As a <strong style={{ color: '#FF2A2A' }}>{persona}</strong>, I want to <strong style={{ color: '#FFFFFF' }}>{action}</strong> so that <strong style={{ color: '#2ECC71' }}>{benefit}</strong>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div>
              <div style={labelStyle}>PERSONA</div>
              <select className="ds-input" style={{ width: '100%' }} value={persona} onChange={(e) => setPersona(e.target.value)}>
                {project.personas?.map((p: any) => <option key={p.name} value={p.name}>{p.name} — {p.role}</option>)}
                <option value={persona}>{persona}</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>I WANT TO</div>
              <textarea className="ds-input" style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} value={action} onChange={(e) => setAction(e.target.value)} />
            </div>
            <div>
              <div style={labelStyle}>SO THAT</div>
              <textarea className="ds-input" style={{ width: '100%', minHeight: '60px', resize: 'vertical' }} value={benefit} onChange={(e) => setBenefit(e.target.value)} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={labelStyle}>COMPLEXITY</div>
                <select className="ds-input" style={{ width: '100%' }} value={complexity} onChange={(e) => setComplexity(e.target.value)}>
                  {['low', 'medium', 'high'].map((c) => <option key={c} value={c}>{c.toUpperCase()}</option>)}
                </select>
              </div>
              <div>
                <div style={labelStyle}>STATUS</div>
                <select className="ds-input" style={{ width: '100%' }} value={status} onChange={(e) => setStatus(e.target.value)}>
                  {['draft', 'in-progress', 'ready', 'done'].map((s) => <option key={s} value={s}>{s.toUpperCase()}</option>)}
                </select>
              </div>
            </div>
            <button className="ds-btn-primary ds-btn-sm" style={{ alignSelf: 'flex-start', marginTop: '6px' }}
              onClick={() => save({ persona, action, benefit, complexity, status })}>
              [ SAVE STORY ]
            </button>
          </div>
          <AiAssistPanel tab="story" />
        </div>
      </div>
    );
  };

  // --- TAB 2: REQUIREMENTS ---
  const RequirementsTab = () => {
    const [reqs, setReqs] = useState<Requirement[]>(Array.isArray(story.requirements) ? story.requirements : []);
    const [newReq, setNewReq] = useState<Requirement>({ type: 'functional', description: '', priority: 'must' });

    const addReq = () => {
      if (!newReq.description.trim()) return;
      const updated = [...reqs, newReq];
      setReqs(updated);
      setNewReq({ type: 'functional', description: '', priority: 'must' });
      save({ requirements: updated });
    };

    const removeReq = (i: number) => {
      const updated = reqs.filter((_, idx) => idx !== i);
      setReqs(updated);
      save({ requirements: updated });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>ADD REQUIREMENT</div>
          <div style={{ display: 'grid', gridTemplateColumns: '140px 1fr 120px auto', gap: '8px', alignItems: 'end' }}>
            <div>
              <div style={labelStyle}>TYPE</div>
              <select className="ds-input" style={{ width: '100%' }} value={newReq.type} onChange={(e) => setNewReq({ ...newReq, type: e.target.value as any })}>
                <option value="functional">Functional</option>
                <option value="non-functional">Non-Functional</option>
              </select>
            </div>
            <div>
              <div style={labelStyle}>DESCRIPTION</div>
              <input className="ds-input" style={{ width: '100%' }} value={newReq.description} onChange={(e) => setNewReq({ ...newReq, description: e.target.value })} placeholder="The system shall..." onKeyDown={(e) => e.key === 'Enter' && addReq()} />
            </div>
            <div>
              <div style={labelStyle}>PRIORITY</div>
              <select className="ds-input" style={{ width: '100%' }} value={newReq.priority} onChange={(e) => setNewReq({ ...newReq, priority: e.target.value })}>
                <option value="must">MUST</option>
                <option value="should">SHOULD</option>
                <option value="could">COULD</option>
                <option value="wont">WON&apos;T</option>
              </select>
            </div>
            <button className="ds-btn-primary ds-btn-sm" onClick={addReq}>[ + ]</button>
          </div>
        </div>
        {reqs.length > 0 && (
          <div className="ds-card" style={{ padding: '0' }}>
            {reqs.map((r, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 90px 30px', gap: '12px', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #161616' }}>
                <span style={{ fontSize: '10px', letterSpacing: '.1em', color: r.type === 'functional' ? '#3498DB' : '#9B59B6', textTransform: 'uppercase' }}>{r.type}</span>
                <span style={{ fontSize: '12px', color: '#B3B3B3' }}>{r.description}</span>
                <span style={{ fontSize: '10px', letterSpacing: '.1em', color: r.priority === 'must' ? '#FF2A2A' : r.priority === 'should' ? '#F39C12' : '#6A6A6A' }}>{r.priority.toUpperCase()}</span>
                <span style={{ color: '#3A3A3A', cursor: 'pointer', textAlign: 'center' }} onClick={() => removeReq(i)}>×</span>
              </div>
            ))}
          </div>
        )}
        {reqs.length === 0 && <div style={{ textAlign: 'center', color: '#3A3A3A', padding: '40px', fontSize: '12px' }}>No requirements defined yet</div>}
        <AiAssistPanel tab="requirements" />
      </div>
    );
  };

  // --- TAB 3: ACCEPTANCE CRITERIA ---
  const AcceptanceTab = () => {
    const [criteria, setCriteria] = useState<string[]>(Array.isArray(story.acceptanceCriteria) ? story.acceptanceCriteria : []);
    const [newCrit, setNewCrit] = useState('');

    const addCrit = () => {
      if (!newCrit.trim()) return;
      const updated = [...criteria, newCrit.trim()];
      setCriteria(updated);
      setNewCrit('');
      save({ acceptanceCriteria: updated });
    };

    const removeCrit = (i: number) => {
      const updated = criteria.filter((_, idx) => idx !== i);
      setCriteria(updated);
      save({ acceptanceCriteria: updated });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>ADD ACCEPTANCE CRITERION</div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input className="ds-input" style={{ flex: 1 }} value={newCrit} onChange={(e) => setNewCrit(e.target.value)} placeholder="Given... When... Then..." onKeyDown={(e) => e.key === 'Enter' && addCrit()} />
            <button className="ds-btn-primary ds-btn-sm" onClick={addCrit}>[ + ADD ]</button>
          </div>
        </div>
        {criteria.length > 0 && (
          <div className="ds-card" style={{ padding: '0' }}>
            {criteria.map((c, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #161616' }}>
                <span style={{ color: '#2ECC71', fontSize: '12px', flexShrink: 0 }}>✓</span>
                <span style={{ fontSize: '12px', color: '#B3B3B3', flex: 1 }}>{c}</span>
                <span style={{ color: '#3A3A3A', cursor: 'pointer', flexShrink: 0 }} onClick={() => removeCrit(i)}>×</span>
              </div>
            ))}
          </div>
        )}
        {criteria.length === 0 && <div style={{ textAlign: 'center', color: '#3A3A3A', padding: '40px', fontSize: '12px' }}>No acceptance criteria defined yet</div>}
        <AiAssistPanel tab="acceptance" />
      </div>
    );
  };

  // --- TAB 4: GHERKIN SCENARIOS ---
  const GherkinTab = () => {
    const [scenarios, setScenarios] = useState<GherkinScenario[]>(Array.isArray(story.gherkinScenarios) ? story.gherkinScenarios : []);
    const [newScenario, setNewScenario] = useState<GherkinScenario>({ title: '', given: '', when: '', then: '', status: 'draft' });
    const [showForm, setShowForm] = useState(false);

    const addScenario = () => {
      if (!newScenario.title.trim() || !newScenario.given.trim()) return;
      const updated = [...scenarios, newScenario];
      setScenarios(updated);
      setNewScenario({ title: '', given: '', when: '', then: '', status: 'draft' });
      setShowForm(false);
      save({ gherkinScenarios: updated });
    };

    const removeScenario = (i: number) => {
      const updated = scenarios.filter((_, idx) => idx !== i);
      setScenarios(updated);
      save({ gherkinScenarios: updated });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {!showForm && (
          <button className="ds-btn-primary ds-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={() => setShowForm(true)}>[ + NEW SCENARIO ]</button>
        )}
        {showForm && (
          <div className="ds-card" style={{ padding: '20px', borderColor: '#FF2A2A33' }}>
            <div className="ds-label" style={{ marginBottom: '14px', color: '#FF2A2A' }}>NEW GHERKIN SCENARIO</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div>
                <div style={labelStyle}>SCENARIO TITLE</div>
                <input className="ds-input" style={{ width: '100%' }} value={newScenario.title} onChange={(e) => setNewScenario({ ...newScenario, title: e.target.value })} placeholder="e.g. Successful login with valid credentials" />
              </div>
              <div>
                <div style={labelStyle}>GIVEN</div>
                <textarea className="ds-input" style={{ width: '100%', minHeight: '50px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={newScenario.given} onChange={(e) => setNewScenario({ ...newScenario, given: e.target.value })} placeholder="the user is on the login page" />
              </div>
              <div>
                <div style={labelStyle}>WHEN</div>
                <textarea className="ds-input" style={{ width: '100%', minHeight: '50px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={newScenario.when} onChange={(e) => setNewScenario({ ...newScenario, when: e.target.value })} placeholder="they enter valid credentials and click login" />
              </div>
              <div>
                <div style={labelStyle}>THEN</div>
                <textarea className="ds-input" style={{ width: '100%', minHeight: '50px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={newScenario.then} onChange={(e) => setNewScenario({ ...newScenario, then: e.target.value })} placeholder="they are redirected to the dashboard" />
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button className="ds-btn-primary ds-btn-sm" onClick={addScenario}>[ ADD SCENARIO ]</button>
                <button className="ds-btn-ghost ds-btn-sm" onClick={() => setShowForm(false)}>CANCEL</button>
              </div>
            </div>
          </div>
        )}
        {scenarios.map((s, i) => (
          <div key={i} className="ds-card" style={{ padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>Scenario: {s.title}</span>
              <span style={{ color: '#3A3A3A', cursor: 'pointer' }} onClick={() => removeScenario(i)}>×</span>
            </div>
            <div style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '11px', lineHeight: 1.8 }}>
              <div><span style={{ color: '#9B59B6' }}>Given </span><span style={{ color: '#B3B3B3' }}>{s.given}</span></div>
              <div><span style={{ color: '#3498DB' }}>When </span><span style={{ color: '#B3B3B3' }}>{s.when}</span></div>
              <div><span style={{ color: '#2ECC71' }}>Then </span><span style={{ color: '#B3B3B3' }}>{s.then}</span></div>
            </div>
          </div>
        ))}
        {scenarios.length === 0 && !showForm && <div style={{ textAlign: 'center', color: '#3A3A3A', padding: '40px', fontSize: '12px' }}>No Gherkin scenarios defined yet</div>}
        <AiAssistPanel tab="gherkin" />
      </div>
    );
  };

  // --- TAB 5: TECH REVIEW ---
  const TechReviewTab = () => {
    const existing = (story.techReview || {}) as Partial<TechReviewData>;
    const [notes, setNotes] = useState(existing.notes || '');
    const [impact, setImpact] = useState(existing.impactAnalysis || '');
    const [risks, setRisks] = useState<string[]>(existing.risks || []);
    const [archNotes, setArchNotes] = useState(existing.architectureNotes || '');
    const [newRisk, setNewRisk] = useState('');

    const addRisk = () => {
      if (!newRisk.trim()) return;
      setRisks([...risks, newRisk.trim()]);
      setNewRisk('');
    };

    const saveTechReview = () => {
      save({ techReview: { notes, impactAnalysis: impact, risks, architectureNotes: archNotes } });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>TECHNICAL REVIEW NOTES</div>
          <textarea className="ds-input" style={{ width: '100%', minHeight: '100px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Implementation approach, design decisions, technical constraints..." />
        </div>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>IMPACT ANALYSIS</div>
          <textarea className="ds-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={impact} onChange={(e) => setImpact(e.target.value)} placeholder="Which layers, components, APIs, and models are affected..." />
        </div>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px', color: '#FF2A2A' }}>RISKS</div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
            <input className="ds-input" style={{ flex: 1 }} value={newRisk} onChange={(e) => setNewRisk(e.target.value)} placeholder="Potential risk..." onKeyDown={(e) => e.key === 'Enter' && addRisk()} />
            <button className="ds-btn-ghost ds-btn-sm" onClick={addRisk}>[ + ]</button>
          </div>
          {risks.map((r, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', fontSize: '12px' }}>
              <span style={{ color: '#FF2A2A' }}>⚠</span>
              <span style={{ color: '#FF9A9A', flex: 1 }}>{r}</span>
              <span style={{ color: '#3A3A3A', cursor: 'pointer' }} onClick={() => setRisks(risks.filter((_, idx) => idx !== i))}>×</span>
            </div>
          ))}
        </div>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>ARCHITECTURE NOTES</div>
          <textarea className="ds-input" style={{ width: '100%', minHeight: '80px', resize: 'vertical', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }} value={archNotes} onChange={(e) => setArchNotes(e.target.value)} placeholder="Patterns to follow, dependencies, integration points..." />
        </div>
        <button className="ds-btn-primary ds-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={saveTechReview}>[ SAVE TECH REVIEW ]</button>
        <AiAssistPanel tab="techreview" />
      </div>
    );
  };

  // --- TAB 6: PLANNING ---
  const PlanningTab = () => {
    const existing = (story.planning || {}) as Partial<PlanningData>;
    const [subtasks, setSubtasks] = useState<SubTask[]>(existing.subtasks || []);
    const [totalEstimate, setTotalEstimate] = useState(existing.totalEstimate || '');
    const [notes, setNotes] = useState(existing.notes || '');
    const [newTask, setNewTask] = useState<SubTask>({ title: '', layer: 'backend', assignee: '', estimate: '', status: 'todo' });

    const addTask = () => {
      if (!newTask.title.trim()) return;
      const updated = [...subtasks, newTask];
      setSubtasks(updated);
      setNewTask({ title: '', layer: 'backend', assignee: '', estimate: '', status: 'todo' });
    };

    const removeTask = (i: number) => {
      setSubtasks(subtasks.filter((_, idx) => idx !== i));
    };

    const layerColors: Record<string, string> = { database: '#9B59B6', backend: '#3498DB', frontend: '#E67E22', testing: '#2ECC71', config: '#7F8C8D', devops: '#1ABC9C' };

    const savePlanning = () => {
      save({ planning: { subtasks, totalEstimate, notes } });
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '14px' }}>ADD SUBTASK</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px 140px 80px auto', gap: '8px', alignItems: 'end' }}>
            <div>
              <div style={labelStyle}>TASK</div>
              <input className="ds-input" style={{ width: '100%' }} value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} placeholder="Task description..." onKeyDown={(e) => e.key === 'Enter' && addTask()} />
            </div>
            <div>
              <div style={labelStyle}>LAYER</div>
              <select className="ds-input" style={{ width: '100%' }} value={newTask.layer} onChange={(e) => setNewTask({ ...newTask, layer: e.target.value })}>
                {Object.keys(layerColors).map((l) => <option key={l} value={l}>{l.toUpperCase()}</option>)}
              </select>
            </div>
            <div>
              <div style={labelStyle}>ASSIGNEE</div>
              <input className="ds-input" style={{ width: '100%' }} value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} placeholder="Name" />
            </div>
            <div>
              <div style={labelStyle}>ESTIMATE</div>
              <input className="ds-input" style={{ width: '100%' }} value={newTask.estimate} onChange={(e) => setNewTask({ ...newTask, estimate: e.target.value })} placeholder="2h" />
            </div>
            <button className="ds-btn-primary ds-btn-sm" onClick={addTask}>[ + ]</button>
          </div>
        </div>
        {subtasks.length > 0 && (
          <div className="ds-card" style={{ padding: '0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 70px 80px 30px', gap: '10px', padding: '10px 16px', borderBottom: '1px solid #1F1F1F', fontSize: '9px', letterSpacing: '.12em', color: '#5A5A5A' }}>
              <span>LAYER</span><span>TASK</span><span>ASSIGNEE</span><span>EST.</span><span>STATUS</span><span></span>
            </div>
            {subtasks.map((t, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 70px 80px 30px', gap: '10px', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #161616', fontSize: '12px' }}>
                <span style={{ fontSize: '10px', letterSpacing: '.08em', color: layerColors[t.layer] || '#6A6A6A' }}>{t.layer.toUpperCase()}</span>
                <span style={{ color: '#B3B3B3' }}>{t.title}</span>
                <span style={{ color: '#7A7A7A' }}>{t.assignee || '—'}</span>
                <span style={{ color: '#F39C12', fontFamily: '"JetBrains Mono", monospace', fontSize: '11px' }}>{t.estimate || '—'}</span>
                <select className="ds-input" style={{ fontSize: '10px', padding: '2px 4px' }} value={t.status} onChange={(e) => { const u = [...subtasks]; u[i] = { ...t, status: e.target.value }; setSubtasks(u); }}>
                  <option value="todo">TODO</option>
                  <option value="in-progress">IN PROGRESS</option>
                  <option value="done">DONE</option>
                </select>
                <span style={{ color: '#3A3A3A', cursor: 'pointer', textAlign: 'center' }} onClick={() => removeTask(i)}>×</span>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '10px' }}>TOTAL ESTIMATE</div>
            <input className="ds-input" style={{ width: '100%' }} value={totalEstimate} onChange={(e) => setTotalEstimate(e.target.value)} placeholder="e.g. 2 days, 16 story points" />
          </div>
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '10px' }}>PLANNING NOTES</div>
            <textarea className="ds-input" style={{ width: '100%', minHeight: '50px', resize: 'vertical' }} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Dependencies, blockers, sprint allocation..." />
          </div>
        </div>
        <button className="ds-btn-primary ds-btn-sm" style={{ alignSelf: 'flex-start' }} onClick={savePlanning}>[ SAVE PLANNING ]</button>
        <AiAssistPanel tab="planning" />
      </div>
    );
  };

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    story: StoryTab,
    requirements: RequirementsTab,
    acceptance: AcceptanceTab,
    gherkin: GherkinTab,
    techreview: TechReviewTab,
    planning: PlanningTab,
  };

  const ActiveContent = tabContent[activeTab];

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* Breadcrumb + Header */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#5A5A5A', marginBottom: '12px' }}>
          <span style={{ cursor: 'pointer', borderBottom: '1px solid #2A2A2A' }} onClick={() => router.push(`/projects/${project.id}/features`)}>Features</span>
          <span>›</span>
          <span style={{ color: '#7A7A7A' }}>{story.feature.title}</span>
          <span>›</span>
          <span style={{ color: '#B3B3B3' }}>User Story</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ fontSize: '16px', color: '#FFFFFF', fontWeight: 700 }}>
            As a <span style={{ color: '#FF2A2A' }}>{story.persona}</span>, I want to {story.action}
          </div>
          <span style={{ padding: '2px 10px', fontSize: '10px', letterSpacing: '.1em', border: `1px solid ${STATUS_COLORS[story.status] || '#6A6A6A'}`, color: STATUS_COLORS[story.status] || '#6A6A6A' }}>
            {story.status.toUpperCase()}
          </span>
          <span style={{ padding: '2px 10px', fontSize: '10px', letterSpacing: '.1em', border: `1px solid ${COMPLEXITY_COLORS[story.complexity] || '#6A6A6A'}`, color: COMPLEXITY_COLORS[story.complexity] || '#6A6A6A' }}>
            {story.complexity.toUpperCase()}
          </span>
        </div>
        {/* Save indicator */}
        {(saving || saved) && (
          <div style={{ marginTop: '8px', fontSize: '10px', letterSpacing: '.1em', color: saving ? '#F39C12' : '#2ECC71' }}>
            {saving ? '● SAVING...' : '● SAVED'}
          </div>
        )}
      </div>

      {/* Tab Pipeline */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1F1F1F' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              style={{
                flex: 1,
                padding: '14px 0',
                background: 'transparent',
                border: 'none',
                borderBottom: `2px solid ${isActive ? '#FF2A2A' : 'transparent'}`,
                color: isActive ? '#FF2A2A' : '#5A5A5A',
                fontSize: '10px',
                letterSpacing: '.12em',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all .15s ease',
              }}
            >
              <span style={{ fontSize: '9px', color: isActive ? '#FF2A2A' : '#3A3A3A', fontFamily: '"JetBrains Mono", monospace' }}>{tab.num}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div style={{ animation: 'dsFadeIn .2s ease-out' }} key={`${activeTab}-${refreshKey}`}>
        <ActiveContent />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' };
