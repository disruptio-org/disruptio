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
};

export function resolveModel(model: string): string {
  return MODEL_MAP[model] || 'gpt-4o';
}
