'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Image from 'next/image';
import {
  ChevronDown,
  ChevronLeft,
  Code2,
  Download,
  Eye,
  FileImage,
  Loader2,
  Save,
  Store,
} from 'lucide-react';
import { useBuilder } from './BuilderContext';
import ExportDialog from './ExportDialog';
import { useSubscription } from '@/components/billing/SubscriptionProvider';
import UpgradeDialog from '@/components/billing/UpgradeDialog';
import { exportPagesAsCodeZip } from '@/lib/export/code';
import { exportPagesAsPng } from '@/lib/export/png';
import type { ExportPage } from '@/lib/shopify/types';

interface EditorTopBarProps {
  collapsed: boolean;
  onToggleSidebar: () => void;
  projectId: string;
  projectName: string;
}

export default function EditorTopBar({
  collapsed,
  onToggleSidebar,
  projectId,
  projectName,
}: EditorTopBarProps) {
  const { pages, themeCss, styleGuide } = useBuilder();
  const { entitlement } = useSubscription();
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  // Which direct export (code/png) is currently running, plus any last error.
  const [busy, setBusy] = useState<null | 'code' | 'png'>(null);
  const [pngStatus, setPngStatus] = useState('');
  const [exportError, setExportError] = useState('');
  const exportRef = useRef<HTMLDivElement>(null);

  // Only fully generated pages (with HTML) are exportable.
  const exportPages = useMemo<ExportPage[]>(
    () =>
      pages
        .filter((p) => p.html && p.html.trim())
        .map((p) => ({ key: p.id, label: p.label, type: p.type, path: p.path, html: p.html })),
    [pages]
  );
  const hasExportablePages = exportPages.length > 0;

  const EXPORT_OPTIONS = [
    { id: 'shopify', label: 'Export to Shopify', icon: Store, action: () => openExport() },
    { id: 'zip', label: 'Download ZIP', icon: Download, action: () => openExport() },
    { id: 'code', label: 'Export Code', icon: Code2, action: () => void runCodeExport() },
    { id: 'png', label: 'Export to PNG image', icon: FileImage, action: () => void runPngExport() },
    { id: 'preview', label: 'Preview Theme', icon: Eye, action: () => {} },
  ];

  // Shopify theme export is a paid feature. Free users get the upgrade dialog
  // instead of the export flow (product spec §"Free Plan Limits").
  const canExport = entitlement?.canExport ?? false;

  function openExport() {
    setMenuOpen(false);
    if (!canExport) {
      setUpgradeOpen(true);
      return;
    }
    setDialogOpen(true);
  }

  async function runCodeExport() {
    if (busy) return;
    setMenuOpen(false);
    setExportError('');
    setBusy('code');
    try {
      await exportPagesAsCodeZip(exportPages, themeCss, projectName);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function runPngExport() {
    if (busy) return;
    setMenuOpen(false);
    setExportError('');
    setPngStatus('Rendering pages…');
    setBusy('png');
    try {
      await exportPagesAsPng(exportPages, themeCss, projectName, ({ processed, total, label }) => {
        setPngStatus(
          processed < total ? `Rendering ${label || 'page'}… (${processed + 1}/${total})` : 'Packaging…'
        );
      });
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'PNG export failed. Please try again.');
    } finally {
      setBusy(null);
      setPngStatus('');
    }
  }

  useEffect(() => {
    if (!menuOpen) return;
    function onClick(event: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [menuOpen]);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-3 border-b border-[#ece6e2] bg-white px-4">
      <div className="flex items-center gap-3">
        {/* Logo includes the wordmark — no adjacent text. Icon only on mobile. */}
        <Image
          src="/logo-icon.png"
          alt="vlogs.fun"
          width={32}
          height={32}
          className="shrink-0 rounded-lg sm:hidden"
          priority
        />
        <Image
          src="/logo.png"
          alt="vlogs.fun"
          width={40}
          height={40}
          className="hidden shrink-0 rounded-lg sm:block"
          priority
        />
        <button
          aria-label={collapsed ? 'Expand chat panel' : 'Collapse chat panel'}
          onClick={onToggleSidebar}
          className="grid h-8 w-8 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-[#3B424B] transition hover:bg-[#F8FAFC]"
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
            onClick={() => setMenuOpen((open) => !open)}
            disabled={dialogOpen || busy !== null}
            className="flex h-11 items-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-medium text-[#0D1117] shadow-[0_8px_20px_rgba(16,24,40,0.04)] transition hover:bg-[#F8FAFC] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? (
              <>
                <Loader2 size={16} strokeWidth={2} className="animate-spin text-[#0D1117]" />
                {busy === 'png' ? pngStatus || 'Exporting…' : 'Exporting…'}
              </>
            ) : (
              <>
                <Store size={17} strokeWidth={1.9} className="text-[#35b86b]" />
                Export to Shopify
                <ChevronDown
                  size={16}
                  strokeWidth={2}
                  className={`text-[#9CA3AF] transition-transform ${menuOpen ? 'rotate-180' : ''}`}
                />
              </>
            )}
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-64 overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white p-2 shadow-[0_24px_48px_rgba(16,24,40,0.14)]">
              <p className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">
                Export options
              </p>
              {!hasExportablePages && (
                <p className="px-3 pb-2 text-[11px] text-[#b7ada4]">
                  Generate a page first to enable export.
                </p>
              )}
              {EXPORT_OPTIONS.map((option) => {
                const Icon = option.icon;
                const needsPages = ['shopify', 'zip', 'code', 'png'].includes(option.id);
                const disabled = (needsPages && !hasExportablePages) || busy !== null;
                return (
                  <button
                    key={option.id}
                    onClick={option.action}
                    disabled={disabled}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-[#0D1117] transition hover:bg-[#F1F2F5] disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <Icon size={17} strokeWidth={1.9} className="text-[#6b7280]" />
                    {option.label}
                  </button>
                );
              })}
            </div>
          )}

          {exportError && !menuOpen && (
            <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-72 rounded-xl border border-[#f6d5cf] bg-[#fdeceb] px-3.5 py-2.5 text-[12px] text-[#c0432f] shadow-[0_16px_32px_rgba(16,24,40,0.12)]">
              {exportError}
            </div>
          )}
        </div>

        <button className="flex h-11 items-center gap-2 rounded-xl bg-[#0D1117] px-5 text-sm font-semibold text-white shadow-[0_12px_22px_rgba(16,24,40,0.2)] transition hover:bg-[#1A1F24]">
          <Save size={17} strokeWidth={1.9} />
          Save
        </button>
      </div>

      <ExportDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        projectId={projectId}
        projectName={projectName}
        pages={exportPages}
        themeCss={themeCss}
        styleGuide={styleGuide}
      />

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="Exporting is a Pro feature"
        description="Upgrade to export your design as a Shopify theme ZIP and unlock unlimited projects."
      />
    </header>
  );
}
