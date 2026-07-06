import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  console.warn('[Disruptio] OPENAI_API_KEY not set — AI features will be unavailable');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
});

export default openai;

/**
 * Map Disruptio model names to OpenAI model identifiers.
 * Custom agents may reference models by display name.
 */
export const MODEL_MAP: Record<string, string> = {
  'gpt-4': 'gpt-4o',
  'gpt-4o': 'gpt-4o',
  'gpt-3.5-turbo': 'gpt-3.5-turbo',
  'gpt-4-turbo': 'gpt-4-turbo',
  'o1-mini': 'o1-mini',
  'o1-preview': 'o1-preview',
};

export function resolveModel(model: string): string {
  return MODEL_MAP[model] || model || 'gpt-4o';
}

/**
 * Create an OpenAI-compatible client with per-project settings.
 * Falls back to global env key if no project key is set.
 */
export function createProjectClient(project: { aiProvider?: string | null; aiApiKey?: string | null; aiBaseUrl?: string | null }) {
  const apiKey = project.aiApiKey || process.env.OPENAI_API_KEY || '';

  // For different providers, adjust the base URL
  let baseURL: string | undefined = project.aiBaseUrl || undefined;

  if (!baseURL && project.aiProvider) {
    switch (project.aiProvider) {
      case 'anthropic':
        // Anthropic uses its own SDK, but can be accessed via OpenAI-compatible endpoint
        baseURL = undefined;
        break;
      case 'ollama':
        baseURL = 'http://localhost:11434/v1';
        break;
      case 'deepseek':
        baseURL = 'https://api.deepseek.com/v1';
        break;
      // openai, azure, google — use default or custom baseURL
    }
  }

  return new OpenAI({ apiKey, baseURL });
}
