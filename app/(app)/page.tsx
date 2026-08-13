'use client';

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUp,
  Box,
  Grid3x3,
  LayoutTemplate,
  Loader2,
  Plus,
  Settings,
  ShoppingCart,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { AuthButtons, useAuth } from "@/components";
import { createProject, ProjectLimitError } from "@/lib/projects";
import { useSubscription } from "@/components/billing/SubscriptionProvider";
import UpgradeDialog from "@/components/billing/UpgradeDialog";

const templateCards = [
  {
    icon: LayoutTemplate,
    title: "Create a landing page",
    desc: "High-converting hero section with modern design",
    prompt:
      "Create a high-converting landing page for my Shopify store with a modern hero section, featured products, and a strong call to action.",
  },
  {
    icon: Box,
    title: "Build product page",
    desc: "Beautiful product showcase that drives sales",
    prompt:
      "Build a beautiful Shopify product page with a large gallery, product details, variant selectors, and related products.",
  },
  {
    icon: ShoppingCart,
    title: "Design cart page",
    desc: "Streamlined cart experience that boosts checkout",
    prompt:
      "Design a streamlined Shopify cart page with clear line items, order summary, and a prominent checkout button.",
  },
  {
    icon: Grid3x3,
    title: "Explore collection page",
    desc: "Display your products in stunning collections",
    prompt:
      "Create a Shopify collection page with a responsive product grid, filters, sorting, and a clean header.",
  },
];

export default function Home() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { entitlement, refresh: refreshEntitlement } = useSubscription();
  const [prompt, setPrompt] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);

  async function startProject(rawPrompt: string) {
    const trimmed = rawPrompt.trim();
    if (!trimmed || submitting) return;

    if (!authLoading && !user) {
      router.push("/sign-in");
      return;
    }

    // Fast-path: if we already know the Free limit is reached, show the upgrade
    // dialog without a round-trip. The server still enforces this authoritatively.
    if (entitlement && !entitlement.canCreateProject) {
      setUpgradeOpen(true);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const project = await createProject(trimmed);
      router.push(`/editor/${project.id}`);
    } catch (err) {
      if (err instanceof ProjectLimitError) {
        // Server rejected creation — surface the upgrade dialog and resync usage.
        setUpgradeOpen(true);
        void refreshEntitlement();
      } else {
        setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
      }
      setSubmitting(false);
    }
  }

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    void startProject(prompt);
  }

  function applySuggestion(nextPrompt: string) {
    setPrompt(nextPrompt);
    setError(null);
    promptRef.current?.focus();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-white">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#F8FAFC_0%,#FFFFFF_38%)]" />

      <div className="relative mx-auto flex min-h-screen max-w-[960px] flex-col px-8 py-8">
        <div className="mb-10 flex justify-end gap-3">
          <button
            aria-label="Settings"
            className="grid h-10 w-10 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-[#3B424B] shadow-[0px_1px_2px_rgba(16,24,40,0.04)] transition hover:bg-[#F8FAFC]"
          >
            <Settings size={18} strokeWidth={1.8} />
          </button>
          <AuthButtons />
        </div>

        <section className="mx-auto w-full max-w-[780px]">
          <div className="mb-10 text-center">
            <p className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-[#6B7280]">
              AI Theme Builder
            </p>
            <h1 className="text-[44px] font-semibold leading-[1.15] tracking-[-0.02em] text-[#0D1117]">
              Build stunning Shopify themes
              <br className="hidden sm:block" />
              {" "}with the power of{" "}
              <span className="bg-[linear-gradient(120deg,#0D1117_0%,#3B424B_55%,#8A94A0_100%)] bg-clip-text text-transparent">AI</span>{" "}
              <Sparkles className="mb-1 inline-block text-[#C0C4CC]" size={26} fill="currentColor" strokeWidth={1.5} />
            </h1>
            <p className="mt-5 text-base leading-7 text-[#6B7280]">
              Describe a page, pick a starting point, or get inspired.
              <br />
              I&apos;ll generate a fully editable Shopify template for you.
            </p>
          </div>

          <form
            onSubmit={onSubmit}
            className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-[0px_10px_15px_rgba(16,24,40,0.08),0px_4px_6px_rgba(16,24,40,0.04)] transition focus-within:border-[#0D1117]"
          >
            <textarea
              ref={promptRef}
              aria-label="Describe a Shopify page or theme"
              placeholder="Ask me to build a Shopify page or theme..."
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                  event.preventDefault();
                  void startProject(prompt);
                }
              }}
              disabled={submitting}
              className="h-[82px] w-full resize-none border-0 bg-transparent px-2 py-2 text-base text-[#0D1117] outline-none placeholder:text-[#9CA3AF] disabled:opacity-60"
            />
            <div className="flex items-end justify-between">
              <div className="flex gap-2">

                <button type="button" aria-label="Mention" className="grid h-10 w-11 place-items-center rounded-lg border border-[#E5E7EB] bg-white text-[#3B424B] transition hover:bg-[#F8FAFC]">
                  <Plus size={16} strokeWidth={1.8} />
                </button>
              </div>
              <button
                type="submit"
                aria-label="Submit prompt"
                disabled={submitting || !prompt.trim()}
                className="grid h-11 w-11 place-items-center rounded-lg bg-[#0D1117] text-white shadow-[0px_4px_6px_rgba(16,24,40,0.08),0px_2px_4px_rgba(16,24,40,0.04)] transition hover:bg-[#1A1F24] disabled:cursor-not-allowed disabled:opacity-40"
              >
                {submitting ? (
                  <Loader2 size={20} strokeWidth={2.2} className="animate-spin" />
                ) : (
                  <ArrowUp size={22} strokeWidth={2} />
                )}
              </button>
            </div>
          </form>

          {error && (
            <p className="mt-3 text-center text-sm font-medium text-[#ef4444]">{error}</p>
          )}
          <div className="mb-8" />

          <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2">
            {templateCards.map((card) => {
              const IconComponent = card.icon;
              return (
                <button
                  key={card.title}
                  type="button"
                  onClick={() => applySuggestion(card.prompt)}
                  disabled={submitting}
                  className="group flex min-h-[100px] items-center justify-between gap-4 rounded-xl border border-[#E5E7EB] bg-white p-4 text-left shadow-[0px_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#C0C4CC] hover:shadow-[0px_4px_6px_rgba(16,24,40,0.08),0px_2px_4px_rgba(16,24,40,0.04)] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-[#F1F2F5] text-[#3B424B] transition group-hover:bg-[#E9EAEE]">
                      <IconComponent size={26} strokeWidth={1.6} />
                    </div>
                    <div>
                      <h3 className="text-base font-semibold leading-6 text-[#0D1117]">{card.title}</h3>
                      <p className="mt-1 text-sm leading-5 text-[#6B7280]">{card.desc}</p>
                    </div>
                  </div>
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E5E7EB] text-[#3B424B] transition group-hover:translate-x-1 group-hover:border-[#0D1117] group-hover:text-[#0D1117]">
                    <ArrowRight size={19} strokeWidth={1.8} />
                  </span>
                </button>
              );
            })}
          </div>

          <div className="relative flex items-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#F8FAFC] px-6 py-6 shadow-[0px_1px_2px_rgba(16,24,40,0.04)]">
            <div className="relative z-10 flex items-center gap-4">
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full border border-[#E5E7EB] bg-white text-[#0D1117] shadow-[0px_1px_3px_rgba(16,24,40,0.08)]">
                <Sparkles size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h2 className="text-base font-semibold leading-6 text-[#0D1117]">
                  From idea to live store
                </h2>
                <p className="mt-1 text-sm leading-5 text-[#6B7280]">
                  Generate, customize, and export production-ready themes in minutes.
                </p>
              </div>
            </div>
            <Image
              src="/shopify-logo.png"
              alt="Shopify preview"
              width={170}
              height={120}
              className="absolute bottom-0 right-10 hidden h-auto w-[80px] opacity-80 grayscale md:block"
            />
          </div>
        </section>
      </div>

      <UpgradeDialog
        open={upgradeOpen}
        onClose={() => setUpgradeOpen(false)}
        title="You’ve reached your project limit"
        description="The Free plan includes 2 projects. Upgrade to create unlimited projects and export Shopify themes."
      />
    </div>
  );
}
