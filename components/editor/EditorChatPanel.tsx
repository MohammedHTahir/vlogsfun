'use client';

import { AtSign, ArrowUp, Check, Loader2, Paperclip, Plus, Sparkles, SquarePen } from 'lucide-react';

const GENERATION_STEPS = [
  { label: 'Planning the layout', done: true },
  { label: 'Creating hero section', done: true },
  { label: 'Adding featured collections', done: true },
  { label: 'Designing newsletter section', done: true },
  { label: 'Finalizing design', done: false },
];

interface EditorChatPanelProps {
  prompt: string;
}

export default function EditorChatPanel({ prompt }: EditorChatPanelProps) {
  return (
    <aside className="flex w-[360px] shrink-0 flex-col border-r border-[#ece6e2] bg-white">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <button className="flex items-center gap-2 text-[15px] font-semibold text-[#ff6747] transition hover:text-[#f85b3a]">
          <Plus size={18} strokeWidth={2.2} />
          New chat
        </button>
        <button
          aria-label="Edit chat"
          className="grid h-9 w-9 place-items-center rounded-lg border border-[#e8e2de] bg-white text-[#4b5563] transition hover:bg-[#fff8f5]"
        >
          <SquarePen size={16} strokeWidth={1.9} />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6">
        <p className="text-xs font-medium text-[#9aa2af]">Today</p>

        {prompt && (
          <div className="flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-[#fff3ef] px-4 py-3 text-sm leading-6 text-[#111827]">
              {prompt}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <span className="mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#f0e9ff] text-[#8b6df5]">
            <Sparkles size={14} fill="currentColor" strokeWidth={1.5} />
          </span>
          <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-[#eee7e3] bg-white px-4 py-3 text-sm leading-6 text-[#374151]">
            I&apos;ll create a page based on your prompt with a clean, modern layout
            you can edit section by section.
          </div>
        </div>

        <div className="rounded-2xl border border-[#eee7e3] bg-[#fffdfc] p-4">
          <ul className="space-y-3">
            {GENERATION_STEPS.map((step) => (
              <li key={step.label} className="flex items-center gap-3 text-sm">
                {step.done ? (
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[#eaffef] text-[#35b86b]">
                    <Check size={13} strokeWidth={2.6} />
                  </span>
                ) : (
                  <span className="grid h-5 w-5 shrink-0 place-items-center text-[#9aa2af]">
                    <Loader2 size={15} strokeWidth={2} className="animate-spin" />
                  </span>
                )}
                <span className={step.done ? 'text-[#374151]' : 'text-[#9aa2af]'}>
                  {step.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="border-t border-[#f0ebe7] p-4">
        <div className="rounded-2xl border border-[#e8e2de] bg-white p-3 shadow-[0_10px_24px_rgba(31,41,55,0.05)]">
          <textarea
            aria-label="Ask anything about your theme"
            placeholder="Ask anything about your theme..."
            rows={2}
            className="w-full resize-none border-0 bg-transparent px-1 py-1 text-sm text-[#111827] outline-none placeholder:text-[#9aa2af]"
          />
          <div className="flex items-center justify-between pt-1">
            <div className="flex gap-1.5">
              <button
                aria-label="AI suggestions"
                className="grid h-9 w-9 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#fff3ef]"
              >
                <Sparkles size={16} strokeWidth={1.9} />
              </button>
              <button
                aria-label="Mention"
                className="grid h-9 w-9 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#fff3ef]"
              >
                <AtSign size={16} strokeWidth={1.9} />
              </button>
              <button
                aria-label="Attach file"
                className="grid h-9 w-9 place-items-center rounded-lg text-[#6b7280] transition hover:bg-[#fff3ef]"
              >
                <Paperclip size={16} strokeWidth={1.9} />
              </button>
            </div>
            <button
              aria-label="Send message"
              className="grid h-9 w-9 place-items-center rounded-lg bg-[#ff6747] text-white shadow-[0_10px_18px_rgba(255,103,71,0.22)] transition hover:bg-[#f85b3a]"
            >
              <ArrowUp size={18} strokeWidth={2.2} />
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
