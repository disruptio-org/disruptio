'use client';

import { useState, useEffect, useCallback } from 'react';
import MarkdownRenderer from '@/components/ui/MarkdownRenderer';

interface DocType {
  id: string;
  label: string;
  emoji: string;
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
        setSelectedDoc(data.doc);
        await fetchDocs();
      } else {
        setError(data.error || 'Generation failed');
      }
    } catch (err: any) {
      setError(err.message || 'Network error');
    }
    setGenerating(null);
  };

  const deleteDoc = async (docId: string) => {
    try {
      await fetch(`/api/projects/${project.id}/documentation?docId=${docId}`, { method: 'DELETE' });
      setDocs(docs.filter(d => d.id !== docId));
      if (selectedDoc?.id === docId) setSelectedDoc(null);
      setDeleteConfirm(null);
    } catch { /* ignore */ }
  };

  const labelStyle: React.CSSProperties = { fontSize: '10px', color: '#5A5A5A', letterSpacing: '.12em', marginBottom: '4px' };

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
      {/* Header */}
      <div>
        <h2 style={{ fontSize: '14px', letterSpacing: '.15em', color: '#FFFFFF', fontWeight: 700, margin: 0 }}>DOCUMENTATION</h2>
        <p style={{ fontSize: '11px', color: '#5A5A5A', marginTop: '6px', lineHeight: 1.6 }}>
          Generate comprehensive product documentation using AI. Select an agent and a documentation type to begin.
        </p>
      </div>

      {/* Agent selector */}
      <div className="ds-card" style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={labelStyle}>AI AGENT</div>
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
      </div>

      {/* Error */}
      {error && (
        <div style={{ padding: '10px 16px', background: '#1A0808', border: '1px solid #FF2A2A33', fontSize: '11px', color: '#FF2A2A' }}>
          ✕ {error}
        </div>
      )}

      {/* Doc type cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
        {docTypes.map((dt) => {
          const existingDoc = docs.find(d => d.docType === dt.id);
          const isGenerating = generating === dt.id;

          return (
            <div
              key={dt.id}
              className="ds-card"
              style={{
                padding: '20px',
                cursor: existingDoc && !isGenerating ? 'pointer' : 'default',
                borderColor: existingDoc ? '#2ECC7133' : '#1F1F1F',
                transition: 'border-color .15s ease',
                position: 'relative',
              }}
              onClick={() => existingDoc && !isGenerating && setSelectedDoc(existingDoc)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '18px' }}>{dt.emoji}</span>
                  <span style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: 600, letterSpacing: '.06em' }}>{dt.label}</span>
                </div>
                {existingDoc && (
                  <span style={{ fontSize: '9px', color: '#2ECC71', letterSpacing: '.1em', border: '1px solid #2ECC7133', padding: '2px 8px' }}>
                    v{existingDoc.version}
                  </span>
                )}
              </div>

              {existingDoc ? (
                <div style={{ fontSize: '10px', color: '#5A5A5A', lineHeight: 1.5 }}>
                  Last updated: {new Date(existingDoc.updatedAt).toLocaleString()}
                  <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
                    <button
                      className="ds-btn-primary ds-btn-sm"
                      onClick={(e) => { e.stopPropagation(); generate(dt.id); }}
                      disabled={isGenerating}
                      style={{ fontSize: '9px' }}
                    >
                      {isGenerating ? '[ GENERATING... ]' : '[ REGENERATE ]'}
                    </button>
                    {deleteConfirm === existingDoc.id ? (
                      <div style={{ display: 'flex', gap: '4px' }} onClick={(e) => e.stopPropagation()}>
                        <button className="ds-btn-sm" style={{ fontSize: '9px', color: '#FF2A2A', border: '1px solid #FF2A2A', background: 'transparent', cursor: 'pointer', padding: '2px 8px' }} onClick={() => deleteDoc(existingDoc.id)}>CONFIRM</button>
                        <button className="ds-btn-sm" style={{ fontSize: '9px', color: '#5A5A5A', border: '1px solid #2A2A2A', background: 'transparent', cursor: 'pointer', padding: '2px 8px' }} onClick={() => setDeleteConfirm(null)}>CANCEL</button>
                      </div>
                    ) : (
                      <button
                        className="ds-btn-sm"
                        onClick={(e) => { e.stopPropagation(); setDeleteConfirm(existingDoc.id); }}
                        style={{ fontSize: '9px', color: '#FF2A2A', border: '1px solid #FF2A2A33', background: 'transparent', cursor: 'pointer', padding: '2px 8px' }}
                      >
                        DELETE
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontSize: '10px', color: '#3A3A3A', marginBottom: '10px' }}>
                    Not generated yet
                  </div>
                  <button
                    className="ds-btn-primary ds-btn-sm"
                    onClick={(e) => { e.stopPropagation(); generate(dt.id); }}
                    disabled={isGenerating}
                    style={{ fontSize: '9px' }}
                  >
                    {isGenerating ? '[ GENERATING... ]' : '[ GENERATE ]'}
                  </button>
                </div>
              )}

              {/* Generating overlay */}
              {isGenerating && (
                <div style={{
                  position: 'absolute', inset: 0, background: '#0A0A0AE0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'column', gap: '8px',
                }}>
                  <div className="ds-spinner" style={{ width: '20px', height: '20px', border: '2px solid #FF2A2A33', borderTopColor: '#FF2A2A', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                  <span style={{ fontSize: '10px', color: '#FF2A2A', letterSpacing: '.15em' }}>GENERATING...</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Existing docs list (if more than doc types) */}
      {docs.length > 0 && (
        <div className="ds-card" style={{ padding: '20px' }}>
          <div className="ds-label" style={{ marginBottom: '12px' }}>GENERATED DOCUMENTS ({docs.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {docs.map((d) => (
              <div
                key={d.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 12px',
                  background: '#0D0D0D', border: '1px solid #1F1F1F', cursor: 'pointer',
                  transition: 'border-color .15s ease',
                }}
                onClick={() => setSelectedDoc(d)}
              >
                <span style={{ fontSize: '14px' }}>
                  {docTypes.find(dt => dt.id === d.docType)?.emoji || '📄'}
                </span>
                <span style={{ fontSize: '12px', color: '#B3B3B3', flex: 1 }}>{d.title}</span>
                <span style={{ fontSize: '9px', color: '#5A5A5A', fontFamily: '"JetBrains Mono", monospace' }}>
                  v{d.version}
                </span>
                <span style={{ fontSize: '9px', color: '#3A3A3A' }}>
                  {new Date(d.updatedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
