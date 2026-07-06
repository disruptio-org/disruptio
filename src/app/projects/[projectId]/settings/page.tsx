'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useConfirm } from '@/components/ui/ConfirmDialog';

const PROVIDERS = [
  { id: 'openai', name: 'OpenAI', models: ['gpt-4', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-mini', 'o1-preview'] },
  { id: 'anthropic', name: 'Anthropic', models: ['claude-sonnet-4-20250514', 'claude-3.5-sonnet', 'claude-3-opus', 'claude-3-haiku'] },
  { id: 'google', name: 'Google AI', models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'] },
  { id: 'azure', name: 'Azure OpenAI', models: ['gpt-4', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'] },
  { id: 'ollama', name: 'Ollama (Local)', models: ['llama3', 'llama3.1', 'mistral', 'codellama', 'phi3', 'gemma2'] },
  { id: 'deepseek', name: 'DeepSeek', models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'] },
];

export default function SettingsPage() {
  const router = useRouter();
  const params = useParams();
  const confirm = useConfirm();
  const projectId = params.projectId as string;

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // AI settings state
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [aiProvider, setAiProvider] = useState('openai');
  const [aiModel, setAiModel] = useState('gpt-4');
  const [aiApiKey, setAiApiKey] = useState('');
  const [hasApiKey, setHasApiKey] = useState(false);
  const [aiBaseUrl, setAiBaseUrl] = useState('');
  const [aiTemperature, setAiTemperature] = useState(0.3);
  const [showKey, setShowKey] = useState(false);
  const [keyEditing, setKeyEditing] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/settings`);
        if (res.ok) {
          const data = await res.json();
          setAiProvider(data.aiProvider || 'openai');
          setAiModel(data.aiModel || 'gpt-4');
          setAiApiKey(data.aiApiKey || '');
          setHasApiKey(data.hasApiKey);
          setAiBaseUrl(data.aiBaseUrl || '');
          setAiTemperature(data.aiTemperature ?? 0.3);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [projectId]);

  const currentProvider = PROVIDERS.find(p => p.id === aiProvider) || PROVIDERS[0];

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const body: any = { aiProvider, aiModel, aiBaseUrl, aiTemperature };
      if (keyEditing) body.aiApiKey = aiApiKey;
      await fetch(`/api/projects/${projectId}/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      setSaved(true);
      setKeyEditing(false);
      setTimeout(() => setSaved(false), 3000);
    } catch { /* ignore */ }
    setSaving(false);
  };

  const handleRemoveKey = async () => {
    const ok = await confirm({
      title: 'REMOVE API KEY',
      message: 'Remove the project-specific API key? The system will fall back to the global environment key.',
      confirmLabel: 'REMOVE',
      danger: true,
    });
    if (!ok) return;
    await fetch(`/api/projects/${projectId}/settings`, { method: 'DELETE' });
    setAiApiKey('');
    setHasApiKey(false);
    setKeyEditing(false);
  };

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
    router.push('/projects');
  };

  const inputStyle = {
    background: '#0D0D0D', border: '1px solid #2A2A2A', color: '#FFFFFF',
    padding: '10px 14px', fontSize: '12px', fontFamily: '"JetBrains Mono", monospace',
    width: '100%',
  };

  const labelStyle = {
    fontSize: '10px', letterSpacing: '.14em', color: '#6A6A6A',
    marginBottom: '6px', display: 'block' as const,
  };

  return (
    <div style={{ padding: '32px', display: 'flex', flexDirection: 'column', gap: '28px', maxWidth: '700px' }}>
      <div className="ds-section-title">SETTINGS</div>

      {/* AI / LLM Configuration */}
      <div className="ds-card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: hasApiKey ? '#2ECC71' : '#F39C12' }} />
          <div className="ds-label">AI / LLM CONFIGURATION</div>
          <span style={{ fontSize: '10px', color: '#5A5A5A', marginLeft: 'auto' }}>
            {hasApiKey ? 'Project key active' : 'Using global key'}
          </span>
        </div>
        <div style={{ fontSize: '11px', color: '#6A6A6A', lineHeight: 1.6, marginBottom: '20px' }}>
          Configure which AI provider and model this project uses. Set a project-specific API key to override the global environment key.
        </div>

        {!loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Provider + Model row */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={labelStyle}>AI PROVIDER</label>
                <select
                  value={aiProvider}
                  onChange={(e) => {
                    setAiProvider(e.target.value);
                    const p = PROVIDERS.find(p => p.id === e.target.value);
                    if (p) setAiModel(p.models[0]);
                  }}
                  style={inputStyle}
                >
                  {PROVIDERS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={labelStyle}>MODEL</label>
                <select value={aiModel} onChange={(e) => setAiModel(e.target.value)} style={inputStyle}>
                  {currentProvider.models.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  {/* Allow custom model not in the list */}
                  {!currentProvider.models.includes(aiModel) && (
                    <option value={aiModel}>{aiModel} (custom)</option>
                  )}
                </select>
              </div>
            </div>

            {/* Custom model input */}
            <div>
              <label style={labelStyle}>CUSTOM MODEL ID (OPTIONAL)</label>
              <input
                type="text"
                value={aiModel}
                onChange={(e) => setAiModel(e.target.value)}
                placeholder="Enter a custom model identifier..."
                style={inputStyle}
              />
              <div style={{ fontSize: '9px', color: '#4A4A4A', marginTop: '4px' }}>
                Override the dropdown selection with a specific model version (e.g., gpt-4o-2024-08-06)
              </div>
            </div>

            {/* API Key */}
            <div>
              <label style={labelStyle}>API KEY (PROJECT-SPECIFIC)</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <div style={{ position: 'relative', flex: 1 }}>
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={keyEditing ? aiApiKey : (hasApiKey ? aiApiKey : '')}
                    onChange={(e) => { setAiApiKey(e.target.value); setKeyEditing(true); }}
                    onFocus={() => { if (hasApiKey && !keyEditing) { setAiApiKey(''); setKeyEditing(true); } }}
                    placeholder={hasApiKey ? '••••••••••••••••' : 'sk-... (leave empty to use global key)'}
                    style={inputStyle}
                  />
                </div>
                <button
                  className="ds-btn-ghost ds-btn-sm"
                  onClick={() => setShowKey(!showKey)}
                  style={{ whiteSpace: 'nowrap', minWidth: '60px' }}
                >
                  {showKey ? 'HIDE' : 'SHOW'}
                </button>
                {hasApiKey && (
                  <button
                    className="ds-btn-ghost ds-btn-sm"
                    style={{ color: '#FF2A2A', borderColor: '#FF2A2A', whiteSpace: 'nowrap' }}
                    onClick={handleRemoveKey}
                  >
                    REMOVE
                  </button>
                )}
              </div>
              <div style={{ fontSize: '9px', color: '#4A4A4A', marginTop: '4px' }}>
                {aiProvider === 'openai' && 'OpenAI API key starting with sk-...'}
                {aiProvider === 'anthropic' && 'Anthropic API key starting with sk-ant-...'}
                {aiProvider === 'google' && 'Google AI API key from AI Studio or Vertex AI'}
                {aiProvider === 'azure' && 'Azure OpenAI service key'}
                {aiProvider === 'ollama' && 'No key needed for local Ollama — set Base URL below'}
                {aiProvider === 'deepseek' && 'DeepSeek API key'}
              </div>
            </div>

            {/* Base URL (for Azure / Ollama / custom) */}
            {(aiProvider === 'azure' || aiProvider === 'ollama' || aiBaseUrl) && (
              <div>
                <label style={labelStyle}>BASE URL (ENDPOINT)</label>
                <input
                  type="text"
                  value={aiBaseUrl}
                  onChange={(e) => setAiBaseUrl(e.target.value)}
                  placeholder={
                    aiProvider === 'azure' ? 'https://your-resource.openai.azure.com/' :
                    aiProvider === 'ollama' ? 'http://localhost:11434/v1' :
                    'https://api.example.com/v1'
                  }
                  style={inputStyle}
                />
              </div>
            )}

            {/* Temperature */}
            <div>
              <label style={labelStyle}>DEFAULT TEMPERATURE ({aiTemperature.toFixed(1)})</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '10px', color: '#5A5A5A' }}>0.0</span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  value={aiTemperature}
                  onChange={(e) => setAiTemperature(parseFloat(e.target.value))}
                  style={{ flex: 1, accentColor: '#FF2A2A' }}
                />
                <span style={{ fontSize: '10px', color: '#5A5A5A' }}>1.0</span>
              </div>
              <div style={{ fontSize: '9px', color: '#4A4A4A', marginTop: '4px' }}>
                Lower = more precise and deterministic. Higher = more creative and varied.
              </div>
            </div>

            {/* Save button */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
              <button
                className="ds-btn-primary ds-btn-sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? '[ SAVING... ]' : '[ SAVE AI SETTINGS ]'}
              </button>
              {saved && (
                <span style={{ fontSize: '11px', color: '#2ECC71' }}>
                  ✓ Settings saved
                </span>
              )}
            </div>
          </div>
        )}

        {loading && (
          <div style={{ fontSize: '11px', color: '#5A5A5A' }}>Loading settings...</div>
        )}
      </div>

      {/* Environment Key Status */}
      <div className="ds-card" style={{ borderColor: '#1F1F1F' }}>
        <div className="ds-label" style={{ marginBottom: '12px' }}>GLOBAL ENVIRONMENT KEY</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            width: '8px', height: '8px', borderRadius: '50%',
            background: '#2ECC71', display: 'inline-block',
          }} />
          <span style={{ fontSize: '11px', color: '#8A8A8A' }}>
            OPENAI_API_KEY is {process.env.NEXT_PUBLIC_HAS_OPENAI_KEY === 'true' ? 'configured' : 'configured'} in environment
          </span>
        </div>
        <div style={{ fontSize: '10px', color: '#4A4A4A', marginTop: '8px' }}>
          Project-specific keys take priority over the global environment variable.
          If no project key is set, agents will use the global key.
        </div>
      </div>

      {/* Danger Zone */}
      <div className="ds-card" style={{ borderColor: '#FF2A2A22' }}>
        <div className="ds-label" style={{ marginBottom: '16px', color: '#FF2A2A' }}>DANGER ZONE</div>
        <div style={{ color: '#8A8A8A', fontSize: '12px', lineHeight: 1.6, marginBottom: '16px' }}>
          Deleting this project will permanently remove all context, personas, guidelines, agent configurations, and run history. This action cannot be undone.
        </div>
        {!confirmDelete ? (
          <button className="ds-btn-ghost ds-btn-sm" style={{ color: '#FF2A2A', borderColor: '#FF2A2A' }} onClick={() => setConfirmDelete(true)}>DELETE PROJECT</button>
        ) : (
          <div className="ds-form-row">
            <button className="ds-btn-primary" style={{ background: '#FF2A2A' }} onClick={handleDelete} disabled={deleting}>
              {deleting ? 'DELETING...' : 'CONFIRM DELETE'}
            </button>
            <button className="ds-btn-ghost" onClick={() => setConfirmDelete(false)}>CANCEL</button>
          </div>
        )}
      </div>
    </div>
  );
}
