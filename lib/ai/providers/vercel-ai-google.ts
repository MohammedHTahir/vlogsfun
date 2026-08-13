import 'server-only';
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
 * Vercel AI Gateway adapter.
 *
 * Uses the Vercel AI SDK with a plain model string so requests are routed
 * through the Vercel AI Gateway and billed against your Vercel credits.
 * No external API key required — Vercel handles auth to the model provider.
 *
 * Env vars:
 *   AI_MODEL — model string as shown in the Vercel AI Gateway catalog.
 *              Default: "moonshotai/kimi-k3" (cheapest capable model).
 *              Examples: "openai/gpt-4o-mini", "google/gemini-2.5-flash"
 *
 * Docs: https://vercel.com/docs/ai/ai-gateway
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

// --- normalisation helpers ---

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
  // The Vercel AI Gateway uses a plain model string — no provider wrapper needed.
  // Vercel injects the necessary auth at the edge when deployed.
  const mdl = model;

  return {
    async planTurn(input: PlanTurnInput): Promise<TurnPlan> {
      const { system, messages } = toMessages(
        planTurnSystemPrompt(input.existingPages, input.activePageId),
        input.messages
      );
      const { text } = await generateText({
        model: mdl as Parameters<typeof generateText>[0]['model'],
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
        model: mdl as Parameters<typeof generateText>[0]['model'],
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
        model: mdl as Parameters<typeof streamText>[0]['model'],
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
        model: mdl as Parameters<typeof generateText>[0]['model'],
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
        model: mdl as Parameters<typeof generateText>[0]['model'],
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
