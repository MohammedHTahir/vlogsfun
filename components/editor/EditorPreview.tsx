'use client';

import { useState } from 'react';
import {
  Box,
  Grid3x3,
  Home,
  Loader2,
  Monitor,
  Plus,
  RotateCw,
  Smartphone,
  Tablet,
  X,
} from 'lucide-react';

type PageTabId = 'home' | 'product' | 'collection';

interface PageTab {
  id: PageTabId;
  label: string;
  icon: typeof Home;
  path: string;
}

const PAGE_TABS: PageTab[] = [
  { id: 'home', label: 'Home page', icon: Home, path: '/' },
  { id: 'product', label: 'Product page', icon: Box, path: '/products/sample-product' },
  { id: 'collection', label: 'Collection page', icon: Grid3x3, path: '/collections/all' },
];

type Viewport = 'desktop' | 'tablet' | 'mobile';

const VIEWPORTS: { id: Viewport; label: string; icon: typeof Monitor; width: string }[] = [
  { id: 'desktop', label: 'Desktop', icon: Monitor, width: '100%' },
  { id: 'tablet', label: 'Tablet', icon: Tablet, width: '768px' },
  { id: 'mobile', label: 'Mobile', icon: Smartphone, width: '390px' },
];

const STORE_DOMAIN = 'your-store.myshopify.com';

export default function EditorPreview() {
  const [tabs, setTabs] = useState<PageTab[]>(PAGE_TABS);
  const [activeTab, setActiveTab] = useState<PageTabId>('home');
  const [viewport, setViewport] = useState<Viewport>('desktop');

  const active = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];
  const viewportWidth = VIEWPORTS.find((v) => v.id === viewport)?.width ?? '100%';

  function closeTab(id: PageTabId) {
    setTabs((prev) => {
      const next = prev.filter((tab) => tab.id !== id);
      if (id === activeTab && next.length > 0) setActiveTab(next[0].id);
      return next;
    });
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#ece6e2] bg-white shadow-[0_10px_30px_rgba(31,41,55,0.05)]">
        {/* Browser tab strip */}
        <div className="flex items-center gap-1 border-b border-[#efeae6] bg-[#f4f0ec] px-2 pt-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = tab.id === active?.id;
            return (
              <div
                key={tab.id}
                className={`group flex h-9 min-w-0 max-w-[180px] items-center gap-2 rounded-t-lg px-3 text-sm transition ${isActive
                  ? '-mb-px border-x border-t border-[#efeae6] bg-white font-medium text-[#111827]'
                  : 'text-[#6b7280] hover:bg-white/60'
                  }`}
              >
                <button
                  onClick={() => setActiveTab(tab.id)}
                  className="flex min-w-0 items-center gap-2"
                >
                  <Icon
                    size={15}
                    strokeWidth={1.9}
                    className={isActive ? 'text-[#f05a32]' : 'text-[#9aa2af]'}
                  />
                  <span className="truncate">{tab.label}</span>
                </button>
                <button
                  aria-label={`Close ${tab.label}`}
                  onClick={() => closeTab(tab.id)}
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[#9aa2af] opacity-0 transition hover:bg-black/5 hover:text-[#4b5563] group-hover:opacity-100"
                >
                  <X size={13} strokeWidth={2.2} />
                </button>
              </div>
            );
          })}
          <button
            aria-label="Add page"
            className="mb-1 ml-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[#6b7280] transition hover:bg-white/70"
          >
            <Plus size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Browser toolbar / address bar */}
        <div className="flex items-center gap-3 border-b border-[#efeae6] bg-white px-3 py-2">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]" />
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-[#eee7e3] bg-[#faf8f6] px-3 py-1.5">
            <span className="grid h-4 w-4 place-items-center rounded-full bg-[#e8f6ee] text-[9px] font-bold text-[#35b86b]">
              ✓
            </span>
            <span className="truncate text-[13px] text-[#6b7280]">
              {STORE_DOMAIN}
              <span className="text-[#9aa2af]">{active?.path}</span>
            </span>
            <button
              aria-label="Reload preview"
              className="ml-auto grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#9aa2af] transition hover:bg-black/5 hover:text-[#4b5563]"
            >
              <RotateCw size={14} strokeWidth={2} />
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-lg border border-[#eee7e3] bg-white p-0.5">
            {VIEWPORTS.map((v) => {
              const Icon = v.icon;
              const isActive = v.id === viewport;
              return (
                <button
                  key={v.id}
                  aria-label={v.label}
                  aria-pressed={isActive}
                  onClick={() => setViewport(v.id)}
                  className={`grid h-7 w-7 place-items-center rounded-md transition ${isActive
                    ? 'bg-[#fff3ef] text-[#f05a32]'
                    : 'text-[#9aa2af] hover:bg-[#faf8f6] hover:text-[#4b5563]'
                    }`}
                >
                  <Icon size={15} strokeWidth={1.9} />
                </button>
              );
            })}
          </div>
        </div>

        {/* Canvas */}
        <div className="flex-1 overflow-auto bg-[#fafafa] p-4">
          <div
            className="mx-auto h-full min-h-full rounded-xl border border-[#ece6e2] bg-white transition-[max-width] duration-300"
            style={{ maxWidth: viewportWidth }}
          >
            <div className="grid h-full min-h-[320px] place-items-center">
              <div className="flex flex-col items-center gap-3 text-center text-[#9aa2af]">
                <Loader2 size={22} className="animate-spin text-[#ff8a66]" />
                <p className="text-sm font-medium">
                  Generating your {active?.label} preview…
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
