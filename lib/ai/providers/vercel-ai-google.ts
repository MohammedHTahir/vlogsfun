import 'server-only';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { generateText, streamText } from 'ai';
import type {
  AIProvider,
  PlanTurnInput,
  StreamPageInput,
  EditPageInput,
  GenerateThemeInput,
  ShopifySectionInput,
} from '../types';
import {
  turnPlanSchema,
  pagePatchSchema,
  themeSpecSchema,
  shopifySectionSpecSchema,
  type TurnPlan,
  type PagePatch,
  type ThemeSpec,
  type ShopifySectionSpec,
} from '../schema';
import {
  planTurnSystemPrompt,
  streamPageSystemPrompt,
  editPageSystemPrompt,
  themeSystemPrompt,
  shopifySectionSystemPrompt,
} from '../prompts';

/**
 * Vercel AI SDK + Google Gemini adapter.
 * Replaces the direct @google/genai usage with the provider-independent
 * `ai` package so the app works cleanly on Vercel (AGENTS.md §7).
 *
 * Env vars:
 *   GOOGLE_GENERATIVE_AI_API_KEY  — Gemini API key (same key as before)
 *   AI_MODEL                      — model id, default "gemini-2.5-flash"
 */

type Turn = { role: 'user' | 'assistant'; content: string };

function toMessages(system: string, turns: Turn[]) {
  return {
    system,
    messages: turns.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
  };
}

// --- normalisation helpers (ported from gemini.ts) ---

function slugifyId(value: unknown, fallback: string): string {
  const slug = String(value ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return slug || fallback;
}

const TYPE_MAP: Record<string, string> = {
  homepage: 'home',
  'home-page': 'home',
  landing: 'home',
  'landing-page': 'home',
  index: 'home',
  products: 'product',
  'product-page': 'product',
  pdp: 'product',
  collections: 'collection',
  'collection-page': 'collection',
  plp: 'collection',
  'shopping-cart': 'cart',
  checkout: 'checkout',
  page: 'custom',
};

function normalizePage(raw: unknown, fallbackId: string): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const p = raw as Record<string, unknown>;
  const rawType = String(p.type ?? 'custom').toLowerCase().trim();
  const type = TYPE_MAP[rawType] ?? rawType;
  const label = String(p.label ?? 'Page').slice(0, 60) || 'Page';
  return {
    id: slugifyId(p.id, fallbackId),
    label,
    type,
    path: typeof p.path === 'string' && p.path.trim() ? p.path.trim().slice(0, 120) : '/',
  };
}

function normalizeTurnPlan(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw;
  const plan = raw as Record<string, unknown>;
  const plannedPages = Array.isArray(plan.plannedPages)
    ? plan.plannedPages.map((p, i) => normalizePage(p, `page-${i + 1}`))
    : [];
  return {
    reply: typeof plan.reply === 'string' && plan.reply.trim() ? plan.reply : 'Working on that now.',
    action: plan.action,
    plannedPages,
    targetPage: plan.targetPage ? normalizePage(plan.targetPage, 'home') : (plan.targetPage ?? null),
  };
}

// Strip markdown code fences the model sometimes wraps JSON in.
function stripJsonFences(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

export function createVercelAIGoogleProvider(model: string): AIProvider {
  // When VERCEL_AI_GATEWAY_URL is set, route requests through the Vercel AI
  // Gateway so Vercel credits are used instead of a direct Google API key.
  // Otherwise fall back to a direct Google API key (GOOGLE_GENERATIVE_AI_API_KEY).
  const gatewayUrl = process.env.VERCEL_AI_GATEWAY_URL;
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

  if (!gatewayUrl && !apiKey) {
    throw new Error(
      'Set either VERCEL_AI_GATEWAY_URL (Vercel AI Gateway) or GOOGLE_GENERATIVE_AI_API_KEY in your environment.'
    );
  }

  const google = gatewayUrl
    ? createGoogleGenerativeAI({ baseURL: gatewayUrl, apiKey: 'vercel' })
    : createGoogleGenerativeAI({ apiKey: apiKey! });

  const mdl = google(model);

  return {
    async planTurn(input: PlanTurnInput): Promise<TurnPlan> {
      const { system, messages } = toMessages(
        planTurnSystemPrompt(input.existingPages, input.activePageId),
        input.messages
      );
      const { text } = await generateText({
        model: mdl,
        system,
        messages,
        temperature: 0.7,
        abortSignal: input.abortSignal,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripJsonFences(text));
      } catch {
        return { reply: text.trim() || 'Sorry, could you rephrase that?', action: 'chat', plannedPages: [] };
      }

      const result = turnPlanSchema.safeParse(normalizeTurnPlan(parsed));
      if (!result.success) {
        console.error('[ai] planTurn schema mismatch:', result.error.issues, '\nraw:', text.slice(0, 500));
        return { reply: 'Sorry, I had trouble planning that. Could you rephrase?', action: 'chat', plannedPages: [] };
      }
      return result.data;
    },

    async generateTheme(input: GenerateThemeInput): Promise<ThemeSpec> {
      const { system, messages } = toMessages(themeSystemPrompt(), input.messages);
      const { text } = await generateText({
        model: mdl,
        system,
        messages,
        temperature: 0.7,
        maxOutputTokens: 8192,
        abortSignal: input.abortSignal,
      });

      let raw: unknown;
      try {
        raw = JSON.parse(stripJsonFences(text));
      } catch {
        throw new Error('The model returned an invalid theme.');
      }
      const parsed = themeSpecSchema.safeParse(raw);
      if (!parsed.success) throw new Error('The model returned an invalid theme.');
      return parsed.data;
    },

    async *streamPage(input: StreamPageInput): AsyncIterable<string> {
      const { system, messages } = toMessages(
        streamPageSystemPrompt(input.page, input.siblingPages, input.styleGuide),
        input.messages
      );
      const result = streamText({
        model: mdl,
        system,
        messages,
        temperature: 0.8,
        maxOutputTokens: 32768,
        abortSignal: input.abortSignal,
      });

      for await (const chunk of result.textStream) {
        if (chunk) yield chunk;
      }
    },

    async editPage(input: EditPageInput): Promise<PagePatch> {
      const { system, messages } = toMessages(
        editPageSystemPrompt(input.page, input.html, input.styleGuide),
        input.messages
      );
      const { text } = await generateText({
        model: mdl,
        system,
        messages,
        temperature: 0.4,
        maxOutputTokens: 32768,
        abortSignal: input.abortSignal,
      });

      let parsed: unknown;
      try {
        parsed = JSON.parse(stripJsonFences(text));
      } catch {
        return { operations: [] as PagePatch['operations'] };
      }

      const result = pagePatchSchema.safeParse(parsed);
      if (!result.success) return { operations: [] as PagePatch['operations'] };
      return result.data;
    },

    async generateShopifySection(input: ShopifySectionInput): Promise<ShopifySectionSpec> {
      const system = shopifySectionSystemPrompt({
        brandName: input.brandName,
        pageType: input.pageType,
        pageLabel: input.pageLabel,
        role: input.role,
        styleGuide: input.styleGuide,
      });
      const { text } = await generateText({
        model: mdl,
        system,
        messages: [{ role: 'user', content: input.html }],
        temperature: 0.4,
        maxOutputTokens: 32768,
        abortSignal: input.abortSignal,
      });

      let raw: unknown;
      try {
        raw = JSON.parse(stripJsonFences(text));
      } catch {
        throw new Error('The model returned an invalid Shopify section.');
      }
      const parsed = shopifySectionSpecSchema.safeParse(raw);
      if (!parsed.success) throw new Error('The model returned an invalid Shopify section.');
      return parsed.data;
    },
  };
}
