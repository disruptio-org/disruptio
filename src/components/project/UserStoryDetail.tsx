'use client';

import { useState, useCallback, useEffect } from 'react';

import { useRouter } from 'next/navigation';

interface Requirement { type: 'functional' | 'non-functional'; description: string; priority: string; }
interface GherkinScenario { title: string; given: string; when: string; then: string; status: string; }
interface TechReviewData { notes: string; impactAnalysis: string; risks: string[]; architectureNotes: string; }
interface SubTask { title: string; layer: string; assignee: string; estimate: string; status: string; files?: string[]; }
interface PlanningData { subtasks: SubTask[]; totalEstimate: string; notes: string; impactedFiles?: string[]; newFiles?: string[]; conflicts?: { storyId: string; storyTitle: string; sharedFiles: string[] }[]; }

const TABS = [
  { key: 'story', label: 'USER STORY', num: '01' },
  { key: 'requirements', label: 'REQUIREMENTS', num: '02' },
  { key: 'acceptance', label: 'ACCEPTANCE CRITERIA', num: '03' },
  { key: 'gherkin', label: 'GHERKIN SCENARIOS', num: '04' },
  { key: 'mockups', label: 'MOCKUPS', num: '05' },
  { key: 'techreview', label: 'TECH REVIEW', num: '06' },
  { key: 'planning', label: 'PLANNING', num: '07' },
  { key: 'development', label: 'DEVELOPMENT', num: '08' },
  { key: 'codereview', label: 'CODE REVIEW', num: '09' },
  { key: 'ship', label: 'SHIP', num: '10' },
] as const;

type TabKey = typeof TABS[number]['key'];

const STATUS_COLORS: Record<string, string> = { draft: '#6A6A6A', 'in-progress': '#F39C12', ready: '#2ECC71', done: '#5A5A5A' };
const COMPLEXITY_COLORS: Record<string, string> = { low: '#2ECC71', medium: '#F39C12', high: '#FF2A2A' };

export default function UserStoryDetail({ story: initialStory, project }: { story: any; project: any }) {
  const router = useRouter();
  const [story, setStory] = useState(initialStory);
  const [activeTab, setActiveTab] = useState<TabKey>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash.replace('#', '') as TabKey;
      if (['story', 'requirements', 'acceptance', 'gherkin', 'mockups', 'techreview', 'planning'].includes(hash)) return hash;
    }
    return 'story';
  });
  const handleTabChange = (tab: TabKey) => { setActiveTab(tab); window.location.hash = tab; };
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // GitHub Issue state — initialize from persisted data
  const [creatingIssue, setCreatingIssue] = useState(false);
  const [issueResult, setIssueResult] = useState<{ url?: string; number?: number; state?: string; error?: string } | null>(() => {
    if (initialStory.githubIssueUrl && initialStory.githubIssueNumber) {
      return { url: initialStory.githubIssueUrl, number: initialStory.githubIssueNumber, state: initialStory.githubIssueState || 'open' };
    }
    return null;
  });

  // Sync GitHub issue state on mount
  useEffect(() => {
    if (!initialStory.githubIssueNumber) return;
    const syncIssue = async () => {
      try {
        const res = await fetch(`/api/projects/${project.id}/github-issue?storyId=${initialStory.id}`);
        if (res.ok) {
          const data = await res.json();
          setIssueResult(prev => ({
            ...prev,
            url: data.issueUrl,
            number: data.issueNumber,
            state: data.state,
          }));
        }
      } catch { /* silent — we already have cached data */ }
    };
    syncIssue();
  }, [initialStory.id, initialStory.githubIssueNumber, project.id]);

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
    planning: `Create an implementation plan with subtasks for this user story. You MUST identify the specific files from the repository that will be modified or created.

Return ONLY a JSON object, no explanation:
{
  "subtasks": [{"title": "...", "layer": "database|backend|frontend|testing|devops|config", "assignee": "", "estimate": "2h", "status": "todo", "files": ["src/path/to/file.ts"]}],
  "impactedFiles": ["src/existing/file1.ts", "src/existing/file2.ts"],
  "newFiles": ["src/new/file.ts"],
  "totalEstimate": "...",
  "notes": "..."
}

IMPORTANT: The "impactedFiles" array MUST list every existing file that will be MODIFIED. The "newFiles" array MUST list every new file that will be CREATED. Each subtask's "files" array should list the specific files that subtask touches. Reference actual file paths from the repository.

${storyContext}`,
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
          patch = { techReview: {
            notes: parsed.notes || parsed.technical_review_notes || parsed.review_notes || parsed.technicalNotes || '',
            impactAnalysis: parsed.impactAnalysis || parsed.impact_analysis || parsed.impact || '',
            risks: Array.isArray(parsed.risks) ? parsed.risks : [],
            architectureNotes: parsed.architectureNotes || parsed.architecture_notes || parsed.architecture || '',
          }};
        }
        else if (tab === 'planning') {
          patch = { planning: {
            subtasks: Array.isArray(parsed.subtasks) ? parsed.subtasks : (Array.isArray(parsed.tasks) ? parsed.tasks : []),
            totalEstimate: parsed.totalEstimate || parsed.total_estimate || '',
            notes: parsed.notes || parsed.planning_notes || '',
            impactedFiles: Array.isArray(parsed.impactedFiles) ? parsed.impactedFiles : [],
            newFiles: Array.isArray(parsed.newFiles) ? parsed.newFiles : [],
          }};
        }



        if (patch) {
          // Save to DB and wait for it
          const patchRes = await fetch(apiUrl, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          });

          if (patchRes.ok) {
            // Set hash so reload returns to same tab, then reload
            window.location.hash = tab;
            window.location.reload();
            return;
          }
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
  // ── MOCKUPS TAB ──
  const MockupsTab = () => {
    const [mockupPrompt, setMockupPrompt] = useState('');
    const [mockupAgent, setMockupAgent] = useState('');
    const [generatingMockup, setGeneratingMockup] = useState(false);
    const [mockupError, setMockupError] = useState('');
    const [activeMockup, setActiveMockup] = useState(0);
    const [editingHtml, setEditingHtml] = useState(false);
    const [editHtmlValue, setEditHtmlValue] = useState('');
    const [fullscreen, setFullscreen] = useState(false);
    const [viewportSize, setViewportSize] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
    const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
    const mockups: any[] = story.mockups || [];

    const mockupsApiUrl = `/api/projects/${project.id}/features/${story.featureId}/stories/${story.id}/mockups`;
    const [generatingProgress, setGeneratingProgress] = useState('');

    const generateMockup = async (customPrompt?: string) => {
      const isAuto = !customPrompt && !mockupPrompt.trim();
      setGeneratingMockup(true);
      setMockupError('');
      setGeneratingProgress('');

      try {
        if (isAuto) {
          // STEP 1: Plan screens
          setGeneratingProgress('PLANNING SCREENS...');
          const planRes = await fetch(mockupsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ planOnly: true, agentId: mockupAgent || undefined }),
          });
          const planData = await planRes.json();
          if (!planRes.ok) { setMockupError(planData.error || 'Planning failed'); setGeneratingMockup(false); return; }

          const screens: { title: string; description: string }[] = planData.screens || [];
          if (screens.length === 0) { setMockupError('No screens planned'); setGeneratingMockup(false); return; }

          // STEP 2: Generate each screen one by one
          let currentMockups = [...mockups];
          for (let i = 0; i < screens.length; i++) {
            setGeneratingProgress(`GENERATING SCREEN ${i + 1} OF ${screens.length}: ${screens[i].title.toUpperCase()}`);
            const screenRes = await fetch(mockupsApiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                prompt: `${screens[i].title}: ${screens[i].description}`,
                screenTitle: screens[i].title,
                screenDescription: screens[i].description,
                screenIndex: i,
                totalScreens: screens.length,
                agentId: mockupAgent || undefined,
              }),
            });
            const screenData = await screenRes.json();
            if (screenRes.ok && screenData.mockup) {
              currentMockups = [...currentMockups, screenData.mockup];
              setStory((prev: any) => ({ ...prev, mockups: currentMockups }));
              if (i === 0) setActiveMockup(mockups.length);
            }
          }
          setMockupPrompt('');
        } else {
          // Single screen generation
          setGeneratingProgress('GENERATING MOCKUP...');
          const res = await fetch(mockupsApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: customPrompt || mockupPrompt || undefined,
              agentId: mockupAgent || undefined,
            }),
          });
          const data = await res.json();
          if (res.ok && data.mockup) {
            const updated = [...mockups, data.mockup];
            setStory((prev: any) => ({ ...prev, mockups: updated }));
            setActiveMockup(updated.length - 1);
            setMockupPrompt('');
          } else {
            setMockupError(data.error || 'Generation failed');
          }
        }
      } catch (err: any) {
        setMockupError(err.message || 'Network error');
      }
      setGeneratingMockup(false);
      setGeneratingProgress('');
    };

    const updateMockupStatus = async (mockupId: string, status: string) => {
      try {
        await fetch(mockupsApiUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mockupId, status }),
        });
        setStory((prev: any) => ({
          ...prev,
          mockups: (prev.mockups || []).map((m: any) => m.id === mockupId ? { ...m, status } : m),
        }));
      } catch { /* silent */ }
    };

    const saveHtmlEdit = async (mockupId: string) => {
      try {
        await fetch(mockupsApiUrl, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mockupId, html: editHtmlValue }),
        });
        setStory((prev: any) => ({
          ...prev,
          mockups: (prev.mockups || []).map((m: any) => m.id === mockupId ? { ...m, html: editHtmlValue } : m),
        }));
        setEditingHtml(false);
      } catch { /* silent */ }
    };

    const deleteMockup = async (mockupId: string) => {
      try {
        await fetch(`${mockupsApiUrl}?mockupId=${mockupId}`, { method: 'DELETE' });
        const updated = mockups.filter((m: any) => m.id !== mockupId);
        setStory((prev: any) => ({ ...prev, mockups: updated }));
        if (activeMockup >= updated.length) setActiveMockup(Math.max(0, updated.length - 1));
      } catch { /* silent */ }
    };

    const currentMockup = mockups[activeMockup];
    const MOCKUP_STATUS_COLORS: Record<string, string> = { draft: '#6A6A6A', approved: '#2ECC71', rejected: '#FF2A2A' };
    const viewportWidths = { desktop: '100%', tablet: '768px', mobile: '375px' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Generation Controls */}
        <div className="ds-card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <div className="ds-label">GENERATE MOCKUP</div>
            {mockups.length === 0 && (
              <span style={{ fontSize: '9px', color: '#5A5A5A', letterSpacing: '.08em' }}>
                Uses user story, requirements, acceptance criteria, and gherkin scenarios as context
              </span>
            )}
          </div>

          {/* Auto-generate from story — shown when no mockups exist */}
          {mockups.length === 0 && (
            <div style={{
              padding: '20px', background: '#0A0A0A', border: '1px solid #1F1F1F',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '16px',
            }}>
              <div style={{ fontSize: '11px', color: '#B3B3B3', textAlign: 'center', lineHeight: 1.6 }}>
                Generate the initial mockup based on the user story context already defined in this pipeline.
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '9px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>AI AGENT</div>
                  <select
                    className="ds-input"
                    value={mockupAgent}
                    onChange={(e) => setMockupAgent(e.target.value)}
                    style={{ width: '200px', fontSize: '11px' }}
                  >
                    <option value="">Default</option>
                    {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </div>
                <button
                  className="ds-btn-primary"
                  onClick={() => generateMockup()}
                  disabled={generatingMockup}
                  style={{ fontSize: '10px', letterSpacing: '.1em', padding: '10px 24px', whiteSpace: 'nowrap', marginTop: '14px' }}
                >
                  {generatingMockup ? '[ GENERATING... ]' : '[ GENERATE FROM STORY ]'}
                </button>
              </div>
            </div>
          )}

          {/* Custom prompt — always available for additional screens */}
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '9px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>
                {mockups.length > 0 ? 'ADD ANOTHER SCREEN' : 'OR DESCRIBE A SPECIFIC SCREEN'}
              </div>
              <textarea
                className="ds-input"
                value={mockupPrompt}
                onChange={(e) => setMockupPrompt(e.target.value)}
                placeholder={mockups.length > 0
                  ? "Describe the next screen to add... (e.g., 'Settings page with form fields for project configuration')"
                  : "Optionally describe a specific screen instead... (e.g., 'Dashboard with sidebar showing feature list')"}
                rows={2}
                style={{ width: '100%', resize: 'vertical', fontSize: '11px' }}
              />
            </div>
            {mockups.length > 0 && (
              <div>
                <div style={{ fontSize: '9px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>AI AGENT</div>
                <select
                  className="ds-input"
                  value={mockupAgent}
                  onChange={(e) => setMockupAgent(e.target.value)}
                  style={{ width: '200px', fontSize: '11px' }}
                >
                  <option value="">Default</option>
                  {agents.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            )}
            <button
              className="ds-btn-primary"
              onClick={() => generateMockup()}
              disabled={generatingMockup || !mockupPrompt.trim()}
              style={{ fontSize: '10px', letterSpacing: '.1em', padding: '8px 20px', whiteSpace: 'nowrap' }}
            >
              {generatingMockup ? '[ GENERATING... ]' : '[ GENERATE MOCKUP ]'}
            </button>
          </div>
          {mockupError && (
            <div style={{ marginTop: '8px', fontSize: '10px', color: '#FF2A2A' }}>{mockupError}</div>
          )}
          {generatingMockup && (
            <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '14px', height: '14px', border: '2px solid #FF2A2A33', borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'dsSpin 1s linear infinite' }} />
              <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.1em' }}>{generatingProgress || 'GENERATING MOCKUP...'}</span>
            </div>
          )}
        </div>

        {/* Screen Tabs */}
        {mockups.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', borderBottom: '1px solid #1F1F1F' }}>
              {mockups.map((m: any, i: number) => (
                <button
                  key={m.id}
                  onClick={() => { setActiveMockup(i); setEditingHtml(false); }}
                  style={{
                    padding: '10px 16px', fontSize: '10px', letterSpacing: '.08em',
                    background: activeMockup === i ? '#141414' : 'transparent',
                    border: 'none', borderBottom: activeMockup === i ? '2px solid #FF2A2A' : '2px solid transparent',
                    color: activeMockup === i ? '#FFFFFF' : '#5A5A5A',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{
                    display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                    background: MOCKUP_STATUS_COLORS[m.status] || '#6A6A6A',
                  }} />
                  SCREEN {i + 1}
                </button>
              ))}
            </div>

            {/* Current Mockup */}
            {currentMockup && (
              <>
                {/* Controls bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 0' }}>
                  <span style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.08em', flex: 1 }}>
                    {currentMockup.description}
                  </span>
                  <span style={{
                    fontSize: '9px', letterSpacing: '.1em', padding: '2px 10px',
                    border: `1px solid ${MOCKUP_STATUS_COLORS[currentMockup.status]}44`,
                    color: MOCKUP_STATUS_COLORS[currentMockup.status],
                  }}>
                    {currentMockup.status.toUpperCase()}
                  </span>

                  {/* Viewport toggles */}
                  <div style={{ display: 'flex', gap: '2px', marginLeft: '8px' }}>
                    {(['desktop', 'tablet', 'mobile'] as const).map(vp => (
                      <button
                        key={vp}
                        onClick={() => setViewportSize(vp)}
                        style={{
                          fontSize: '9px', padding: '3px 8px', letterSpacing: '.05em',
                          background: viewportSize === vp ? '#1A1A1A' : 'transparent',
                          border: `1px solid ${viewportSize === vp ? '#FF2A2A' : '#2A2A2A'}`,
                          color: viewportSize === vp ? '#FF2A2A' : '#5A5A5A',
                          cursor: 'pointer',
                        }}
                      >
                        {vp.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Iframe Preview */}
                <div className="ds-card" style={{
                  padding: 0, overflow: 'hidden',
                  display: 'flex', justifyContent: 'center', background: '#000',
                }}>
                  <iframe
                    srcDoc={currentMockup.html}
                    sandbox="allow-scripts"
                    style={{
                      width: viewportWidths[viewportSize],
                      maxWidth: '100%',
                      height: '600px', border: 'none',
                      transition: 'width 0.3s ease',
                    }}
                    title={`Mockup: ${currentMockup.title}`}
                  />
                </div>

                {/* Action buttons */}
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <button
                    onClick={() => updateMockupStatus(currentMockup.id, 'approved')}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: currentMockup.status === 'approved' ? '#2ECC71' : 'transparent',
                      border: '1px solid #2ECC71', color: currentMockup.status === 'approved' ? '#000' : '#2ECC71',
                    }}
                  >
                    APPROVE
                  </button>
                  <button
                    onClick={() => updateMockupStatus(currentMockup.id, 'rejected')}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: currentMockup.status === 'rejected' ? '#FF2A2A' : 'transparent',
                      border: '1px solid #FF2A2A', color: currentMockup.status === 'rejected' ? '#FFF' : '#FF2A2A',
                    }}
                  >
                    REJECT
                  </button>
                  <button
                    onClick={() => updateMockupStatus(currentMockup.id, 'draft')}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: 'transparent', border: '1px solid #3A3A3A', color: '#5A5A5A',
                    }}
                  >
                    RESET TO DRAFT
                  </button>

                  <div style={{ flex: 1 }} />

                  <button
                    onClick={() => {
                      const w = window.open('', '_blank');
                      if (w) { w.document.write(currentMockup.html); w.document.close(); }
                    }}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: 'transparent', border: '1px solid #2A2A2A', color: '#B3B3B3',
                    }}
                  >
                    OPEN IN NEW TAB
                  </button>
                  <button
                    onClick={() => setFullscreen(true)}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: 'transparent', border: '1px solid #2A2A2A', color: '#B3B3B3',
                    }}
                  >
                    FULLSCREEN
                  </button>
                  <button
                    onClick={() => { setEditingHtml(!editingHtml); setEditHtmlValue(currentMockup.html); }}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: editingHtml ? '#1A1A1A' : 'transparent',
                      border: `1px solid ${editingHtml ? '#FF2A2A' : '#2A2A2A'}`,
                      color: editingHtml ? '#FF2A2A' : '#B3B3B3',
                    }}
                  >
                    {editingHtml ? 'CLOSE EDITOR' : 'EDIT HTML'}
                  </button>
                  <button
                    onClick={() => setConfirmDeleteId(currentMockup.id)}
                    style={{
                      fontSize: '10px', letterSpacing: '.08em', padding: '6px 16px', cursor: 'pointer',
                      background: 'transparent', border: '1px solid #FF2A2A33', color: '#FF2A2A',
                    }}
                  >
                    DELETE
                  </button>
                </div>

                {/* Delete Confirmation Modal */}
                {confirmDeleteId && (
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 10001,
                    background: 'rgba(0,0,0,0.7)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <div style={{
                      background: '#0D0D0D', border: '1px solid #1F1F1F',
                      padding: '28px 32px', maxWidth: '400px', width: '90%',
                    }}>
                      <div style={{ fontSize: '12px', letterSpacing: '.1em', color: '#FFFFFF', fontWeight: 700, marginBottom: '12px' }}>
                        DELETE MOCKUP SCREEN
                      </div>
                      <div style={{ fontSize: '11px', color: '#B3B3B3', lineHeight: 1.6, marginBottom: '24px' }}>
                        Are you sure you want to delete this mockup screen? This action cannot be undone.
                      </div>
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          style={{
                            fontSize: '10px', letterSpacing: '.08em', padding: '8px 20px',
                            background: 'transparent', border: '1px solid #2A2A2A', color: '#B3B3B3', cursor: 'pointer',
                          }}
                        >
                          CANCEL
                        </button>
                        <button
                          onClick={() => { deleteMockup(confirmDeleteId); setConfirmDeleteId(null); }}
                          style={{
                            fontSize: '10px', letterSpacing: '.08em', padding: '8px 20px', fontWeight: 700,
                            background: '#FF2A2A', border: 'none', color: '#000', cursor: 'pointer',
                          }}
                        >
                          [ DELETE ]
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* HTML Editor */}
                {editingHtml && (
                  <div className="ds-card" style={{ padding: '16px' }}>
                    <div className="ds-label" style={{ marginBottom: '8px' }}>HTML SOURCE</div>
                    <textarea
                      className="ds-input"
                      value={editHtmlValue}
                      onChange={(e) => setEditHtmlValue(e.target.value)}
                      style={{ width: '100%', height: '300px', fontSize: '10px', fontFamily: '"JetBrains Mono", monospace', lineHeight: 1.5 }}
                    />
                    <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
                      <button
                        className="ds-btn-primary"
                        onClick={() => saveHtmlEdit(currentMockup.id)}
                        style={{ fontSize: '10px', padding: '6px 16px' }}
                      >
                        [ SAVE CHANGES ]
                      </button>
                      <button
                        onClick={() => setEditingHtml(false)}
                        style={{ fontSize: '10px', padding: '6px 16px', background: 'transparent', border: '1px solid #2A2A2A', color: '#5A5A5A', cursor: 'pointer' }}
                      >
                        CANCEL
                      </button>
                    </div>
                  </div>
                )}

                {/* Fullscreen modal */}
                {fullscreen && (
                  <div style={{
                    position: 'fixed', inset: 0, zIndex: 10000,
                    background: '#000', display: 'flex', flexDirection: 'column',
                  }}>
                    <div style={{
                      padding: '12px 24px', display: 'flex', justifyContent: 'space-between',
                      alignItems: 'center', background: '#0D0D0D', borderBottom: '1px solid #1F1F1F',
                    }}>
                      <span style={{ fontSize: '11px', color: '#FF2A2A', letterSpacing: '.1em', fontWeight: 700 }}>
                        MOCKUP PREVIEW — SCREEN {activeMockup + 1}
                      </span>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {(['desktop', 'tablet', 'mobile'] as const).map(vp => (
                          <button
                            key={vp}
                            onClick={() => setViewportSize(vp)}
                            style={{
                              fontSize: '9px', padding: '3px 10px',
                              background: viewportSize === vp ? '#1A1A1A' : 'transparent',
                              border: `1px solid ${viewportSize === vp ? '#FF2A2A' : '#2A2A2A'}`,
                              color: viewportSize === vp ? '#FF2A2A' : '#5A5A5A',
                              cursor: 'pointer',
                            }}
                          >
                            {vp.toUpperCase()}
                          </button>
                        ))}
                        <button
                          onClick={() => setFullscreen(false)}
                          style={{ background: '#FF2A2A', border: 'none', color: '#FFF', padding: '5px 16px', fontSize: '10px', fontWeight: 700, cursor: 'pointer', letterSpacing: '.05em' }}
                        >
                          [ CLOSE ]
                        </button>
                      </div>
                    </div>
                    <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#080808' }}>
                      <iframe
                        srcDoc={currentMockup.html}
                        sandbox="allow-scripts"
                        style={{ width: viewportWidths[viewportSize], maxWidth: '100%', height: '100%', border: 'none' }}
                        title="Fullscreen mockup"
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* Empty state */}
        {mockups.length === 0 && !generatingMockup && (
          <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '10px', color: '#3A3A3A', letterSpacing: '.15em', marginBottom: '8px' }}>NO MOCKUPS YET</div>
            <div style={{ fontSize: '11px', color: '#5A5A5A', lineHeight: 1.6 }}>
              Describe the screen you want above and click Generate Mockup.<br />
              The AI will create a realistic HTML mockup matching your project design system.
            </div>
          </div>
        )}

        <style jsx>{`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  };

  const PlanningTab = () => {
    const existing = (story.planning || {}) as Partial<PlanningData>;
    const [subtasks, setSubtasks] = useState<SubTask[]>(existing.subtasks || []);
    const [totalEstimate, setTotalEstimate] = useState(existing.totalEstimate || '');
    const [notes, setNotes] = useState(existing.notes || '');
    const impactedFiles = existing.impactedFiles || [];
    const newFiles = existing.newFiles || [];
    const [conflicts, setConflicts] = useState<PlanningData['conflicts']>(existing.conflicts || []);
    const [checkingConflicts, setCheckingConflicts] = useState(false);
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
      save({ planning: { subtasks, totalEstimate, notes, impactedFiles, newFiles, conflicts } });
    };

    // Check for conflicts with other user stories
    const checkConflicts = async () => {
      if (impactedFiles.length === 0 && newFiles.length === 0) return;
      setCheckingConflicts(true);
      try {
        const res = await fetch(`/api/projects/${project.id}/conflicts`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storyId: story.id,
            files: [...impactedFiles, ...newFiles],
          }),
        });
        if (res.ok) {
          const data = await res.json();
          setConflicts(data.conflicts || []);
        }
      } catch { /* ignore */ }
      setCheckingConflicts(false);
    };

    const allFiles = [...impactedFiles, ...newFiles];
    const allSubtaskFiles = subtasks.flatMap(t => t.files || []);
    const uniqueFiles = [...new Set([...allFiles, ...allSubtaskFiles])];

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
              <div key={i} style={{ borderBottom: '1px solid #161616' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 120px 70px 80px 30px', gap: '10px', alignItems: 'center', padding: '10px 16px', fontSize: '12px' }}>
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
                {t.files && t.files.length > 0 && (
                  <div style={{ padding: '0 16px 8px 110px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {t.files.map((f, fi) => (
                      <span key={fi} style={{ fontSize: '9px', color: '#6A6A6A', background: '#111', padding: '2px 6px', border: '1px solid #1F1F1F', fontFamily: '"JetBrains Mono", monospace' }}>{f}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* IMPACTED FILES — file-level impact analysis */}
        {uniqueFiles.length > 0 && (
          <div className="ds-card" style={{ padding: '20px', borderColor: '#F39C1233' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#F39C12' }} />
                <div className="ds-label" style={{ color: '#F39C12' }}>FILE IMPACT ANALYSIS</div>
                <span style={{ fontSize: '10px', color: '#5A5A5A' }}>{uniqueFiles.length} file{uniqueFiles.length !== 1 ? 's' : ''}</span>
              </div>
              <button
                className="ds-btn-ghost ds-btn-sm"
                onClick={checkConflicts}
                disabled={checkingConflicts}
                style={{ color: '#FF2A2A', borderColor: '#FF2A2A33', fontSize: '10px', letterSpacing: '.1em' }}
              >
                {checkingConflicts ? '[ CHECKING... ]' : '[ CHECK CONFLICTS ]'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              {impactedFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', letterSpacing: '.12em', color: '#F39C12', marginBottom: '6px' }}>MODIFIED FILES ({impactedFiles.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {impactedFiles.map((f, i) => (
                      <span key={i} style={{ fontSize: '10px', color: '#B3B3B3', fontFamily: '"JetBrains Mono", monospace', padding: '3px 8px', background: '#0D0D0D', border: '1px solid #1F1F1F' }}>
                        ✎ {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {newFiles.length > 0 && (
                <div>
                  <div style={{ fontSize: '9px', letterSpacing: '.12em', color: '#2ECC71', marginBottom: '6px' }}>NEW FILES ({newFiles.length})</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                    {newFiles.map((f, i) => (
                      <span key={i} style={{ fontSize: '10px', color: '#B3B3B3', fontFamily: '"JetBrains Mono", monospace', padding: '3px 8px', background: '#0D0D0D', border: '1px solid #1A3A1A' }}>
                        + {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CONFLICT WARNINGS */}
        {conflicts && conflicts.length > 0 && (
          <div className="ds-card" style={{ padding: '20px', borderColor: '#FF2A2A', background: '#1A0808' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
              <span style={{ fontSize: '16px' }}>⚠</span>
              <div className="ds-label" style={{ color: '#FF2A2A' }}>CONFLICT DETECTED — {conflicts.length} OVERLAPPING STOR{conflicts.length !== 1 ? 'IES' : 'Y'}</div>
            </div>
            <div style={{ fontSize: '11px', color: '#FF8A8A', marginBottom: '12px', lineHeight: 1.6 }}>
              The following user stories modify the same files. Assigning these to different developers simultaneously may cause merge conflicts.
            </div>
            {conflicts.map((c, ci) => (
              <div key={ci} style={{ padding: '10px 14px', background: '#0D0D0D', border: '1px solid #FF2A2A33', marginBottom: '8px' }}>
                <div style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 700, marginBottom: '6px' }}>
                  {c.storyTitle}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {c.sharedFiles.map((f, fi) => (
                    <span key={fi} style={{ fontSize: '9px', color: '#FF2A2A', background: '#1A0505', padding: '2px 6px', border: '1px solid #FF2A2A44', fontFamily: '"JetBrains Mono", monospace' }}>
                      {f}
                    </span>
                  ))}
                </div>
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

  // --- TAB 8: DEVELOPMENT ---
  const DevelopmentTab = () => {
    const [devData, setDevData] = useState<any>(null);
    const [checkData, setCheckData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      if (!story.githubIssueNumber) { setLoading(false); return; }
      (async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/github-dev?storyId=${story.id}&type=development`);
          const data = await res.json();
          if (res.ok) {
            setDevData(data);
            // Sync PR data to story state so Code Review and Ship tabs can use it
            if (data.pullRequests?.[0]) {
              const pr = data.pullRequests[0];
              setStory((prev: any) => ({
                ...prev,
                githubPrNumber: pr.number,
                githubPrState: pr.state,
                githubPrUrl: pr.url,
                githubBranch: pr.branch,
              }));
              // Also fetch checks
              const checksRes = await fetch(`/api/projects/${project.id}/github-dev?storyId=${story.id}&type=checks&prNumber=${pr.number}`);
              const checksJson = await checksRes.json();
              if (checksRes.ok) setCheckData(checksJson);
            }
          } else { setError(data.error); }
        } catch (e: any) { setError(e.message); }
        setLoading(false);
      })();
    }, [story.id, story.githubIssueNumber]);

    if (!story.githubIssueNumber) return (
      <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#5A5A5A', letterSpacing: '.1em', marginBottom: '8px' }}>NO GITHUB ISSUE LINKED</div>
        <div style={{ fontSize: '11px', color: '#3A3A3A' }}>Create a GitHub issue first from the Planning tab to track development.</div>
      </div>
    );
    if (loading) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px' }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid #FF2A2A33', borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'dsSpin 1s linear infinite' }} />
        <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.1em' }}>LOADING DEVELOPMENT DATA...</span>
      </div>
    );
    if (error) return <div style={{ padding: '20px', fontSize: '11px', color: '#FF2A2A' }}>{error}</div>;

    const pr = devData?.pullRequests?.[0];
    const PR_STATE_COLORS: Record<string, string> = { open: '#2ECC71', merged: '#8B5CF6', closed: '#FF2A2A', draft: '#6A6A6A' };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Branch + PR Row */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {/* Branch Card */}
          <div className="ds-card" style={{ flex: 1, padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>BRANCH</div>
            {devData?.branch ? (
              <>
                <div style={{ fontSize: '13px', color: '#FFFFFF', fontFamily: 'JetBrains Mono', marginBottom: '8px' }}>{devData.branch}</div>
                {pr && (
                  <div style={{ fontSize: '10px', color: '#5A5A5A' }}>
                    {pr.commits.length} commits · into {pr.baseBranch}
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: '11px', color: '#3A3A3A' }}>No branch detected yet</div>
            )}
          </div>

          {/* PR Card */}
          <div className="ds-card" style={{ flex: 1, padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>PULL REQUEST</div>
            {pr ? (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '9px', letterSpacing: '.1em', padding: '2px 8px', border: `1px solid ${PR_STATE_COLORS[pr.state] || '#5A5A5A'}`, color: PR_STATE_COLORS[pr.state] || '#5A5A5A' }}>
                    {pr.state.toUpperCase()}
                  </span>
                  <a href={pr.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: '12px', color: '#FFFFFF', textDecoration: 'none', borderBottom: '1px solid #2A2A2A' }}>
                    PR #{pr.number}
                  </a>
                </div>
                <div style={{ fontSize: '11px', color: '#B3B3B3', marginBottom: '8px' }}>{pr.title}</div>
                <div style={{ fontSize: '10px', color: '#5A5A5A' }}>
                  <span style={{ color: '#2ECC71' }}>+{pr.additions}</span> <span style={{ color: '#FF2A2A' }}>-{pr.deletions}</span> · {pr.changedFiles} files
                  {pr.authorAvatar && <img src={pr.authorAvatar} style={{ width: '16px', height: '16px', borderRadius: '50%', marginLeft: '8px', verticalAlign: 'middle' }} />}
                  <span style={{ marginLeft: '4px' }}>@{pr.author}</span>
                </div>
              </>
            ) : (
              <div style={{ fontSize: '11px', color: '#3A3A3A' }}>No pull request linked yet</div>
            )}
          </div>
        </div>

        {/* CI/CD Checks */}
        {checkData && checkData.checkRuns.length > 0 && (
          <div className="ds-card" style={{ padding: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <div className="ds-label">CI/CD CHECKS</div>
              <span style={{
                fontSize: '9px', letterSpacing: '.1em', padding: '3px 10px',
                background: checkData.summary.failed > 0 ? '#FF2A2A15' : checkData.summary.pending > 0 ? '#F39C1215' : '#2ECC7115',
                border: `1px solid ${checkData.summary.failed > 0 ? '#FF2A2A33' : checkData.summary.pending > 0 ? '#F39C1233' : '#2ECC7133'}`,
                color: checkData.summary.failed > 0 ? '#FF2A2A' : checkData.summary.pending > 0 ? '#F39C12' : '#2ECC71',
              }}>
                {checkData.summary.failed > 0 ? `${checkData.summary.failed} FAILING` : checkData.summary.pending > 0 ? `${checkData.summary.pending} PENDING` : 'ALL PASSED'}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {checkData.checkRuns.map((cr: any) => (
                <div key={cr.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 12px', background: '#0A0A0A', border: '1px solid #1A1A1A' }}>
                  <span style={{ fontSize: '12px' }}>
                    {cr.conclusion === 'success' ? '✓' : cr.conclusion === 'failure' ? '✗' : cr.status === 'in_progress' ? '◎' : '○'}
                  </span>
                  <span style={{ fontSize: '11px', color: '#B3B3B3', flex: 1 }}>{cr.name}</span>
                  <span style={{
                    fontSize: '9px', letterSpacing: '.08em',
                    color: cr.conclusion === 'success' ? '#2ECC71' : cr.conclusion === 'failure' ? '#FF2A2A' : '#F39C12',
                  }}>
                    {cr.conclusion ? cr.conclusion.toUpperCase() : cr.status.toUpperCase()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Commits */}
        {pr && pr.commits.length > 0 && (
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>RECENT COMMITS ({pr.commits.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {pr.commits.slice(0, 15).map((c: any, i: number) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 12px', background: i % 2 === 0 ? '#0A0A0A' : 'transparent' }}>
                  <span style={{ fontSize: '10px', color: '#FF2A2A', fontFamily: 'JetBrains Mono' }}>{c.sha}</span>
                  <span style={{ fontSize: '11px', color: '#B3B3B3', flex: 1 }}>{c.message}</span>
                  <span style={{ fontSize: '10px', color: '#5A5A5A' }}>{c.author}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No activity state */}
        {!pr && !devData?.branch && (
          <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#5A5A5A', letterSpacing: '.08em', lineHeight: 1.8 }}>
              No development activity detected yet.<br />
              Create a branch or PR that references issue #{story.githubIssueNumber} to track progress here.
            </div>
          </div>
        )}
      </div>
    );
  };

  // --- TAB 9: CODE REVIEW ---
  const CodeReviewTab = () => {
    const [reviewData, setReviewData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      const prNumber = story.githubPrNumber;
      if (!prNumber) { setLoading(false); return; }
      (async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/github-dev?storyId=${story.id}&type=reviews&prNumber=${prNumber}`);
          const data = await res.json();
          if (res.ok) setReviewData(data); else setError(data.error);
        } catch (e: any) { setError(e.message); }
        setLoading(false);
      })();
    }, [story.id, story.githubPrNumber]);

    const DECISION_COLORS: Record<string, { bg: string; border: string; text: string; label: string }> = {
      approved: { bg: '#2ECC7115', border: '#2ECC7133', text: '#2ECC71', label: 'APPROVED' },
      changes_requested: { bg: '#FF2A2A15', border: '#FF2A2A33', text: '#FF2A2A', label: 'CHANGES REQUESTED' },
      pending: { bg: '#F39C1215', border: '#F39C1233', text: '#F39C12', label: 'PENDING REVIEW' },
    };
    const REVIEW_STATE_COLORS: Record<string, string> = { APPROVED: '#2ECC71', CHANGES_REQUESTED: '#FF2A2A', COMMENTED: '#F39C12', PENDING: '#6A6A6A', DISMISSED: '#5A5A5A' };

    if (!story.githubPrNumber) return (
      <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#5A5A5A', letterSpacing: '.1em', marginBottom: '8px' }}>NO PULL REQUEST LINKED</div>
        <div style={{ fontSize: '11px', color: '#3A3A3A' }}>A pull request must be created and linked to the issue before code review can be tracked.</div>
      </div>
    );
    if (loading) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px' }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid #FF2A2A33', borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'dsSpin 1s linear infinite' }} />
        <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.1em' }}>LOADING CODE REVIEW...</span>
      </div>
    );
    if (error) return <div style={{ padding: '20px', fontSize: '11px', color: '#FF2A2A' }}>{error}</div>;

    const dc = DECISION_COLORS[reviewData?.decision || 'pending'];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Decision Banner */}
        <div style={{ padding: '16px 20px', background: dc.bg, border: `1px solid ${dc.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontSize: '12px', letterSpacing: '.12em', color: dc.text, fontWeight: 700 }}>{dc.label}</div>
          <div style={{ fontSize: '10px', color: '#5A5A5A' }}>
            {reviewData?.reviews?.length || 0} review(s) · {reviewData?.comments?.length || 0} comment(s)
          </div>
        </div>

        {/* Reviewers */}
        {((reviewData?.reviews?.length > 0) || (reviewData?.requestedReviewers?.length > 0)) && (
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>REVIEWERS</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {reviewData.reviews.map((r: any, i: number) => (
                <div key={i} style={{ padding: '12px 16px', background: '#0A0A0A', border: '1px solid #1A1A1A', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                  {r.avatar && <img src={r.avatar} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}
                  <div>
                    <div style={{ fontSize: '11px', color: '#FFFFFF' }}>@{r.reviewer}</div>
                    <div style={{ fontSize: '9px', letterSpacing: '.08em', color: REVIEW_STATE_COLORS[r.state] || '#5A5A5A', marginTop: '2px' }}>
                      {r.state.replace(/_/g, ' ')}
                    </div>
                  </div>
                </div>
              ))}
              {reviewData.requestedReviewers.map((r: any, i: number) => (
                <div key={`req-${i}`} style={{ padding: '12px 16px', background: '#0A0A0A', border: '1px dashed #2A2A2A', display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
                  {r.avatar && <img src={r.avatar} style={{ width: '24px', height: '24px', borderRadius: '50%' }} />}
                  <div>
                    <div style={{ fontSize: '11px', color: '#7A7A7A' }}>@{r.login}</div>
                    <div style={{ fontSize: '9px', letterSpacing: '.08em', color: '#F39C12', marginTop: '2px' }}>AWAITING REVIEW</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Review Comments */}
        {reviewData?.comments?.length > 0 && (
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>REVIEW COMMENTS ({reviewData.comments.length})</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reviewData.comments.filter((c: any) => !c.inReplyToId).map((c: any) => {
                const replies = reviewData.comments.filter((r: any) => r.inReplyToId === c.id);
                return (
                  <div key={c.id} style={{ border: '1px solid #1A1A1A', background: '#0A0A0A' }}>
                    <div style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        {c.avatar && <img src={c.avatar} style={{ width: '18px', height: '18px', borderRadius: '50%' }} />}
                        <span style={{ fontSize: '11px', color: '#FFFFFF' }}>@{c.author}</span>
                        <span style={{ fontSize: '10px', color: '#FF2A2A', fontFamily: 'JetBrains Mono' }}>{c.path}:{c.line}</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#B3B3B3', lineHeight: 1.6, paddingLeft: '26px' }}>{c.body}</div>
                    </div>
                    {replies.map((r: any) => (
                      <div key={r.id} style={{ padding: '10px 16px 10px 42px', borderTop: '1px solid #1A1A1A', background: '#0D0D0D' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                          {r.avatar && <img src={r.avatar} style={{ width: '14px', height: '14px', borderRadius: '50%' }} />}
                          <span style={{ fontSize: '10px', color: '#B3B3B3' }}>@{r.author}</span>
                        </div>
                        <div style={{ fontSize: '10px', color: '#7A7A7A', lineHeight: 1.5 }}>{r.body}</div>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* No reviews yet */}
        {(!reviewData?.reviews?.length && !reviewData?.requestedReviewers?.length && !reviewData?.comments?.length) && (
          <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{ fontSize: '11px', color: '#5A5A5A', letterSpacing: '.08em' }}>No reviews submitted yet.</div>
          </div>
        )}
      </div>
    );
  };

  // --- TAB 10: SHIP ---
  const ShipTab = () => {
    const [shipData, setShipData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
      const prNumber = story.githubPrNumber;
      if (!prNumber) { setLoading(false); return; }
      (async () => {
        try {
          const res = await fetch(`/api/projects/${project.id}/github-dev?storyId=${story.id}&type=ship&prNumber=${prNumber}`);
          const data = await res.json();
          if (res.ok) setShipData(data); else setError(data.error);
        } catch (e: any) { setError(e.message); }
        setLoading(false);
      })();
    }, [story.id, story.githubPrNumber]);

    if (!story.githubPrNumber) return (
      <div className="ds-card" style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '12px', color: '#5A5A5A', letterSpacing: '.1em', marginBottom: '8px' }}>NO PULL REQUEST LINKED</div>
        <div style={{ fontSize: '11px', color: '#3A3A3A' }}>A pull request must exist before tracking ship status.</div>
      </div>
    );
    if (loading) return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '20px' }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid #FF2A2A33', borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'dsSpin 1s linear infinite' }} />
        <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.1em' }}>LOADING SHIP STATUS...</span>
      </div>
    );
    if (error) return <div style={{ padding: '20px', fontSize: '11px', color: '#FF2A2A' }}>{error}</div>;

    const merge = shipData?.merge;
    const fmtDate = (d: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Merge Status */}
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '12px' }}>MERGE STATUS</div>
          {merge?.merged ? (
            <div style={{ padding: '16px', background: '#8B5CF610', border: '1px solid #8B5CF633' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <span style={{ fontSize: '12px', letterSpacing: '.1em', color: '#8B5CF6', fontWeight: 700 }}>MERGED</span>
                {merge.mergedBy?.avatar && <img src={merge.mergedBy.avatar} style={{ width: '20px', height: '20px', borderRadius: '50%' }} />}
                <span style={{ fontSize: '11px', color: '#B3B3B3' }}>by @{merge.mergedBy?.login}</span>
              </div>
              <div style={{ fontSize: '10px', color: '#5A5A5A' }}>
                {merge.branch} → {merge.baseBranch} · {fmtDate(merge.mergedAt)}
              </div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', marginTop: '4px' }}>
                {merge.commits} commits · <span style={{ color: '#2ECC71' }}>+{merge.additions}</span> <span style={{ color: '#FF2A2A' }}>-{merge.deletions}</span>
              </div>
            </div>
          ) : (
            <div style={{ padding: '16px', background: '#F39C1210', border: '1px solid #F39C1233' }}>
              <div style={{ fontSize: '12px', letterSpacing: '.1em', color: '#F39C12', fontWeight: 700 }}>NOT MERGED</div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', marginTop: '4px' }}>Pull request is still open. Merge to complete this story.</div>
            </div>
          )}
        </div>

        {/* Deployments */}
        {shipData?.deployments?.length > 0 && (
          <div className="ds-card" style={{ padding: '20px' }}>
            <div className="ds-label" style={{ marginBottom: '12px' }}>DEPLOYMENTS</div>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {shipData.deployments.map((d: any) => {
                const colors: Record<string, string> = { success: '#2ECC71', active: '#2ECC71', failure: '#FF2A2A', error: '#FF2A2A', pending: '#F39C12', inactive: '#5A5A5A', in_progress: '#F39C12' };
                const c = colors[d.status] || '#5A5A5A';
                return (
                  <div key={d.id} style={{ padding: '14px 18px', background: '#0A0A0A', border: '1px solid #1A1A1A', minWidth: '180px' }}>
                    <div style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: 600, marginBottom: '6px' }}>{d.environment.toUpperCase()}</div>
                    <div style={{ fontSize: '9px', letterSpacing: '.08em', color: c, marginBottom: '4px' }}>{d.status.toUpperCase()}</div>
                    <div style={{ fontSize: '10px', color: '#5A5A5A' }}>{fmtDate(d.createdAt)}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Lifecycle Timeline */}
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '16px' }}>LIFECYCLE TIMELINE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0', paddingLeft: '16px', borderLeft: '2px solid #1F1F1F' }}>
            {/* Static events from story data */}
            {story.createdAt && (
              <TimelineEntry icon="●" color="#5A5A5A" label="Story created" date={fmtDate(story.createdAt)} />
            )}
            {story.githubIssueUrl && (
              <TimelineEntry icon="●" color="#FF2A2A" label={`Issue #${story.githubIssueNumber} created`} date="" />
            )}
            {shipData?.merge?.branch && (
              <TimelineEntry icon="●" color="#2ECC71" label={`Branch: ${merge.branch}`} date="" />
            )}
            {story.githubPrUrl && (
              <TimelineEntry icon="●" color="#2ECC71" label={`PR #${story.githubPrNumber} opened`} date="" />
            )}
            {merge?.merged ? (
              <TimelineEntry icon="●" color="#8B5CF6" label={`PR merged by @${merge.mergedBy?.login}`} date={fmtDate(merge.mergedAt)} />
            ) : (
              <TimelineEntry icon="○" color="#3A3A3A" label="PR merge — pending" date="" />
            )}
            {shipData?.deployments?.map((d: any) => (
              <TimelineEntry key={d.id} icon="●" color={d.status === 'success' || d.status === 'active' ? '#2ECC71' : '#F39C12'} label={`Deployed to ${d.environment}`} date={fmtDate(d.createdAt)} />
            ))}
          </div>
        </div>
      </div>
    );
  };

  const TimelineEntry = ({ icon, color, label, date }: { icon: string; color: string; label: string; date: string }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', marginLeft: '-22px' }}>
      <span style={{ fontSize: '10px', color, width: '16px', textAlign: 'center' }}>{icon}</span>
      <span style={{ fontSize: '11px', color: '#B3B3B3', flex: 1 }}>{label}</span>
      {date && <span style={{ fontSize: '10px', color: '#5A5A5A' }}>{date}</span>}
    </div>
  );

  const tabContent: Record<TabKey, () => React.ReactNode> = {
    story: StoryTab,
    requirements: RequirementsTab,
    acceptance: AcceptanceTab,
    gherkin: GherkinTab,
    mockups: MockupsTab,
    techreview: TechReviewTab,
    planning: PlanningTab,
    development: DevelopmentTab,
    codereview: CodeReviewTab,
    ship: ShipTab,
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
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {issueResult?.url && (
              <a
                href={issueResult.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  fontSize: '10px', letterSpacing: '.1em', textDecoration: 'none',
                  padding: '4px 12px', display: 'flex', alignItems: 'center', gap: '6px',
                  border: `1px solid ${issueResult.state === 'closed' ? '#5A5A5A44' : '#2ECC7144'}`,
                  color: issueResult.state === 'closed' ? '#5A5A5A' : '#2ECC71',
                }}
              >
                <span style={{
                  display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%',
                  background: issueResult.state === 'closed' ? '#8E44AD' : '#2ECC71',
                }} />
                ISSUE #{issueResult.number} · {(issueResult.state || 'open').toUpperCase()}
              </a>
            )}
            {issueResult?.url ? (
              <button
                className="ds-btn-primary ds-btn-sm"
                disabled={creatingIssue}
                onClick={async () => {
                  setCreatingIssue(true);
                  try {
                    const res = await fetch(`/api/projects/${project.id}/github-issue`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ storyId: story.id }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setIssueResult({ url: data.issueUrl, number: data.issueNumber, state: 'open' });
                      setStory((prev: any) => ({ ...prev, status: 'ready', githubIssueUrl: data.issueUrl, githubIssueNumber: data.issueNumber, githubIssueState: 'open' }));
                    } else {
                      setIssueResult(prev => ({ ...prev, error: data.error || 'Failed to update issue' }));
                    }
                  } catch (err: any) {
                    setIssueResult(prev => ({ ...prev, error: err.message || 'Network error' }));
                  }
                  setCreatingIssue(false);
                }}
                style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
              >
                {creatingIssue ? '[ UPDATING... ]' : '[ UPDATE GITHUB ISSUE ]'}
              </button>
            ) : (
              <button
                className="ds-btn-primary ds-btn-sm"
                disabled={creatingIssue}
                onClick={async () => {
                  setCreatingIssue(true);
                  setIssueResult(null);
                  try {
                    const res = await fetch(`/api/projects/${project.id}/github-issue`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ storyId: story.id }),
                    });
                    const data = await res.json();
                    if (res.ok) {
                      setIssueResult({ url: data.issueUrl, number: data.issueNumber, state: 'open' });
                      setStory((prev: any) => ({ ...prev, status: 'ready', githubIssueUrl: data.issueUrl, githubIssueNumber: data.issueNumber, githubIssueState: 'open' }));
                    } else {
                      setIssueResult({ error: data.error || 'Failed to create issue' });
                    }
                  } catch (err: any) {
                    setIssueResult({ error: err.message || 'Network error' });
                  }
                  setCreatingIssue(false);
                }}
                style={{ letterSpacing: '.1em', whiteSpace: 'nowrap' }}
              >
                {creatingIssue ? '[ CREATING... ]' : '[ CREATE GITHUB ISSUE ]'}
              </button>
            )}
          </div>
        </div>
        {/* Save indicator */}
        {(saving || saved) && (
          <div style={{ marginTop: '8px', fontSize: '10px', letterSpacing: '.1em', color: saving ? '#F39C12' : '#2ECC71' }}>
            {saving ? '● SAVING...' : '● SAVED'}
          </div>
        )}
        {issueResult?.error && (
          <div style={{ marginTop: '8px', fontSize: '10px', letterSpacing: '.1em', color: '#FF2A2A' }}>
            ✕ {issueResult.error}
          </div>
        )}
      </div>

      {/* Tab Pipeline */}
      <div style={{ display: 'flex', borderBottom: '1px solid #1F1F1F', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              style={{
                flex: 1,
                minWidth: '110px',
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
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '9px', color: isActive ? '#FF2A2A' : '#3A3A3A', fontFamily: '"JetBrains Mono", monospace' }}>{tab.num}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Active Tab Content */}
      <div style={{ animation: 'dsFadeIn .2s ease-out' }} key={activeTab}>
        <ActiveContent />
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' };
