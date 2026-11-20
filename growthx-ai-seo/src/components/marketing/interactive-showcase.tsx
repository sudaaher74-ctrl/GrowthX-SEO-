"use client";

import { useId, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  GitPullRequest,
  Globe,
  Lock,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type MainMode = "rollback" | "portal";
type StackId = "wordpress" | "shopify" | "webflow" | "github";
type SimPhase = "ready" | "published" | "rolled_back";

interface StackExample {
  id: StackId;
  label: string;
  targetPath: string;
  publishMode: string;
  batchCount: number;
  beforeLine: string;
  afterLine: string;
  snapshotId: string;
  publishAction: string;
  publishedStatus: string;
  supportsRollback: boolean;
  note: string;
}

const STACK_EXAMPLES: readonly StackExample[] = [
  {
    id: "wordpress",
    label: "WordPress",
    targetPath: "/products/enterprise-guide · Yoast & Schema Meta",
    publishMode: "Direct REST API · Draft or Live",
    batchCount: 6,
    beforeLine: 'title: "Guide | Site"  ·  schema: missing  ·  canonical: duplicate',
    afterLine: 'title: "Enterprise Buyer Guide (2026)"  ·  JSON-LD FAQ + Product  ·  self-canonical',
    snapshotId: "snap_wp_8421",
    publishAction: "Approve & Push to WordPress",
    publishedStatus: "Live on WordPress · Re-crawl verified 200 OK",
    supportsRollback: true,
    note: "Exact previous WordPress post title, meta, and JSON-LD stored before writing.",
  },
  {
    id: "shopify",
    label: "Shopify",
    targetPath: "/collections/bestsellers · Product & Collection SEO",
    publishMode: "Shopify Admin API · Safe Batch",
    batchCount: 8,
    beforeLine: 'metaDescription: empty  ·  Product JSON-LD: missing offers.availability',
    afterLine: 'metaDescription: grounded spec copy  ·  valid Merchant & Product schema',
    snapshotId: "snap_shop_3190",
    publishAction: "Approve & Push to Shopify",
    publishedStatus: "Published to Shopify · Re-crawl verified Rich Results",
    supportsRollback: true,
    note: "Every Shopify metafield & SEO description is snapshotted for instant 1-click undo.",
  },
  {
    id: "webflow",
    label: "Webflow",
    targetPath: "CMS Collection /blog · SEO Title, Slug & OG Fields",
    publishMode: "Webflow Data API · Staged Draft",
    batchCount: 5,
    beforeLine: 'robots: noindex  ·  og:image: missing  ·  h1: duplicated across 5 items',
    afterLine: 'robots: index, follow  ·  og:title & og:description synced  ·  unique H1s',
    snapshotId: "snap_wf_5504",
    publishAction: "Approve & Stage on Webflow",
    publishedStatus: "Synced to Webflow · Re-crawl confirmed indexable",
    supportsRollback: true,
    note: "Push to Webflow draft or live site — revert any collection item in one click.",
  },
  {
    id: "github",
    label: "GitHub PR",
    targetPath: "app/(marketing)/products/page.tsx · Unified Batch PR",
    publishMode: "Pull Request · Never Auto-Merged",
    batchCount: 12,
    beforeLine: '- <meta name="robots" content="noindex" /> // blocked 12 product pages',
    afterLine: '+ <meta name="robots" content="index, follow" /> + validated JSON-LD',
    snapshotId: "pr_branch_reigel_batch_12",
    publishAction: "Open Unified GitHub PR",
    publishedStatus: "Pull Request 42 opened · Waiting for your team's merge",
    supportsRollback: false,
    note: "Reigel opens 1 clean PR for up to 15 safe fixes, never merges for you, and re-crawls after merge.",
  },
];

interface PortalBrand {
  id: string;
  agencyName: string;
  initials: string;
  clientDomain: string;
  monthLabel: string;
  commentary: string;
  healthScore: string;
  aiShare: string;
  verifiedFixes: string;
  recoveredLinks: string;
}

const PORTAL_PROFILES: readonly PortalBrand[] = [
  {
    id: "northstar",
    agencyName: "Your Agency Name",
    initials: "YA",
    clientDomain: "yourclient.com",
    monthLabel: "October 2026",
    commentary:
      "Resolved 14 technical crawl blockers via Batch Safe Fixes, published 3 grounded comparison pages to WordPress, and recovered 4 lost referring domains.",
    healthScore: "94 / 100",
    aiShare: "48% Cited",
    verifiedFixes: "14 Verified",
    recoveredLinks: "4 Recovered",
  },
  {
    id: "velocity",
    agencyName: "Meridian Growth Partners",
    initials: "MG",
    clientDomain: "storefront-example.com",
    monthLabel: "October 2026",
    commentary:
      "Shipped Merchant & Product JSON-LD across 12 Shopify collections with zero regressions, and staged citation defense for top 5 ChatGPT & Perplexity buyer prompts.",
    healthScore: "96 / 100",
    aiShare: "54% Cited",
    verifiedFixes: "18 Verified",
    recoveredLinks: "6 Recovered",
  },
];

function handleTablistKeyDown<T extends string>(
  e: React.KeyboardEvent<HTMLButtonElement>,
  ids: readonly T[],
  current: T,
  onSelect: (next: T) => void,
  refs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>,
) {
  const idx = ids.indexOf(current);
  let nextIdx = idx;
  if (e.key === "ArrowRight") nextIdx = (idx + 1) % ids.length;
  else if (e.key === "ArrowLeft") nextIdx = (idx - 1 + ids.length) % ids.length;
  else if (e.key === "Home") nextIdx = 0;
  else if (e.key === "End") nextIdx = ids.length - 1;
  else return;

  e.preventDefault();
  const nextId = ids[nextIdx];
  onSelect(nextId);
  refs.current[nextId]?.focus();
}

export function InteractiveShowcase() {
  const baseId = useId();
  const [mode, setMode] = useState<MainMode>("rollback");
  const [stackId, setStackId] = useState<StackId>("wordpress");
  const [phaseByStack, setPhaseByStack] = useState<Record<StackId, SimPhase>>({
    wordpress: "ready",
    shopify: "ready",
    webflow: "ready",
    github: "ready",
  });
  const [portalIdx, setPortalIdx] = useState(0);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const mainTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const stackTabRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const activeStack = STACK_EXAMPLES.find((s) => s.id === stackId) ?? STACK_EXAMPLES[0];
  const activePhase = phaseByStack[stackId];
  const activePortal = PORTAL_PROFILES[portalIdx];

  const setStackPhase = (id: StackId, phase: SimPhase) => {
    setPhaseByStack((prev) => ({ ...prev, [id]: phase }));
  };

  return (
    <section
      id="interactive-demo"
      aria-labelledby={`${baseId}-heading`}
      className="py-16 sm:py-24 border-t border-brand-200 scroll-mt-16"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8 sm:mb-10">
          <div className="max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2">
              Try the Workflow Live
            </p>
            <h2
              id={`${baseId}-heading`}
              className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight"
            >
              Test safe publishing &amp;{" "}
              <span className="text-signal-400">client proof before signing up.</span>
            </h2>
            <p className="mt-3 text-sm sm:text-base text-brand-500 leading-relaxed">
              Click through how Reigel pushes batch fixes with 1-click rollback across your stack, or preview the exact zero-login white-label portal your clients receive at month-end.
            </p>
          </div>

          {/* Primary Mode Tablist (accessible single-row tabs with underline shape indicator) */}
          <div
            role="tablist"
            aria-label="Interactive product preview modes"
            className="flex flex-nowrap overflow-x-auto border-b border-brand-200 gap-1 shrink-0"
          >
            {(
              [
                { id: "rollback" as const, label: "1. Direct Ship & Rollback" },
                { id: "portal" as const, label: "2. White-Label Client Portal" },
              ] as const
            ).map((tab) => {
              const selected = mode === tab.id;
              return (
                <button
                  key={tab.id}
                  ref={(el) => {
                    mainTabRefs.current[tab.id] = el;
                  }}
                  id={`${baseId}-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setMode(tab.id)}
                  onKeyDown={(e) =>
                    handleTablistKeyDown(
                      e,
                      ["rollback", "portal"] as const,
                      mode,
                      setMode,
                      mainTabRefs,
                    )
                  }
                  className={cn(
                    "relative shrink-0 px-4 py-2.5 text-xs sm:text-sm font-bold transition-colors cursor-pointer whitespace-nowrap",
                    selected
                      ? "text-brand-950 after:absolute after:inset-x-0 after:bottom-0 after:border-b-[3px] after:border-signal-400"
                      : "text-brand-500 hover:text-brand-900",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* PANEL 1: DIRECT SHIP & 1-CLICK ROLLBACK SIMULATOR */}
        <div
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-rollback`}
          hidden={mode !== "rollback"}
        >
          <div className="bg-surface-1 border border-brand-200 rounded-3xl p-5 sm:p-8 shadow-card space-y-6">
            {/* Top Bar: Stack Selector + Honesty Tag */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-200">
              <div
                role="tablist"
                aria-label="Choose your website platform"
                className="flex flex-nowrap overflow-x-auto gap-1.5"
              >
                {STACK_EXAMPLES.map((stack) => {
                  const selected = stack.id === stackId;
                  return (
                    <button
                      key={stack.id}
                      ref={(el) => {
                        stackTabRefs.current[stack.id] = el;
                      }}
                      id={`${baseId}-stack-${stack.id}`}
                      type="button"
                      role="tab"
                      aria-selected={selected}
                      tabIndex={selected ? 0 : -1}
                      onClick={() => setStackId(stack.id)}
                      onKeyDown={(e) =>
                        handleTablistKeyDown(
                          e,
                          ["wordpress", "shopify", "webflow", "github"] as const,
                          stackId,
                          setStackId,
                          stackTabRefs,
                        )
                      }
                      className={cn(
                        "relative shrink-0 rounded-xl px-3.5 py-2 text-xs font-bold transition-colors cursor-pointer border whitespace-nowrap",
                        selected
                          ? "bg-surface-2 text-brand-950 border-brand-300 after:absolute after:inset-x-2 after:bottom-0 after:border-b-[3px] after:border-signal-400"
                          : "bg-surface-1 text-brand-600 border-brand-200 hover:bg-surface-2 hover:text-brand-950",
                      )}
                    >
                      {stack.label}
                    </button>
                  );
                })}
              </div>

              <span className="self-start sm:self-auto inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-brand-200 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wide text-brand-500">
                <Sparkles size={11} className="text-signal-400" />
                Interactive preview &middot; Example data
              </span>
            </div>

            {/* Simulator Body */}
            <div
              role="tabpanel"
              aria-labelledby={`${baseId}-stack-${activeStack.id}`}
              className="grid lg:grid-cols-[1.2fr_0.8fr] gap-6 items-start"
            >
              {/* Left: Live Diff & Snapshot Card */}
              <div className="bg-surface-2 border border-brand-200 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-brand-200">
                  <div className="min-w-0">
                    <p className="font-mono text-xs font-bold text-brand-950 truncate">
                      {activeStack.targetPath}
                    </p>
                    <p className="text-[11px] text-brand-500 mt-0.5">
                      {activeStack.publishMode} &middot; Batch Safe Fix ({activeStack.batchCount} pages)
                    </p>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2.5 py-1 font-mono text-[10px] font-bold border",
                      activePhase === "published"
                        ? "bg-success-50 text-success-600 border-success-500/20"
                        : activePhase === "rolled_back"
                          ? "bg-warning-50 text-warning-600 border-warning-500/20"
                          : "bg-surface-1 text-brand-700 border-brand-200",
                    )}
                  >
                    {activePhase === "published"
                      ? activeStack.id === "github"
                        ? "PR 42 Opened"
                        : "Published & Verified"
                      : activePhase === "rolled_back"
                        ? "Rolled Back to BEFORE"
                        : "Awaiting Approval"}
                  </span>
                </div>

                {/* Before / After Lines */}
                <div className="space-y-2 font-mono text-[11px]">
                  <div
                    className={cn(
                      "rounded-xl border px-3 py-2.5 transition-colors",
                      activePhase === "rolled_back"
                        ? "bg-surface-1 border-brand-300 text-brand-950"
                        : "bg-error-50 border-error-500/20 text-error-600",
                    )}
                  >
                    <span className="block text-[9.5px] uppercase tracking-wider font-bold mb-1 opacity-80">
                      {activePhase === "rolled_back"
                        ? `RESTORED LIVE (${activeStack.snapshotId})`
                        : "BEFORE SNAPSHOT"}
                    </span>
                    <span className="break-words">{activeStack.beforeLine}</span>
                  </div>

                  <div
                    className={cn(
                      "rounded-xl border px-3 py-2.5 transition-colors",
                      activePhase === "rolled_back"
                        ? "bg-surface-1 border-brand-200 text-brand-400 line-through"
                        : "bg-success-50 border-success-500/20 text-success-600",
                    )}
                  >
                    <span className="block text-[9.5px] uppercase tracking-wider font-bold mb-1 opacity-80">
                      {activePhase === "published"
                        ? activeStack.id === "github"
                          ? "STAGED IN PULL REQUEST"
                          : "LIVE & RE-CRAWL VERIFIED"
                        : "PREPARED FIX"}
                    </span>
                    <span className="break-words">{activeStack.afterLine}</span>
                  </div>
                </div>

                {/* Action Bar */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  {activePhase !== "published" ? (
                    <button
                      type="button"
                      onClick={() => setStackPhase(stackId, "published")}
                      className="inline-flex items-center gap-2 rounded-full bg-signal-400 hover:bg-signal-500 text-signal-ink px-4 py-2 text-xs font-extrabold shadow-xs transition-all cursor-pointer"
                    >
                      {activeStack.id === "github" ? (
                        <GitPullRequest size={14} />
                      ) : (
                        <CheckCircle2 size={14} />
                      )}
                      <span>{activeStack.publishAction}</span>
                    </button>
                  ) : (
                    <>
                      {activeStack.supportsRollback ? (
                        <button
                          type="button"
                          onClick={() => setStackPhase(stackId, "rolled_back")}
                          className="inline-flex items-center gap-2 rounded-full bg-surface-1 hover:bg-surface-3 text-brand-950 border border-brand-300 px-4 py-2 text-xs font-extrabold transition-all cursor-pointer"
                        >
                          <RotateCcw size={13} />
                          <span>Test 1-Click Safe Rollback</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setStackPhase(stackId, "ready")}
                          className="inline-flex items-center gap-2 rounded-full bg-surface-1 hover:bg-surface-3 text-brand-950 border border-brand-300 px-4 py-2 text-xs font-bold transition-all cursor-pointer"
                        >
                          <RefreshCw size={13} />
                          <span>Reset preview</span>
                        </button>
                      )}
                    </>
                  )}

                  {activePhase === "rolled_back" && (
                    <span className="text-[11px] font-semibold text-success-600">
                      Restored exact BEFORE state ({activeStack.snapshotId}).
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Live Verification Timeline */}
              <div className="bg-surface-2 border border-brand-200 rounded-2xl p-4 sm:p-5 space-y-3.5">
                <p className="text-[11px] font-mono font-bold uppercase tracking-wider text-brand-500">
                  Safety &amp; Verification Trail
                </p>

                <ol className="space-y-2.5 text-xs">
                  <li className="flex items-start gap-2.5 bg-surface-1 border border-brand-200 rounded-xl p-3">
                    <ShieldCheck size={15} className="text-success-500 shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold text-brand-950">1. Automatic BEFORE snapshot</p>
                      <p className="text-[11px] text-brand-500 mt-0.5">{activeStack.note}</p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5 bg-surface-1 border border-brand-200 rounded-xl p-3">
                    <RefreshCw
                      size={15}
                      className={cn(
                        "shrink-0 mt-0.5",
                        activePhase === "published" ? "text-success-500" : "text-brand-400",
                      )}
                    />
                    <div>
                      <p className="font-bold text-brand-950">2. Post-deploy re-crawl proof</p>
                      <p className="text-[11px] text-brand-500 mt-0.5">
                        {activePhase === "published"
                          ? activeStack.publishedStatus
                          : "Click the button on the left to test the publish and verification state."}
                      </p>
                    </div>
                  </li>

                  <li className="flex items-start gap-2.5 bg-surface-1 border border-brand-200 rounded-xl p-3">
                    <RotateCcw
                      size={15}
                      className={cn(
                        "shrink-0 mt-0.5",
                        activePhase === "rolled_back" ? "text-warning-500" : "text-brand-400",
                      )}
                    />
                    <div>
                      <p className="font-bold text-brand-950">3. Regression Guard + Webhook Alert</p>
                      <p className="text-[11px] text-brand-500 mt-0.5">
                        {activePhase === "rolled_back"
                          ? "Rollback event logged to Fix Impact Ledger & signed webhook sent to Slack/Discord."
                          : "If a future crawl sees the issue return, Reigel re-opens it and notifies Slack/Discord."}
                      </p>
                    </div>
                  </li>
                </ol>

                <Link
                  href="/login"
                  className="inline-flex items-center gap-1.5 text-xs font-extrabold text-brand-950 hover:gap-2.5 transition-all pt-1"
                >
                  <span>Connect {activeStack.label} in your workspace</span>
                  <ArrowRight size={13} />
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* PANEL 2: ZERO-LOGIN WHITE-LABEL CLIENT PORTAL PREVIEW */}
        <div
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-portal`}
          hidden={mode !== "portal"}
        >
          <div className="bg-surface-1 border border-brand-200 rounded-3xl p-5 sm:p-8 shadow-card space-y-5">
            {/* Portal Browser Frame Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-brand-200">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 border border-brand-200 px-3 py-1 font-mono text-[10.5px] text-brand-700 truncate">
                  <Lock size={11} className="text-success-500 shrink-0" />
                  <span className="truncate">reigel.in/share/report/client-snapshot-token</span>
                </span>
                <span className="hidden md:inline-flex items-center rounded-full bg-success-50 border border-success-500/20 px-2.5 py-0.5 text-[10px] font-bold text-success-600 shrink-0">
                  Zero Client Login
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setPortalIdx((prev) => (prev + 1) % PORTAL_PROFILES.length);
                    setExportNotice(null);
                  }}
                  className="rounded-full bg-surface-2 hover:bg-surface-3 border border-brand-200 px-3 py-1 text-[11px] font-bold text-brand-950 transition-colors cursor-pointer"
                >
                  Switch Agency Brand Example
                </button>
                <span className="rounded-full bg-surface-2 border border-brand-200 px-2.5 py-1 font-mono text-[10px] font-bold uppercase text-brand-500">
                  Example data
                </span>
              </div>
            </div>

            {/* White-Label Report Canvas */}
            <div className="bg-surface-2 border border-brand-200 rounded-2xl p-5 sm:p-6 space-y-5">
              {/* White-label Agency Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-brand-200">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-signal-400 text-signal-ink font-mono text-sm font-black flex items-center justify-center shrink-0">
                    {activePortal.initials}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-extrabold text-brand-950">
                        {activePortal.agencyName}
                      </h3>
                      <span className="rounded-full bg-surface-1 border border-brand-200 px-2 py-0.5 font-mono text-[9.5px] font-bold uppercase text-brand-600">
                        Frozen Monthly Snapshot
                      </span>
                    </div>
                    <p className="text-xs text-brand-500 flex items-center gap-1.5 mt-0.5">
                      <Globe size={11} />
                      <span className="font-mono">{activePortal.clientDomain}</span>
                      <span>&middot;</span>
                      <span>{activePortal.monthLabel}</span>
                    </p>
                  </div>
                </div>

                {/* Export Controls */}
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setExportNotice("Server Playwright renders a crisp white-label A4 PDF for this frozen month.")
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-signal-400 hover:bg-signal-500 text-signal-ink px-3.5 py-1.5 text-xs font-extrabold transition-colors cursor-pointer"
                  >
                    <Download size={12} />
                    <span>A4 PDF</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setExportNotice("1-Click CSV exports audited URLs, verified fixes, keywords, and recovered backlinks.")
                    }
                    className="inline-flex items-center gap-1.5 rounded-full bg-surface-1 hover:bg-surface-3 border border-brand-200 text-brand-950 px-3.5 py-1.5 text-xs font-bold transition-colors cursor-pointer"
                  >
                    <FileSpreadsheet size={12} />
                    <span>Export CSV</span>
                  </button>
                </div>
              </div>

              {exportNotice && (
                <div className="rounded-xl bg-surface-1 border border-brand-200 px-3.5 py-2.5 text-xs text-brand-700 flex items-center justify-between gap-3">
                  <span>{exportNotice}</span>
                  <Link
                    href="/login"
                    className="shrink-0 font-bold text-brand-950 underline decoration-signal-400 underline-offset-4"
                  >
                    Try free &rarr;
                  </Link>
                </div>
              )}

              {/* 4 Pillar KPI Cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { label: "Technical SEO Health", val: activePortal.healthScore },
                  { label: "AI Citation Share (5 APIs)", val: activePortal.aiShare },
                  { label: "Fix Impact Ledger", val: activePortal.verifiedFixes },
                  { label: "Backlink Recovery", val: activePortal.recoveredLinks },
                ].map((kpi) => (
                  <div
                    key={kpi.label}
                    className="bg-surface-1 border border-brand-200 rounded-xl p-3.5"
                  >
                    <p className="text-[10.5px] font-semibold text-brand-500">{kpi.label}</p>
                    <p className="text-lg sm:text-xl font-black text-brand-950 mt-1">{kpi.val}</p>
                  </div>
                ))}
              </div>

              {/* Account Manager Executive Commentary */}
              <div className="bg-surface-1 border border-brand-200 rounded-xl p-4">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-500 mb-1">
                  Account Manager Executive Summary
                </p>
                <p className="text-xs sm:text-sm text-brand-700 leading-relaxed">
                  &ldquo;{activePortal.commentary}&rdquo;
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
