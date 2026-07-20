import { z } from 'zod';
import type { BuilderPage, PageType, PatchOperation } from './events';

/**
 * Zod schemas for every AI input/output boundary (AGENTS.md §6: validate all AI
 * output before acting on it). Nothing the model returns is trusted until it
 * passes through here.
 */

export const pageTypeSchema = z.enum([
  'home',
  'product',
  'collection',
  'cart',
  'checkout',
  'custom',
]);

export const builderPageSchema = z.object({
  id: z
    .string()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Page id must be a lowercase slug.'),
  label: z.string().min(1).max(60),
  type: pageTypeSchema,
  path: z.string().min(1).max(120),
});

/** A single chat turn coming from the client. */
export const chatMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().min(1).max(8000),
});

/**
 * The project-level global theme: one shared stylesheet (design tokens,
 * reusable component classes, brand/logo treatment) plus a short style guide.
 * Generated once per project and reused so every page stays consistent.
 */
export const themeSpecSchema = z.object({
  css: z.string().min(1).max(30_000),
  styleGuide: z.string().min(1).max(5_000),
});

export type ThemeSpec = z.infer<typeof themeSpecSchema>;

/** Body of a POST to `/api/ai`. */
export const aiRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  /** Page tabs that already exist in the editor. */
  pages: z.array(builderPageSchema).max(12).default([]),
  /** Id of the page currently open in the preview, if any. */
  activePageId: z.string().max(40).nullish(),
  /** The project's existing global theme, if one has been generated. */
  theme: themeSpecSchema.nullish(),
  /**
   * Current HTML of the open page, sent so a scoped edit can target existing
   * element ids instead of regenerating the whole page. Only the open page's
   * HTML is sent to keep the payload small.
   */
  activePageHtml: z.string().max(200_000).nullish(),
});

export type AIRequest = z.infer<typeof aiRequestSchema>;

/** A stable builder id used to target an element/section for a scoped edit. */
const builderTargetIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-zA-Z0-9_-]+$/, 'Target id must be a builder id slug.');

/**
 * One scoped edit operation. Kept as a discriminated union so each op only
 * carries the fields it needs, and every field is length-bounded (AGENTS.md §6).
 */
export const patchOperationSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('replace_inner'), targetId: builderTargetIdSchema, html: z.string().max(20_000) }),
  z.object({ op: z.literal('replace_outer'), targetId: builderTargetIdSchema, html: z.string().max(20_000) }),
  z.object({ op: z.literal('set_text'), targetId: builderTargetIdSchema, text: z.string().max(5_000) }),
  z.object({ op: z.literal('set_classes'), targetId: builderTargetIdSchema, className: z.string().max(2_000) }),
  z.object({
    op: z.literal('set_attribute'),
    targetId: builderTargetIdSchema,
    name: z.enum(['src', 'alt', 'href', 'title']),
    value: z.string().max(2_000),
  }),
]) satisfies z.ZodType<PatchOperation>;

/** The model's scoped-edit output: a small set of operations to apply in place. */
export const pagePatchSchema = z.object({
  operations: z.array(patchOperationSchema).min(1).max(30),
});

export type PagePatch = z.infer<typeof pagePatchSchema>;

/**
 * The model's decision for a turn: what to say, and whether/what to build. The
 * model returns this as JSON; we generate the actual page HTML in a second,
 * streamed call so only one page is ever produced per turn (product rule).
 */
export const turnPlanSchema = z.object({
  /** Conversational reply shown in the chat. Always present. */
  reply: z.string().min(1).max(4000),
  /**
   * - `chat`: just talk (answered a question / asked for clarification).
   * - `generate_page`: build a NEW page or fully replace one from scratch.
   * - `edit_page`: apply a small scoped change to the currently open page,
   *   preserving the rest of it (no full regeneration).
   */
  action: z.enum(['chat', 'generate_page', 'edit_page']),
  /**
   * When the user asked for a whole store, the full tab set to create. The first
   * page (or `targetPage`) is the only one generated this turn.
   */
  plannedPages: z.array(builderPageSchema).max(8).default([]),
  /** The single page to generate this turn (required when action is generate_page). */
  targetPage: builderPageSchema.nullish(),
});

export type TurnPlan = z.infer<typeof turnPlanSchema>;

// Re-export the shared runtime types for convenience.
export type { BuilderPage, PageType };
