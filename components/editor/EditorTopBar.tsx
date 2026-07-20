'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronLeft,
  Code2,
  Download,
  Eye,
  Save,
  Store,
} from 'lucide-react';

const EXPORT_OPTIONS = [
  { id: 'shopify', label: 'Export to Shopify', icon: Store },
  { id: 'zip', label: 'Download ZIP', icon: Download },
  { id: 'json', label: 'Export Theme JSON', icon: Code2 },
  { id: 'preview', label: 'Preview Theme', icon: Eye },
];

interface EditorTopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
}

export default function EditorTopBar({ collapsed, onToggleSidebar }: EditorTopBarProps) {
  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!exportOpen) return;
    function onClick(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setExportOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [exportOpen]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#ece6e2] bg-white px-4">
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="Shopify Theme Builder"
          width={34}
          height={34}
          className="shrink-0 rounded-lg"
          priority
        />
        <span className="hidden text-[15px] font-bold text-[#111827] sm:block">
          Shopify Theme Builder
        </span>
        <button
          aria-label={collapsed ? 'Expand chat panel' : 'Collapse chat panel'}
          onClick={onToggleSidebar}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#e8e2de] bg-white text-[#4b5563] transition hover:bg-[#fff8f5]"
        >
          <ChevronLeft
            size={17}
            strokeWidth={2}
            className={`transition-transform ${collapsed ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="relative" ref={exportRef}>
          <button
            onClick={() => setExportOpen((open) => !open)}
            className="flex h-11 items-center gap-2 rounded-xl border border-[#e8e2de] bg-white px-4 text-sm font-medium text-[#111827] shadow-[0_8px_20px_rgba(31,41,55,0.04)] transition hover:bg-[#fff8f5]"
          >
            <Store size={17} strokeWidth={1.9} className="text-[#35b86b]" />
            Export to Shopify
            <ChevronDown
              size={16}
              strokeWidth={2}
              className={`text-[#9aa2af] transition-transform ${exportOpen ? 'rotate-180' : ''}`}
            />
          </button>

          {exportOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-[#eee7e3] bg-white p-2 shadow-[0_24px_48px_rgba(31,41,55,0.14)]">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9aa2af]">
                Export options
              </p>
              {EXPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    key={option.id}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#111827] transition hover:bg-[#fff3ef]"
                  >
                    <Icon size={17} strokeWidth={1.9} className="text-[#6b7280]" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#ff6747] px-5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(255,103,71,0.2)] transition hover:bg-[#f85b3a]">
          <Save size={17} strokeWidth={1.9} />
          Save
        </button>
      </div>
    </header>
  );
}
