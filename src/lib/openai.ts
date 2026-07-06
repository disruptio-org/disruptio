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
      case 'google':
        baseURL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
        break;
      case 'ollama':
        baseURL = 'http://localhost:11434/v1';
        break;
      case 'deepseek':
        baseURL = 'https://api.deepseek.com/v1';
        break;
      case 'xai':
        baseURL = 'https://api.x.ai/v1';
        break;
      case 'mistral':
        baseURL = 'https://api.mistral.ai/v1';
        break;
      // openai, azure — use default or custom baseURL
    }
  }

  return new OpenAI({ apiKey, baseURL });
}

/**
 * Create a chat completion with automatic retry for unsupported params.
 * Some models (o1, o3, o4, gpt-5.x) don't support temperature or max_tokens.
 * This helper tries with the given params first, then retries without them if rejected.
 */
export async function safeCompletion(
  client: OpenAI,
  params: {
    model: string;
    messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
    temperature?: number;
    max_completion_tokens?: number;
  }
) {
  try {
    return await client.chat.completions.create(params);
  } catch (err: any) {
    const msg = err?.message || '';
    if (msg.includes('temperature') || msg.includes('max_tokens') || msg.includes('max_completion_tokens')) {
      // Retry without temperature and with different token param
      const { temperature, max_completion_tokens, ...rest } = params;
      return await client.chat.completions.create({
        ...rest,
        ...(max_completion_tokens && !msg.includes('max_completion_tokens') ? { max_completion_tokens } : {}),
      });
    }
    throw err;
  }
}
