'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createEventParser, type BuilderPage } from '@/lib/ai/events';
import { sanitizeGeneratedHtml } from '@/lib/ai/sanitize';

/**
 * Client-side builder state: chat messages, page tabs, and the live preview,
 * all driven by the NDJSON stream from `/api/ai`. This is the only place that
 * talks to the AI route so the editor components stay presentational.
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export type PageStatus = 'idle' | 'generating' | 'ready';

export interface PageState extends BuilderPage {
  html: string;
  status: PageStatus;
}

interface BuilderContextValue {
  messages: ChatMessage[];
  pages: PageState[];
  activePageId: string | null;
  activePage: PageState | null;
  isStreaming: boolean;
  generatingPageId: string | null;
  error: string | null;
  sendMessage: (text: string) => void;
  setActivePage: (id: string) => void;
  closePage: (id: string) => void;
  newChat: () => void;
}

const BuilderContext = createContext<BuilderContextValue | null>(null);

interface BuilderSnapshot {
  messages: ChatMessage[];
  pages: PageState[];
  activePageId: string | null;
  kickedOff: boolean;
}

export function useBuilder(): BuilderContextValue {
  const ctx = useContext(BuilderContext);
  if (!ctx) throw new Error('useBuilder must be used within <BuilderProvider>.');
  return ctx;
}

function newId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

function getStorageKey(projectId: string): string {
  return `builder-session:${projectId}`;
}

function readSnapshot(projectId: string): BuilderSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(getStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<BuilderSnapshot>;
    return {
      messages: Array.isArray(parsed.messages) ? parsed.messages : [],
      pages: Array.isArray(parsed.pages) ? parsed.pages : [],
      activePageId: typeof parsed.activePageId === 'string' ? parsed.activePageId : null,
      kickedOff: parsed.kickedOff === true,
    };
  } catch {
    return null;
  }
}

function writeSnapshot(projectId: string, snapshot: BuilderSnapshot): void {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(getStorageKey(projectId), JSON.stringify(snapshot));
}

/** Merge planned tabs into existing pages without duplicating ids. */
function mergePages(existing: PageState[], planned: BuilderPage[]): PageState[] {
  const byId = new Map(existing.map((p) => [p.id, p]));
  for (const page of planned) {
    if (!byId.has(page.id)) {
      byId.set(page.id, { ...page, html: '', status: 'idle' });
    }
  }
  return Array.from(byId.values());
}

export function BuilderProvider({
  projectId,
  initialPrompt,
  children,
}: {
  projectId: string;
  initialPrompt?: string;
  children: ReactNode;
}) {
  // State starts empty so the first client render matches the server-rendered
  // HTML (no hydration mismatch). The saved session is restored in an effect
  // after mount — see below.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [pages, setPages] = useState<PageState[]>([]);
  const [activePageId, setActivePageId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [generatingPageId, setGeneratingPageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Mirror of state read inside the async streaming loop (avoids stale closures).
  const stateRef = useRef({ messages, pages, activePageId });
  useEffect(() => {
    stateRef.current = { messages, pages, activePageId };
  }, [messages, pages, activePageId]);

  const kickedOff = useRef(false);
  const hydratedRef = useRef(false);

  // Restore any saved session for this project, once, after mount. Setting state
  // from storage here is intentional (client-only session rehydration), which is
  // why the initial state is empty to keep SSR hydration consistent.
  useEffect(() => {
    const snapshot = readSnapshot(projectId);
    if (snapshot) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setMessages(snapshot.messages);
      setPages(snapshot.pages);
      setActivePageId(snapshot.activePageId);
      /* eslint-enable react-hooks/set-state-in-effect */
      kickedOff.current = snapshot.kickedOff;
    }
    hydratedRef.current = true;
    setHydrated(true);
  }, [projectId]);

  // Persist the session — but only after hydration, so we never overwrite a
  // saved session with the empty initial state.
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeSnapshot(projectId, {
      messages,
      pages,
      activePageId,
      kickedOff: kickedOff.current,
    });
  }, [projectId, messages, pages, activePageId]);

  const abortRef = useRef<AbortController | null>(null);
  // Accumulated raw HTML per streaming page + a throttled flush to the preview.
  const rawHtmlRef = useRef<Record<string, string>>({});
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const sendMessage = useCallback((text: string) => {
    const content = text.trim();
    if (!content || abortRef.current) return;

    const priorMessages = stateRef.current.messages;
    const outgoing = [...priorMessages, { role: 'user' as const, content }];

    const assistantId = newId();
    setError(null);
    setMessages((prev) => [
      ...prev,
      { id: newId(), role: 'user', content },
      { id: assistantId, role: 'assistant', content: '' },
    ]);
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const updateAssistant = (updater: (text: string) => string) =>
      setMessages((prev) =>
        prev.map((m) => (m.id === assistantId ? { ...m, content: updater(m.content) } : m))
      );

    (async () => {
      try {
        const res = await fetch('/api/ai', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: outgoing.map(({ role, content }) => ({ role, content })),
            pages: stateRef.current.pages.map(({ id, label, type, path }) => ({ id, label, type, path })),
            activePageId: stateRef.current.activePageId,
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => null);
          throw new Error(body?.error ?? `Request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        const parser = createEventParser();

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          for (const event of parser.push(decoder.decode(value, { stream: true }))) {
            switch (event.type) {
              case 'message':
                updateAssistant(() => event.text);
                break;
              case 'plan':
                setPages((prev) => mergePages(prev, event.pages));
                break;
              case 'page_start':
                rawHtmlRef.current[event.page.id] = '';
                setPages((prev) =>
                  mergePages(prev, [event.page]).map((p) =>
                    p.id === event.page.id ? { ...p, status: 'generating', html: '' } : p
                  )
                );
                setActivePageId(event.page.id);
                setGeneratingPageId(event.page.id);
                break;
              case 'page_delta': {
                const pageId = event.pageId;
                rawHtmlRef.current[pageId] = (rawHtmlRef.current[pageId] ?? '') + event.chunk;
                // Throttle preview updates (~8/sec) so we sanitize + re-render a
                // handful of times, not once per streamed token.
                if (flushTimerRef.current == null) {
                  flushTimerRef.current = setTimeout(() => {
                    flushTimerRef.current = null;
                    const html = sanitizeGeneratedHtml(rawHtmlRef.current[pageId] ?? '');
                    setPages((prev) => prev.map((p) => (p.id === pageId ? { ...p, html } : p)));
                  }, 120);
                }
                break;
              }
              case 'page_end': {
                if (flushTimerRef.current != null) {
                  clearTimeout(flushTimerRef.current);
                  flushTimerRef.current = null;
                }
                delete rawHtmlRef.current[event.pageId];
                setPages((prev) =>
                  prev.map((p) =>
                    p.id === event.pageId ? { ...p, html: event.html, status: 'ready' } : p
                  )
                );
                setGeneratingPageId(null);
                break;
              }
              case 'error':
                setError(event.message);
                updateAssistant((t) => t || 'Something went wrong while generating.');
                break;
              case 'done':
                break;
            }
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Generation failed.');
          updateAssistant((t) => t || 'Something went wrong. Please try again.');
        }
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
        setGeneratingPageId(null);
      }
    })();
  }, []);

  // Auto-send the project's founding prompt exactly once — after the saved
  // session has been restored, so a completed project doesn't re-generate.
  useEffect(() => {
    if (!hydrated || kickedOff.current) return;
    if (initialPrompt && initialPrompt.trim()) {
      kickedOff.current = true;
      sendMessage(initialPrompt);
    }
  }, [hydrated, initialPrompt, sendMessage]);

  const setActivePage = useCallback((id: string) => setActivePageId(id), []);

  const closePage = useCallback((id: string) => {
    setPages((prev) => {
      const next = prev.filter((p) => p.id !== id);
      setActivePageId((current) => (current === id ? next[0]?.id ?? null : current));
      return next;
    });
  }, []);

  const newChat = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    if (flushTimerRef.current != null) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    rawHtmlRef.current = {};
    kickedOff.current = true; // don't re-fire the initial prompt after a reset
    setMessages([]);
    setPages([]);
    setActivePageId(null);
    setGeneratingPageId(null);
    setError(null);
    setIsStreaming(false);
    writeSnapshot(projectId, {
      messages: [],
      pages: [],
      activePageId: null,
      kickedOff: true,
    });
  }, [projectId]);

  useEffect(
    () => () => {
      abortRef.current?.abort();
      if (flushTimerRef.current != null) clearTimeout(flushTimerRef.current);
    },
    []
  );

  const activePage = useMemo(
    () => pages.find((p) => p.id === activePageId) ?? null,
    [pages, activePageId]
  );

  const value: BuilderContextValue = {
    messages,
    pages,
    activePageId,
    activePage,
    isStreaming,
    generatingPageId,
    error,
    sendMessage,
    setActivePage,
    closePage,
    newChat,
  };

  return <BuilderContext.Provider value={value}>{children}</BuilderContext.Provider>;
}
