'use client';

import { useState, useEffect, useCallback } from 'react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface DocType {
  id: string;
  label: string;
}

interface Doc {
  id: string;
  title: string;
  content: string;
  docType: string;
  agentId: string | null;
  version: number;
  status: string;
  metadata: any;
  createdAt: string;
  updatedAt: string;
}

interface DocumentationContentProps {
  project: any;
}

export default function DocumentationContent({ project }: DocumentationContentProps) {
  const [docs, setDocs] = useState<Doc[]>([]);
  const [docTypes, setDocTypes] = useState<DocType[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingAllProgress, setGeneratingAllProgress] = useState<{ current: number; total: number; currentType: string } | null>(null);
  const [selectedDoc, setSelectedDoc] = useState<Doc | null>(null);
  const [selectedAgent, setSelectedAgent] = useState('');
  const [error, setError] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const agents: { id: string; name: string; agentType: string }[] = project.agents || [];

  const fetchDocs = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${project.id}/documentation`);
      if (res.ok) {
        const data = await res.json();
        setDocs(data.docs || []);
        setDocTypes(data.docTypes || []);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [project.id]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const generate = async (docType: string) => {
    setGenerating(docType);
    setError('');
    try {
      const res = await fetch(`/api/projects/${project.id}/documentation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ docType, agentId: selectedAgent || undefined }),
      });
      const data = await res.json();
      if (res.ok) {
        await fetchDocs();
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setGenerating(null);
  };

  const generateAll = async () => {
    if (!selectedAgent) {
      setError('Please select an agent first');
      return;
    }
    setGeneratingAll(true);
    setError('');
    for (let i = 0; i < docTypes.length; i++) {
      const dt = docTypes[i];
      setGeneratingAllProgress({ current: i + 1, total: docTypes.length, currentType: dt.label });
      setGenerating(dt.id);
      try {
        const res = await fetch(`/api/projects/${project.id}/documentation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ docType: dt.id, agentId: selectedAgent }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(`Failed to generate ${dt.label}: ${data.error || 'Unknown error'}`);
        }
        await fetchDocs();
      } catch (err: any) {
        setError(`Error generating ${dt.label}: ${err.message}`);
      }
    }
    setGenerating(null);
    setGeneratingAll(false);
    setGeneratingAllProgress(null);
  };

  const deleteDoc = async (docId: string) => {
    try {
      await fetch(`/api/projects/${project.id}/documentation?docId=${docId}`, { method: 'DELETE' });
      setDocs(docs.filter(d => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      setDeleteConfirm(null);
    } catch { /* ignore */ }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ fontSize: '10px', letterSpacing: '.15em', color: '#5A5A5A' }}>LOADING DOCUMENTATION...</div>
      </div>
    );
  }

  // If viewing a specific doc
  if (selectedDoc) {
    const meta = selectedDoc.metadata as any;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Breadcrumb */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            className="ds-btn-ghost ds-btn-sm"
            onClick={() => setSelectedDoc(null)}
            style={{ fontSize: '10px', letterSpacing: '.1em' }}
          >
            ← BACK TO DOCUMENTATION
          </button>
          <span style={{ fontSize: '10px', color: '#3A3A3A' }}>|</span>
          <span style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.08em' }}>
            v{selectedDoc.version} — {new Date(selectedDoc.updatedAt).toLocaleDateString()}
          </span>
          {meta?.model && (
            <span style={{ fontSize: '9px', color: '#3A3A3A', fontFamily: '"JetBrains Mono", monospace' }}>
              {meta.model}
            </span>
          )}
          <button
            className="ds-btn-primary ds-btn-sm"
            style={{ marginLeft: 'auto', fontSize: '10px', letterSpacing: '.1em' }}
            onClick={() => generate(selectedDoc.docType)}
            disabled={!!generating}
          >
            {generating ? '[ REGENERATING... ]' : '[ REGENERATE ]'}
          </button>
        </div>

        {/* Document content */}
        <div className="ds-card" style={{ padding: '32px 40px' }}>
          <MarkdownRenderer content={selectedDoc.content} />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Header with Generate All */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: '14px', letterSpacing: '.15em', color: '#FFFFFF', fontWeight: 700, margin: 0 }}>DOCUMENTATION</h2>
          <p style={{ fontSize: '11px', color: '#5A5A5A', marginTop: '6px', lineHeight: 1.6 }}>
            Generate comprehensive product documentation using AI. Select an agent to shape the output.
          </p>
        </div>
        <button
          className="ds-btn-primary"
          onClick={generateAll}
          disabled={generatingAll || !!generating}
          style={{ fontSize: '10px', letterSpacing: '.1em', padding: '8px 20px', whiteSpace: 'nowrap' }}
        >
          {generatingAll ? '[ GENERATING ALL... ]' : '[ GENERATE ALL DOCUMENTATION ]'}
        </button>
      </div>

      {/* Agent selector */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '14px 20px', background: '#0D0D0D', border: '1px solid #1F1F1F',
      }}>
        <div style={{ fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', whiteSpace: 'nowrap' }}>AI AGENT</div>
        <select
          className="ds-input"
          style={{ width: '300px' }}
          value={selectedAgent}
          onChange={(e) => setSelectedAgent(e.target.value)}
        >
          <option value="">Select agent...</option>
          {agents.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
        <span style={{ fontSize: '10px', color: '#3A3A3A' }}>
          Agent context will shape the generated documentation
        </span>
      </div>

      {/* Generate All Progress */}
      {generatingAllProgress && (
        <div style={{
          padding: '12px 20px', background: '#0D0D0D', border: '1px solid #FF2A2A33',
          display: 'flex', alignItems: 'center', gap: '16px',
        }}>
          <div className="ds-spinner" style={{
            width: '14px', height: '14px', border: '2px solid #FF2A2A33',
            borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'spin 1s linear infinite',
            flexShrink: 0,
          }} />
          <span style={{ fontSize: '11px', color: '#FF2A2A', letterSpacing: '.08em' }}>
            GENERATING {generatingAllProgress.current}/{generatingAllProgress.total}
          </span>
          <span style={{ fontSize: '10px', color: '#5A5A5A' }}>
            {generatingAllProgress.currentType}
          </span>
          {/* Progress bar */}
          <div style={{ flex: 1, height: '3px', background: '#1A1A1A', position: 'relative' }}>
            <div style={{
              position: 'absolute', left: 0, top: 0, height: '100%',
              width: `${(generatingAllProgress.current / generatingAllProgress.total) * 100}%`,
              background: '#FF2A2A', transition: 'width 0.5s ease',
            }} />
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 16px', background: '#1A0808', border: '1px solid #FF2A2A33', fontSize: '11px', color: '#FF2A2A' }}>
          {error}
        </div>
      )}

      {/* Document rows — scrollable list like Agents page */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {docTypes.map((dt) => {
          const existingDoc = docs.find(d => d.docType === dt.id);
          const isGenerating = generating === dt.id;

          return (
            <div
              key={dt.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '16px',
                padding: '14px 20px', background: '#0D0D0D', border: '1px solid #1F1F1F',
                cursor: existingDoc && !isGenerating ? 'pointer' : 'default',
                transition: 'border-color .15s ease, background .15s ease',
                position: 'relative', overflow: 'hidden',
              }}
              onClick={() => existingDoc && !isGenerating && setSelectedDoc(existingDoc)}
              onMouseEnter={(e) => { if (existingDoc) e.currentTarget.style.borderColor = '#2A2A2A'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1F1F1F'; }}
            >
              {/* Status indicator */}
              {existingDoc ? (
                <span style={{
                  fontSize: '9px', color: '#2ECC71', letterSpacing: '.1em',
                  border: '1px solid #2ECC7133', padding: '2px 10px',
                  whiteSpace: 'nowrap',
                }}>
                  v{existingDoc.version}
                </span>
              ) : (
                <span style={{
                  fontSize: '9px', color: '#3A3A3A', letterSpacing: '.1em',
                  border: '1px solid #1F1F1F', padding: '2px 10px',
                  whiteSpace: 'nowrap',
                }}>
                  PENDING
                </span>
              )}

              {/* Doc type name */}
              <span style={{
                fontSize: '12px', color: existingDoc ? '#FFFFFF' : '#5A5A5A',
                fontWeight: 600, letterSpacing: '.04em', flex: 1,
              }}>
                {dt.label}
              </span>

              {/* Last updated */}
              {existingDoc && (
                <span style={{ fontSize: '9px', color: '#3A3A3A', whiteSpace: 'nowrap' }}>
                  {new Date(existingDoc.updatedAt).toLocaleDateString()} {new Date(existingDoc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                {deleteConfirm === existingDoc?.id ? (
                  <>
                    <button
                      style={{ fontSize: '9px', color: '#FF2A2A', border: '1px solid #FF2A2A', background: 'transparent', cursor: 'pointer', padding: '3px 10px', letterSpacing: '.05em' }}
                      onClick={() => existingDoc && deleteDoc(existingDoc.id)}
                    >
                      CONFIRM
                    </button>
                    <button
                      style={{ fontSize: '9px', color: '#5A5A5A', border: '1px solid #2A2A2A', background: 'transparent', cursor: 'pointer', padding: '3px 10px', letterSpacing: '.05em' }}
                      onClick={() => setDeleteConfirm(null)}
                    >
                      CANCEL
                    </button>
                  </>
                ) : (
                  <>
                    {existingDoc && (
                      <button
                        style={{ fontSize: '9px', color: '#FF2A2A', border: '1px solid #FF2A2A33', background: 'transparent', cursor: 'pointer', padding: '3px 10px', letterSpacing: '.05em' }}
                        onClick={() => setDeleteConfirm(existingDoc.id)}
                      >
                        DELETE
                      </button>
                    )}
                    <button
                      className="ds-btn-primary"
                      onClick={() => generate(dt.id)}
                      disabled={isGenerating || generatingAll}
                      style={{ fontSize: '9px', padding: '3px 12px', letterSpacing: '.05em' }}
                    >
                      {isGenerating ? 'GENERATING...' : existingDoc ? 'REGENERATE' : 'GENERATE'}
                    </button>
                  </>
                )}
              </div>

              {/* Generating overlay */}
              {isGenerating && (
                <div style={{
                  position: 'absolute', inset: 0, background: '#0A0A0AE0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  gap: '10px',
                }}>
                  <div className="ds-spinner" style={{
                    width: '14px', height: '14px', border: '2px solid #FF2A2A33',
                    borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'spin 1s linear infinite',
                  }} />
                  <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.15em' }}>GENERATING...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Spinner keyframes */}
      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
