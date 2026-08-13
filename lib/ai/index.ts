import 'server-only';
import type { AIProvider } from './types';
import { createGeminiProvider } from './providers/gemini';
import { createVercelAIGoogleProvider } from './providers/vercel-ai-google';

/**
 * AI provider factory. Reads the active provider and model from the environment
 * (AGENTS.md §7) so the app stays provider-independent and no model name is
 * hardcoded into feature code.
 *
 *   AI_PROVIDER  — "vercel-ai-google" (recommended for Vercel deployments) or
 *                  "gemini" (direct SDK, legacy). Defaults to "vercel-ai-google".
 *   AI_MODEL     — model id for the active provider. Default: "gemini-2.5-flash".
 *
 * Vercel AI SDK (vercel-ai-google) reads: GOOGLE_GENERATIVE_AI_API_KEY
 * Legacy Gemini SDK (gemini) reads:       GEMINI_API_KEY
 */
export function getAIProvider(): AIProvider {
  const provider = (process.env.AI_PROVIDER ?? 'vercel-ai-google').toLowerCase();
  const model = process.env.AI_MODEL ?? 'gemini-2.5-flash';

  switch (provider) {
    case 'vercel-ai-google':
      return createVercelAIGoogleProvider(model);
    case 'gemini':
      return createGeminiProvider(model);
    default:
      throw new Error(
        `Unsupported AI_PROVIDER "${provider}". Valid values: "vercel-ai-google", "gemini".`
      );
  }
}

export type { AIProvider } from './types';
