/**
 * Shared AI provider/model configuration.
 * Used in Settings page and Agent configuration.
 */
export const AI_PROVIDERS = [
  {
    id: 'openai', name: 'OpenAI', models: [
      'gpt-5.5', 'gpt-5.5-pro',
      'gpt-5.4-mini', 'gpt-5.4-nano',
      'gpt-4.1', 'gpt-4.1-mini', 'gpt-4.1-nano',
      'gpt-4o', 'gpt-4o-mini',
      'gpt-4-turbo', 'gpt-4',
      'o4-mini', 'o3', 'o3-mini',
      'o1', 'o1-mini', 'o1-preview',
      'gpt-3.5-turbo',
    ],
  },
  {
    id: 'anthropic', name: 'Anthropic', models: [
      'claude-fable-5', 'claude-mythos-5',
      'claude-sonnet-5',
      'claude-opus-4.8', 'claude-opus-4',
      'claude-sonnet-4-20250514',
      'claude-haiku-4.5',
      'claude-3.5-sonnet', 'claude-3.5-haiku',
      'claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku',
    ],
  },
  {
    id: 'google', name: 'Google AI (Gemini)', models: [
      'gemini-3.5-pro', 'gemini-3.5-flash',
      'gemini-3.1-pro', 'gemini-3.1-flash-lite',
      'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
      'gemini-2.0-flash',
      'gemini-1.5-pro', 'gemini-1.5-flash',
    ],
  },
  {
    id: 'azure', name: 'Azure OpenAI', models: [
      'gpt-5.5', 'gpt-5.5-pro',
      'gpt-4.1', 'gpt-4.1-mini',
      'gpt-4o', 'gpt-4o-mini',
      'gpt-4-turbo', 'gpt-4',
      'gpt-3.5-turbo',
    ],
  },
  {
    id: 'ollama', name: 'Ollama (Local)', models: [
      'llama3.3', 'llama3.2', 'llama3.1', 'llama3',
      'mistral', 'mixtral',
      'codellama', 'deepseek-coder-v2',
      'phi4', 'phi3', 'gemma2', 'qwen2.5',
      'command-r',
    ],
  },
  {
    id: 'deepseek', name: 'DeepSeek', models: [
      'deepseek-v4-pro', 'deepseek-v4-flash',
      'deepseek-chat', 'deepseek-reasoner',
      'deepseek-r1', 'deepseek-v3',
    ],
  },
  {
    id: 'xai', name: 'xAI (Grok)', models: [
      'grok-3', 'grok-3-mini',
      'grok-2', 'grok-2-mini',
    ],
  },
  {
    id: 'mistral', name: 'Mistral AI', models: [
      'mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest',
      'codestral-latest', 'pixtral-large-latest',
      'open-mistral-nemo',
    ],
  },
];

/** Get all available models for a specific provider, or all models if no provider specified */
export function getModelsForProvider(providerId?: string | null): string[] {
  if (providerId) {
    return AI_PROVIDERS.find(p => p.id === providerId)?.models || [];
  }
  // Return all models from all providers
  return AI_PROVIDERS.flatMap(p => p.models);
}
