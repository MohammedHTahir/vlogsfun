import type { BuilderPage } from './events';
import type { TurnPlan } from './schema';

/**
 * Provider-independent AI contract (AGENTS.md §7). The app never talks to a
 * model SDK directly — it goes through this interface, and model-specific code
 * stays inside the adapter under `providers/`. The active provider and model are
 * read from environment variables by the factory in `index.ts`.
 *
 * This is a focused subset of the full AGENTS.md interface: we implement only
 * the two capabilities the builder needs today (decide a turn, stream one page).
 * Editing patches and Shopify conversion get added to this contract when built.
 */

export interface PlanTurnInput {
  /** Full conversation so far (oldest first). */
  messages: { role: 'user' | 'assistant'; content: string }[];
  /** Page tabs that already exist. */
  existingPages: BuilderPage[];
  /** The page currently open in the preview, if any. */
  activePageId?: string | null;
  abortSignal?: AbortSignal;
}

export interface StreamPageInput {
  /** The page to generate. */
  page: BuilderPage;
  /** Full conversation for design context. */
  messages: { role: 'user' | 'assistant'; content: string }[];
  abortSignal?: AbortSignal;
}

export interface AIProvider {
  /**
   * Decide what to do with the latest user message: reply conversationally and,
   * when appropriate, plan the page tabs and pick the single page to build.
   */
  planTurn(input: PlanTurnInput): Promise<TurnPlan>;
  /** Stream the raw HTML body of one page as it is generated. */
  streamPage(input: StreamPageInput): AsyncIterable<string>;
}
