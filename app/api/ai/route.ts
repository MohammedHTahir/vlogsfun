import { NextRequest } from 'next/server';
import { getAIProvider } from '@/lib/ai';
import { aiRequestSchema } from '@/lib/ai/schema';
import { sanitizeGeneratedHtml } from '@/lib/ai/sanitize';
import { encodeEvent, type AIStreamEvent, type BuilderPage } from '@/lib/ai/events';

export const runtime = 'nodejs';

/**
 * Thin streaming route handler (AGENTS.md §5: route handlers stay thin — no AI
 * or business logic here). It validates input, delegates to the active AI
 * provider, and streams NDJSON events back to the builder client.
 */
export async function POST(req: NextRequest) {
  const parsed = aiRequestSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
  const { messages, pages, activePageId } = parsed.data;

  let provider;
  try {
    provider = getAIProvider();
  } catch (err) {
    return Response.json(
      { error: err instanceof Error ? err.message : 'AI provider unavailable.' },
      { status: 500 }
    );
  }

  const encoder = new TextEncoder();
  const abort = req.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AIStreamEvent) => controller.enqueue(encoder.encode(encodeEvent(event)));

      try {
        // Phase 1 — decide what to say and whether to build one page.
        const plan = await provider.planTurn({
          messages,
          existingPages: pages,
          activePageId,
          abortSignal: abort,
        });

        send({ type: 'message', text: plan.reply });

        if (plan.plannedPages.length > 0) {
          send({ type: 'plan', pages: plan.plannedPages });
        }

        // Phase 2 — generate exactly one page, if requested.
        const target: BuilderPage | null | undefined =
          plan.action === 'generate_page'
            ? plan.targetPage ?? plan.plannedPages[0] ?? null
            : null;

        if (target) {
          send({ type: 'page_start', page: target });
          let html = '';
          for await (const chunk of provider.streamPage({ page: target, messages, abortSignal: abort })) {
            if (abort.aborted) break;
            html += chunk;
            // Stream the small incremental chunk — the client accumulates and
            // sanitizes for the live preview. Avoids re-sending the whole
            // (growing) document on every tick.
            send({ type: 'page_delta', pageId: target.id, chunk });
          }
          // Final authoritative, fully-sanitized document for the page.
          send({ type: 'page_end', pageId: target.id, html: sanitizeGeneratedHtml(html) });
        }

        send({ type: 'done' });
      } catch (err) {
        if (!abort.aborted) {
          send({ type: 'error', message: err instanceof Error ? err.message : 'Generation failed.' });
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
    },
  });
}
