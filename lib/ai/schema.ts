import { z } from 'zod';
import type { BuilderPage, PageType } from './events';

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

/** Body of a POST to `/api/ai`. */
export const aiRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(50),
  /** Page tabs that already exist in the editor. */
  pages: z.array(builderPageSchema).max(12).default([]),
  /** Id of the page currently open in the preview, if any. */
  activePageId: z.string().max(40).nullish(),
});

export type AIRequest = z.infer<typeof aiRequestSchema>;

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
   * - `generate_page`: build/replace exactly one page now.
   */
  action: z.enum(['chat', 'generate_page']),
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
