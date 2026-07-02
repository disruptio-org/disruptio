'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Story {
  id: string;
  persona: string;
  action: string;
  benefit: string;
  acceptanceCriteria: string[] | null;
  complexity: string;
  status: string;
}

interface Feature {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  status: string;
  userStories: Story[];
}

const STATUS_COLORS: Record<string, string> = {
  draft: '#6A6A6A', 'in-progress': '#F39C12', ready: '#2ECC71', done: '#5A5A5A',
};

const PRIORITY_COLORS: Record<string, string> = {
  low: '#2ECC71', medium: '#F39C12', high: '#FF2A2A', critical: '#FF2A2A',
};

const COMPLEXITY_COLORS: Record<string, string> = {
  low: '#2ECC71', medium: '#F39C12', high: '#FF2A2A',
};

export default function FeaturesContent({ project }: { project: any }) {
  const router = useRouter();
  const [features, setFeatures] = useState<Feature[]>(project.features || []);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showNewFeature, setShowNewFeature] = useState(false);
  const [newFeatureTitle, setNewFeatureTitle] = useState('');
  const [newFeatureDesc, setNewFeatureDesc] = useState('');
  const [newFeaturePriority, setNewFeaturePriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  // Story creation state per feature
  const [storyForms, setStoryForms] = useState<Record<string, boolean>>({});
  const [storyInputs, setStoryInputs] = useState<Record<string, { persona: string; action: string; benefit: string; complexity: string }>>({});
  const [creatingStory, setCreatingStory] = useState<Record<string, boolean>>({});

  // Edit state
  const [editingStatus, setEditingStatus] = useState<Record<string, boolean>>({});

  const personaNames = (project.personas || []).map((p: any) => p.name);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const createFeature = async () => {
    if (!newFeatureTitle.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/features`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newFeatureTitle, description: newFeatureDesc || undefined, priority: newFeaturePriority }),
      });
      if (res.ok) {
        const feature = await res.json();
        setFeatures((prev) => [...prev, feature]);
        setNewFeatureTitle('');
        setNewFeatureDesc('');
        setNewFeaturePriority('medium');
        setShowNewFeature(false);
        setExpanded((prev) => ({ ...prev, [feature.id]: true }));
      }
    } catch { /* */ }
    setCreating(false);
  };

  const deleteFeature = async (featureId: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}`, { method: 'DELETE' });
      if (res.ok) {
        setFeatures((prev) => prev.filter((f) => f.id !== featureId));
      }
    } catch { /* */ }
  };

  const updateFeatureStatus = async (featureId: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFeatures((prev) => prev.map((f) => f.id === featureId ? { ...f, status } : f));
        setEditingStatus((prev) => ({ ...prev, [featureId]: false }));
      }
    } catch { /* */ }
  };

  const updateFeaturePriority = async (featureId: string, priority: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (res.ok) {
        setFeatures((prev) => prev.map((f) => f.id === featureId ? { ...f, priority } : f));
      }
    } catch { /* */ }
  };

  const openStoryForm = (featureId: string) => {
    setStoryForms((prev) => ({ ...prev, [featureId]: true }));
    if (!storyInputs[featureId]) {
      setStoryInputs((prev) => ({
        ...prev,
        [featureId]: { persona: personaNames[0] || '', action: '', benefit: '', complexity: 'medium' },
      }));
    }
  };

  const updateStoryInput = (featureId: string, field: string, value: string) => {
    setStoryInputs((prev) => ({
      ...prev,
      [featureId]: { ...prev[featureId], [field]: value },
    }));
  };

  const createStory = async (featureId: string) => {
    const input = storyInputs[featureId];
    if (!input?.persona?.trim() || !input?.action?.trim() || !input?.benefit?.trim()) return;
    setCreatingStory((prev) => ({ ...prev, [featureId]: true }));
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}/stories`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      });
      if (res.ok) {
        const story = await res.json();
        setFeatures((prev) =>
          prev.map((f) => f.id === featureId ? { ...f, userStories: [...f.userStories, story] } : f)
        );
        setStoryForms((prev) => ({ ...prev, [featureId]: false }));
        setStoryInputs((prev) => ({
          ...prev,
          [featureId]: { persona: personaNames[0] || '', action: '', benefit: '', complexity: 'medium' },
        }));
      }
    } catch { /* */ }
    setCreatingStory((prev) => ({ ...prev, [featureId]: false }));
  };

  const deleteStory = async (featureId: string, storyId: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}/stories/${storyId}`, { method: 'DELETE' });
      if (res.ok) {
        setFeatures((prev) =>
          prev.map((f) => f.id === featureId ? { ...f, userStories: f.userStories.filter((s) => s.id !== storyId) } : f)
        );
      }
    } catch { /* */ }
  };

  const updateStoryStatus = async (featureId: string, storyId: string, status: string) => {
    try {
      const res = await fetch(`/api/projects/${project.id}/features/${featureId}/stories/${storyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setFeatures((prev) =>
          prev.map((f) => f.id === featureId
            ? { ...f, userStories: f.userStories.map((s) => s.id === storyId ? { ...s, status } : s) }
            : f
          )
        );
      }
    } catch { /* */ }
  };

  const totalStories = features.reduce((sum, f) => sum + f.userStories.length, 0);
  const readyFeatures = features.filter((f) => f.status === 'ready' || f.status === 'done').length;

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '22px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div className="ds-section-title">FEATURES</div>
          <div style={{ marginTop: '6px', fontSize: '12px', color: '#6A6A6A' }}>
            {features.length} features · {totalStories} user stories · {readyFeatures} ready
          </div>
        </div>
        <button
          className="ds-btn-primary ds-btn-sm"
          onClick={() => setShowNewFeature(true)}
          style={{ letterSpacing: '.1em' }}
        >
          [ + NEW FEATURE ]
        </button>
      </div>

      {/* Stats bar */}
      {features.length > 0 && (
        <div style={{ display: 'flex', gap: '16px' }}>
          {['draft', 'in-progress', 'ready', 'done'].map((s) => {
            const count = features.filter((f) => f.status === s).length;
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[s] }} />
                <span style={{ fontSize: '10px', color: STATUS_COLORS[s], letterSpacing: '.1em' }}>
                  {s.toUpperCase().replace('-', ' ')} ({count})
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* New Feature Form */}
      {showNewFeature && (
        <div className="ds-card" style={{ animation: 'dsFadeIn .2s ease-out', borderColor: '#FF2A2A33' }}>
          <div className="ds-label" style={{ marginBottom: '14px', color: '#FF2A2A' }}>NEW FEATURE</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>TITLE</div>
              <input
                className="ds-input"
                style={{ width: '100%' }}
                value={newFeatureTitle}
                onChange={(e) => setNewFeatureTitle(e.target.value)}
                placeholder="e.g. User Authentication & Authorization"
                onKeyDown={(e) => e.key === 'Enter' && createFeature()}
                autoFocus
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>DESCRIPTION (OPTIONAL)</div>
              <textarea
                className="ds-input"
                style={{ width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit' }}
                value={newFeatureDesc}
                onChange={(e) => setNewFeatureDesc(e.target.value)}
                placeholder="Describe the feature scope and objectives..."
              />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' }}>PRIORITY</div>
              <div style={{ display: 'flex', gap: '8px' }}>
                {['low', 'medium', 'high', 'critical'].map((p) => (
                  <button
                    key={p}
                    onClick={() => setNewFeaturePriority(p)}
                    style={{
                      padding: '4px 12px', fontSize: '10px', letterSpacing: '.1em', cursor: 'pointer',
                      background: newFeaturePriority === p ? `${PRIORITY_COLORS[p]}18` : 'transparent',
                      border: `1px solid ${newFeaturePriority === p ? PRIORITY_COLORS[p] : '#2A2A2A'}`,
                      color: newFeaturePriority === p ? PRIORITY_COLORS[p] : '#5A5A5A',
                    }}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
              <button className="ds-btn-primary ds-btn-sm" onClick={createFeature} disabled={creating || !newFeatureTitle.trim()}>
                {creating ? 'CREATING...' : '[ CREATE FEATURE ]'}
              </button>
              <button className="ds-btn-ghost ds-btn-sm" onClick={() => setShowNewFeature(false)}>CANCEL</button>
            </div>
          </div>
        </div>
      )}

      {/* Feature List */}
      {features.length === 0 && !showNewFeature ? (
        <div style={{ border: '1px solid #2A2A2A', padding: '60px', textAlign: 'center' }}>
          <div style={{ fontSize: '16px', fontWeight: 700 }}>No features defined.</div>
          <div style={{ marginTop: '8px', color: '#6A6A6A', fontSize: '12px' }}>
            Features group related user stories. Create your first feature to start planning.
          </div>
          <button
            className="ds-btn-primary"
            style={{ marginTop: '24px' }}
            onClick={() => setShowNewFeature(true)}
          >
            [ + CREATE FIRST FEATURE ]
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {features.map((feature) => {
            const isExpanded = expanded[feature.id];
            const storyCount = feature.userStories.length;

            return (
              <div key={feature.id} style={{ animation: 'dsFadeIn .2s ease-out' }}>
                {/* Feature Header */}
                <div
                  className="ds-card"
                  style={{
                    cursor: 'pointer', transition: 'border-color .15s',
                    borderColor: isExpanded ? '#FF2A2A33' : undefined,
                    marginBottom: isExpanded ? '0' : undefined,
                    borderBottom: isExpanded ? '1px solid #1A1A1A' : undefined,
                  }}
                  onClick={() => toggleExpand(feature.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Expand indicator */}
                    <span style={{ color: '#5A5A5A', fontSize: '10px', width: '10px', fontFamily: '"JetBrains Mono", monospace' }}>
                      {isExpanded ? '▼' : '▶'}
                    </span>

                    {/* Title */}
                    <span style={{ color: '#FFFFFF', fontWeight: 700, fontSize: '14px', flex: 1 }}>
                      {feature.title}
                    </span>

                    {/* Story count */}
                    <span style={{ fontSize: '11px', color: '#5A5A5A', fontFamily: '"JetBrains Mono", monospace' }}>
                      {storyCount} {storyCount === 1 ? 'story' : 'stories'}
                    </span>

                    {/* Priority */}
                    <span
                      style={{
                        fontSize: '9px', padding: '2px 8px', letterSpacing: '.1em', fontWeight: 700,
                        color: PRIORITY_COLORS[feature.priority],
                        border: `1px solid ${PRIORITY_COLORS[feature.priority]}44`,
                        background: `${PRIORITY_COLORS[feature.priority]}11`,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const priorities = ['low', 'medium', 'high', 'critical'];
                        const next = priorities[(priorities.indexOf(feature.priority) + 1) % priorities.length];
                        updateFeaturePriority(feature.id, next);
                      }}
                    >
                      {feature.priority.toUpperCase()}
                    </span>

                    {/* Status */}
                    <span
                      style={{
                        fontSize: '9px', padding: '2px 8px', letterSpacing: '.1em',
                        color: STATUS_COLORS[feature.status],
                        border: `1px solid ${STATUS_COLORS[feature.status]}44`,
                        cursor: 'pointer',
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        const statuses = ['draft', 'in-progress', 'ready', 'done'];
                        const next = statuses[(statuses.indexOf(feature.status) + 1) % statuses.length];
                        updateFeatureStatus(feature.id, next);
                      }}
                    >
                      {feature.status.toUpperCase().replace('-', ' ')}
                    </span>

                    {/* Delete */}
                    <span
                      style={{ color: '#3A3A3A', fontSize: '14px', cursor: 'pointer', padding: '0 4px' }}
                      onClick={(e) => { e.stopPropagation(); deleteFeature(feature.id); }}
                      title="Delete feature"
                    >
                      ×
                    </span>
                  </div>

                  {feature.description && (
                    <div style={{ marginTop: '8px', fontSize: '11.5px', color: '#6A6A6A', paddingLeft: '22px' }}>
                      {feature.description}
                    </div>
                  )}
                </div>

                {/* Expanded: User Stories */}
                {isExpanded && (
                  <div style={{
                    background: '#080808', border: '1px solid #1A1A1A', borderTop: 'none',
                    padding: '16px 16px 16px 34px',
                    display: 'flex', flexDirection: 'column', gap: '8px',
                    animation: 'dsFadeIn .15s ease-out',
                  }}>
                    {feature.userStories.length === 0 && !storyForms[feature.id] && (
                      <div style={{ color: '#4A4A4A', fontSize: '12px', padding: '12px 0' }}>
                        No user stories yet. Add your first story below.
                      </div>
                    )}

                    {feature.userStories.map((story) => (
                      <div
                        key={story.id}
                        style={{
                          background: '#0D0D0D', border: '1px solid #1A1A1A', padding: '12px 14px',
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#B3B3B3', lineHeight: 1.6 }}>
                          As a <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{story.persona}</span>,
                          I want to <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{story.action}</span> so
                          that <span style={{ color: '#FFFFFF', fontWeight: 600 }}>{story.benefit}</span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          {/* Complexity */}
                          <span style={{
                            fontSize: '9px', padding: '1px 6px', letterSpacing: '.08em',
                            color: COMPLEXITY_COLORS[story.complexity],
                            border: `1px solid ${COMPLEXITY_COLORS[story.complexity]}33`,
                          }}>
                            {story.complexity.toUpperCase()}
                          </span>

                          {/* Status */}
                          <span
                            style={{
                              fontSize: '9px', padding: '1px 6px', letterSpacing: '.08em',
                              color: STATUS_COLORS[story.status],
                              border: `1px solid ${STATUS_COLORS[story.status]}33`,
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const statuses = ['draft', 'in-progress', 'ready', 'done'];
                              const next = statuses[(statuses.indexOf(story.status) + 1) % statuses.length];
                              updateStoryStatus(feature.id, story.id, next);
                            }}
                          >
                            {story.status.toUpperCase().replace('-', ' ')}
                          </span>

                          {/* AC count */}
                          {Array.isArray(story.acceptanceCriteria) && story.acceptanceCriteria.length > 0 && (
                            <span style={{ fontSize: '10px', color: '#4A4A4A', fontFamily: '"JetBrains Mono", monospace' }}>
                              {story.acceptanceCriteria.length} AC
                            </span>
                          )}

                          <span style={{ flex: 1 }} />

                          {/* Delete story */}
                          <span
                            style={{ color: '#3A3A3A', fontSize: '12px', cursor: 'pointer' }}
                            onClick={() => deleteStory(feature.id, story.id)}
                          >
                            ×
                          </span>
                        </div>
                      </div>
                    ))}

                    {/* New Story Form */}
                    {storyForms[feature.id] ? (
                      <div style={{
                        background: '#0D0D0D', border: '1px solid #FF2A2A22', padding: '14px',
                        animation: 'dsFadeIn .15s ease-out',
                      }}>
                        <div className="ds-label" style={{ marginBottom: '10px', color: '#FF2A2A', fontSize: '10px' }}>NEW USER STORY</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#6A6A6A', whiteSpace: 'nowrap' }}>As a</span>
                            {personaNames.length > 0 ? (
                              <select
                                className="ds-input"
                                style={{ flex: 1, appearance: 'none', cursor: 'pointer' }}
                                value={storyInputs[feature.id]?.persona || ''}
                                onChange={(e) => updateStoryInput(feature.id, 'persona', e.target.value)}
                              >
                                {personaNames.map((name: string) => (
                                  <option key={name} value={name}>{name}</option>
                                ))}
                              </select>
                            ) : (
                              <input
                                className="ds-input"
                                style={{ flex: 1 }}
                                value={storyInputs[feature.id]?.persona || ''}
                                onChange={(e) => updateStoryInput(feature.id, 'persona', e.target.value)}
                                placeholder="user persona"
                              />
                            )}
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#6A6A6A', whiteSpace: 'nowrap' }}>I want to</span>
                            <input
                              className="ds-input"
                              style={{ flex: 1 }}
                              value={storyInputs[feature.id]?.action || ''}
                              onChange={(e) => updateStoryInput(feature.id, 'action', e.target.value)}
                              placeholder="perform this action"
                            />
                          </div>
                          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                            <span style={{ fontSize: '11px', color: '#6A6A6A', whiteSpace: 'nowrap' }}>So that</span>
                            <input
                              className="ds-input"
                              style={{ flex: 1 }}
                              value={storyInputs[feature.id]?.benefit || ''}
                              onChange={(e) => updateStoryInput(feature.id, 'benefit', e.target.value)}
                              placeholder="I get this benefit"
                              onKeyDown={(e) => e.key === 'Enter' && createStory(feature.id)}
                            />
                          </div>
                          <div>
                            <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.1em', marginBottom: '4px' }}>COMPLEXITY</div>
                            <div style={{ display: 'flex', gap: '6px' }}>
                              {['low', 'medium', 'high'].map((c) => (
                                <button
                                  key={c}
                                  onClick={() => updateStoryInput(feature.id, 'complexity', c)}
                                  style={{
                                    padding: '2px 10px', fontSize: '9px', letterSpacing: '.1em', cursor: 'pointer',
                                    background: storyInputs[feature.id]?.complexity === c ? `${COMPLEXITY_COLORS[c]}18` : 'transparent',
                                    border: `1px solid ${storyInputs[feature.id]?.complexity === c ? COMPLEXITY_COLORS[c] : '#2A2A2A'}`,
                                    color: storyInputs[feature.id]?.complexity === c ? COMPLEXITY_COLORS[c] : '#5A5A5A',
                                  }}
                                >
                                  {c.toUpperCase()}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                            <button
                              className="ds-btn-primary ds-btn-sm"
                              onClick={() => createStory(feature.id)}
                              disabled={creatingStory[feature.id]}
                              style={{ fontSize: '10px' }}
                            >
                              {creatingStory[feature.id] ? 'ADDING...' : '[ ADD STORY ]'}
                            </button>
                            <button
                              className="ds-btn-ghost ds-btn-sm"
                              onClick={() => setStoryForms((prev) => ({ ...prev, [feature.id]: false }))}
                              style={{ fontSize: '10px' }}
                            >
                              CANCEL
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <button
                        className="ds-btn-ghost ds-btn-sm"
                        onClick={() => openStoryForm(feature.id)}
                        style={{ alignSelf: 'flex-start', fontSize: '10px', marginTop: '4px' }}
                      >
                        [ + ADD USER STORY ]
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
