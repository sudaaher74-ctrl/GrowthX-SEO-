"use client";

import { useState } from "react";
import {
  Check,
  Code2,
  Copy,
  Download,
  FileText,
  Layers,
  Sparkles,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import { ActionButton, Panel } from "@/components/ui/console";
import type { GapExecutionBlueprint } from "@/lib/gaps-plain";
import { cn } from "@/lib/utils";

type ModalTab = "blueprint" | "schema" | "steps";
type PlatformKey = "wordpress" | "shopify" | "webflow" | "nextjs";

const PLATFORMS: Array<{ id: PlatformKey; label: string }> = [
  { id: "wordpress", label: "WordPress" },
  { id: "shopify", label: "Shopify" },
  { id: "webflow", label: "Webflow" },
  { id: "nextjs", label: "Next.js / Code" },
];

/**
 * Execution Playbook Modal behind every "Get a plan" button in Competitor Intelligence:
 * turns any detected gap into ready-to-ship SEO metadata, page outline, Schema.org JSON-LD,
 * and platform-specific implementation steps.
 */
export function PlanModal({
  subtitle,
  why,
  steps,
  plan,
  blueprint,
  onClose,
  onSave,
}: {
  subtitle: string;
  why: string;
  steps: string[];
  plan: string;
  blueprint?: GapExecutionBlueprint;
  onClose: () => void;
  onSave: (plan: string) => void;
}) {
  const [tab, setTab] = useState<ModalTab>(blueprint ? "blueprint" : "steps");
  const [platform, setPlatform] = useState<PlatformKey>("wordpress");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      setCopiedKey(null);
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([plan], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "reigel-execution-plan.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const activeSteps = blueprint ? blueprint.platformSteps[platform] : steps;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Execution Playbook"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div className="w-full max-w-3xl rounded-2xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <Panel
          title="Execution Playbook"
          subtitle={subtitle}
          actions={
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="rounded-lg p-1 text-brand-400 hover:bg-brand-100 cursor-pointer"
            >
              <X size={16} />
            </button>
          }
          padded
        >
          {/* Playbook Sub-Tabs */}
          {blueprint && (
            <div className="mb-4 flex flex-wrap items-center gap-1.5 border-b border-brand-200/70 pb-3">
              {[
                { id: "blueprint" as const, label: "Page & SEO Blueprint", icon: Sparkles },
                { id: "steps" as const, label: "Platform Implementation", icon: Wrench },
                { id: "schema" as const, label: `Schema (${blueprint.jsonLdType})`, icon: Code2 },
              ].map((t) => {
                const Icon = t.icon;
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer",
                      active
                        ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                        : "bg-surface-2 text-brand-600 hover:text-brand-950",
                    )}
                  >
                    <Icon size={12} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="max-h-[56vh] space-y-4 overflow-y-auto pr-1">
            {/* TAB 1: PAGE & SEO BLUEPRINT */}
            {tab === "blueprint" && blueprint && (
              <>
                <div className="rounded-xl border border-brand-200/70 bg-surface-2/50 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                      <FileText size={12} />
                      Ready-to-Use SEO Metadata
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyText(
                          `URL: ${blueprint.targetSlug || "/"}\nTitle: ${blueprint.seoTitle}\nMeta Description: ${blueprint.metaDescription}\nH1: ${blueprint.h1}`,
                          "meta",
                        )
                      }
                      className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-1 px-2 py-0.5 text-[10.5px] font-semibold text-brand-700 hover:bg-brand-50 cursor-pointer"
                    >
                      {copiedKey === "meta" ? <Check size={10} className="text-success-600" /> : <Copy size={10} />}
                      <span>{copiedKey === "meta" ? "Copied" : "Copy Meta"}</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs">
                    {blueprint.targetSlug && (
                      <div>
                        <span className="text-[10px] font-bold uppercase text-brand-400">Recommended URL Slug</span>
                        <p className="font-mono text-[11.5px] font-semibold text-brand-950">{blueprint.targetSlug}</p>
                      </div>
                    )}
                    <div>
                      <span className="text-[10px] font-bold uppercase text-brand-400">SEO Title ({blueprint.seoTitle.length} chars)</span>
                      <p className="font-semibold text-brand-950">{blueprint.seoTitle}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-brand-400">Meta Description ({blueprint.metaDescription.length} chars)</span>
                      <p className="text-brand-700">{blueprint.metaDescription}</p>
                    </div>
                    <div>
                      <span className="text-[10px] font-bold uppercase text-brand-400">Primary H1 Heading</span>
                      <p className="font-bold text-brand-950">{blueprint.h1}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                    <Layers size={12} />
                    Recommended Page Structure (Google + AI Citation Ready)
                  </p>
                  <ol className="space-y-2">
                    {blueprint.outlineSections.map((sec, idx) => (
                      <li
                        key={idx}
                        className="rounded-xl border border-brand-200/70 bg-surface-1 p-3 text-xs"
                      >
                        <p className="font-bold text-brand-950">
                          {idx + 1}. {sec.heading}
                        </p>
                        <p className="mt-0.5 text-[11.5px] text-brand-500 leading-relaxed">{sec.guidance}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              </>
            )}

            {/* TAB 2: PLATFORM-SPECIFIC STEPS */}
            {tab === "steps" && (
              <>
                <div className="rounded-xl border border-brand-200/60 bg-surface-2/40 p-3">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">Why this matters</p>
                  <p className="mt-1 text-xs text-brand-900 leading-relaxed">{why}</p>
                </div>

                {blueprint && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-brand-500 mr-1">Your platform:</span>
                    {PLATFORMS.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setPlatform(p.id)}
                        className={cn(
                          "rounded-full px-2.5 py-1 text-[11px] font-semibold transition-colors cursor-pointer",
                          platform === p.id
                            ? "bg-brand-950 text-white font-bold"
                            : "border border-brand-200 bg-surface-1 text-brand-600 hover:text-brand-950",
                        )}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                )}

                <div>
                  <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500 mb-2">
                    Step-by-Step Execution Checklist
                  </p>
                  <ol className="list-decimal space-y-2 pl-5 text-xs text-brand-950 leading-relaxed">
                    {activeSteps.map((s, idx) => (
                      <li key={idx}>{s}</li>
                    ))}
                  </ol>
                </div>
              </>
            )}

            {/* TAB 3: READY-TO-PASTE JSON-LD SCHEMA */}
            {tab === "schema" && blueprint && (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-brand-950">
                    Ready-to-Paste <span className="font-mono">{blueprint.jsonLdType}</span> JSON-LD
                  </p>
                  <button
                    type="button"
                    onClick={() => copyText(blueprint.jsonLdSnippet, "schema")}
                    className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2.5 py-1 text-[11px] font-bold text-signal-ink hover:bg-signal-500 cursor-pointer"
                  >
                    {copiedKey === "schema" ? <Check size={11} /> : <Copy size={11} />}
                    <span>{copiedKey === "schema" ? "Copied JSON-LD!" : "Copy JSON-LD"}</span>
                  </button>
                </div>
                <pre className="overflow-auto rounded-xl bg-brand-950 p-4 font-mono text-[11.5px] leading-relaxed text-brand-100">
                  {`<script type="application/ld+json">\n${blueprint.jsonLdSnippet}\n</script>`}
                </pre>
                <p className="text-[11px] text-brand-500">
                  Add inside your page&apos;s <code className="font-mono">&lt;head&gt;</code> tag, then validate with Google Rich Results Test or re-crawl in Reigel.
                </p>
              </div>
            )}

            <p className="text-[11px] text-brand-400 pt-1">
              Safe preview · No live changes are applied to your website until you approve &amp; publish.
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-brand-200/70 pt-3">
            <div className="flex items-center gap-2">
              <ActionButton icon={copiedKey === "full" ? <Check size={13} /> : <Copy size={13} />} onClick={() => copyText(plan, "full")}>
                {copiedKey === "full" ? "Copied Full Brief" : "Copy Full Brief"}
              </ActionButton>
              <ActionButton icon={<Download size={13} />} onClick={downloadMarkdown}>
                Download .md
              </ActionButton>
            </div>
            <ActionButton variant="primary" icon={<Zap size={13} />} onClick={() => onSave(plan)}>
              Stage in Action Plan
            </ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
