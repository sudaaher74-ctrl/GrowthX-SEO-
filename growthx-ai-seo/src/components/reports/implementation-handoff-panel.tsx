"use client";

import Link from "next/link";
import { useState } from "react";
import {
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Download,
  ExternalLink,
  PenLine,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { ActionButton, Panel, Pill } from "@/components/ui/console";
import {
  formatSpecAsMarkdown,
  formatSpecsDocument,
  type ImplementationSpec,
  type SpecOwner,
  type SpecPriority,
} from "@/lib/implementation-specs";
import { download } from "@/lib/competitor-report";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

const PRIORITY_TONE: Record<SpecPriority, "bad" | "warn" | "default"> = {
  high: "bad",
  medium: "warn",
  low: "default",
};

const OWNER_TONE: Record<SpecOwner, "info" | "good" | "warn" | "default"> = {
  "Web Developer": "info",
  "Website Owner / CMS": "good",
  "Content & SEO": "warn",
  "Outreach / PR": "default",
};

interface ImplementationHandoffPanelProps {
  reportTitle: string;
  domain: string | null | undefined;
  projectId: string | null;
  specs: ImplementationSpec[];
  filenameSlug: string;
  subtitle?: string;
}

/**
 * Universal, stack-agnostic Implementation & Handoff section embedded directly
 * inside every Reigel report. Anyone can download the full handoff pack or copy
 * any single brief (with standard HTML/JSON-LD/redirect snippets & QA checks)
 * to hand directly to any developer, CMS admin, or writer — or stage it in Fix Engine.
 */
export function ImplementationHandoffPanel({
  reportTitle,
  domain,
  projectId,
  specs,
  filenameSlug,
  subtitle = "Platform-agnostic briefs with affected URLs, standard HTML/JSON-LD/redirect snippets, and QA checks — hand directly to any developer or CMS editor even without Fix Engine.",
}: ImplementationHandoffPanelProps) {
  const [ownerFilter, setOwnerFilter] = useState<SpecOwner | "ALL">("ALL");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stagedIds, setStagedIds] = useState<Set<string>>(() => new Set());

  if (specs.length === 0) return null;

  const ownersPresent = Array.from(new Set(specs.map((s) => s.owner)));
  const visible = ownerFilter === "ALL" ? specs : specs.filter((s) => s.owner === ownerFilter);

  const copyText = async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(key);
      window.setTimeout(() => setCopiedId((prev) => (prev === key ? null : prev)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleDownloadPack = () => {
    const cleanDomain = (domain || "website").replace(/[^a-z0-9.-]+/gi, "-");
    const date = new Date().toISOString().slice(0, 10);
    download(
      `${filenameSlug}-implementation-handoff-${cleanDomain}-${date}.md`,
      formatSpecsDocument(reportTitle, domain, specs),
      "text/markdown",
    );
  };

  const handleStage = (spec: ImplementationSpec) => {
    if (!projectId) return;
    stagingEngine.stage(projectId, {
      title: `[${spec.id}] ${spec.title}`,
      category: `${reportTitle} (${spec.owner})`,
      source: "COMPETITOR_KEYWORD",
      priority: spec.priority === "high" ? "HIGH" : spec.priority === "medium" ? "MEDIUM" : "LOW",
      impact: spec.expectedOutcome,
      effortHours: 1.5,
      deliverable: spec.steps.map((s, i) => `${i + 1}. ${s}`).join("\n"),
      evidence: spec.observedState,
    });
    setStagedIds((prev) => new Set(prev).add(spec.id));
  };

  return (
    <Panel
      title={`Implementation & Developer Handoff Guide (${specs.length})`}
      subtitle={subtitle}
      actions={
        <div className="no-print flex items-center gap-2">
          <ActionButton icon={<Download size={12} />} onClick={handleDownloadPack}>
            Download Handoff (.md)
          </ActionButton>
        </div>
      }
      padded
    >
      {/* Role filter strip (interactive only, hidden when printing PDF) */}
      {ownersPresent.length > 1 && (
        <div className="no-print mb-4 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setOwnerFilter("ALL")}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer",
              ownerFilter === "ALL"
                ? "border-primary-600 bg-primary-600 text-white"
                : "border-brand-200 bg-surface-1 text-brand-700 hover:bg-brand-50",
            )}
          >
            All ({specs.length})
          </button>
          {ownersPresent.map((owner) => {
            const count = specs.filter((s) => s.owner === owner).length;
            const active = ownerFilter === owner;
            return (
              <button
                key={owner}
                type="button"
                onClick={() => setOwnerFilter(owner)}
                className={cn(
                  "rounded-full border px-3 py-1 text-[11px] font-semibold transition cursor-pointer",
                  active
                    ? "border-primary-600 bg-primary-600 text-white"
                    : "border-brand-200 bg-surface-1 text-brand-700 hover:bg-brand-50",
                )}
              >
                {owner} ({count})
              </button>
            );
          })}
        </div>
      )}

      <div className="space-y-3.5">
        {visible.map((spec) => {
          const isBriefCopied = copiedId === `brief-${spec.id}`;
          const isCodeCopied = copiedId === `code-${spec.id}`;
          const isStaged = stagedIds.has(spec.id);

          return (
            <div
              key={spec.id}
              className="print-avoid-break rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-3"
            >
              {/* Header Row */}
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-brand-100 px-2 py-0.5 font-mono text-[10.5px] font-bold text-brand-800">
                  {spec.id}
                </span>
                <h3 className="text-[13.5px] font-bold text-brand-950">{spec.title}</h3>
                <Pill tone={PRIORITY_TONE[spec.priority]}>{spec.priority} priority</Pill>
                <Pill tone={OWNER_TONE[spec.owner]}>{spec.owner}</Pill>
                <span className="ml-auto font-mono text-[11px] text-brand-400">{spec.effort}</span>
              </div>

              {/* Observed vs Expected */}
              <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2 text-[12px]">
                <div className="rounded-lg border border-brand-200/70 bg-brand-50/50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                    Observed state
                  </p>
                  <p className="mt-0.5 text-brand-700 leading-relaxed">{spec.observedState}</p>
                </div>
                <div className="rounded-lg border border-brand-200/70 bg-brand-50/50 p-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-brand-400">
                    Expected outcome
                  </p>
                  <p className="mt-0.5 text-brand-700 leading-relaxed">{spec.expectedOutcome}</p>
                </div>
              </div>

              {/* Affected URLs */}
              {spec.affectedUrls.length > 0 && (
                <div>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400 mb-1">
                    Affected URLs ({spec.affectedUrls.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {spec.affectedUrls.slice(0, 6).map((url) =>
                      /^https?:\/\//i.test(url) ? (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] text-brand-800 hover:underline max-w-full truncate"
                        >
                          <span className="truncate">{url}</span>
                          <ExternalLink size={10} className="shrink-0 text-brand-400" />
                        </a>
                      ) : (
                        <span
                          key={url}
                          className="rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 font-mono text-[11px] text-brand-800"
                        >
                          {url}
                        </span>
                      ),
                    )}
                  </div>
                </div>
              )}

              {/* Copy-Paste Universal Code / Spec Block */}
              {spec.codeSnippet && (
                <div className="rounded-lg border border-brand-200 bg-brand-50/70 overflow-hidden">
                  <div className="flex items-center justify-between gap-2 border-b border-brand-200 px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-800">
                      <Code2 size={12} className="text-accent-600" />
                      <span>{spec.codeLabel || "Standard Implementation Snippet"}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => copyText(`code-${spec.id}`, spec.codeSnippet!)}
                      className="no-print inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-1 hover:bg-brand-100 px-2 py-0.5 text-[10.5px] font-semibold text-brand-900 cursor-pointer transition"
                    >
                      {isCodeCopied ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                      <span>{isCodeCopied ? "Copied" : "Copy snippet"}</span>
                    </button>
                  </div>
                  <pre className="overflow-x-auto p-3 font-mono text-[11px] leading-relaxed text-brand-900 whitespace-pre-wrap break-words">
                    <code>{spec.codeSnippet}</code>
                  </pre>
                </div>
              )}

              {/* Steps & QA Verification */}
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {spec.steps.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400">
                      Implementation steps
                    </p>
                    <ol className="mt-1 list-decimal space-y-0.5 pl-4 text-[12px] text-brand-950">
                      {spec.steps.map((step, i) => (
                        <li key={i}>{step}</li>
                      ))}
                    </ol>
                  </div>
                )}
                {spec.verificationChecklist.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-wider text-brand-400 flex items-center gap-1">
                      <ShieldCheck size={11} className="text-success-600" />
                      <span>How to verify (QA checklist)</span>
                    </p>
                    <ul className="mt-1 space-y-1 text-[12px] text-brand-700">
                      {spec.verificationChecklist.map((check, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success-600" />
                          <span>{check}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Action Bar (hidden on print) */}
              <div className="no-print flex flex-wrap items-center gap-2 border-t border-brand-200/70 pt-2.5">
                <button
                  type="button"
                  onClick={() => copyText(`brief-${spec.id}`, formatSpecAsMarkdown(spec))}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-brand-50 hover:bg-brand-100 px-2.5 py-1 text-[11px] font-semibold text-brand-950 transition cursor-pointer"
                >
                  {isBriefCopied ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                  <span>{isBriefCopied ? "Brief copied!" : "Copy Handoff Brief"}</span>
                </button>

                {spec.contentStudioQuery && (
                  <Link
                    href={`/fix-engine?tab=content&query=${encodeURIComponent(spec.contentStudioQuery)}&topic=${encodeURIComponent(spec.contentStudioTopic || spec.title)}&kind=ARTICLE`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 px-2.5 py-1 text-[11px] font-semibold text-white transition"
                  >
                    <PenLine size={11} />
                    <span>Draft in Content Studio</span>
                  </Link>
                )}

                {projectId && (
                  <button
                    type="button"
                    disabled={isStaged}
                    onClick={() => handleStage(spec)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition cursor-pointer",
                      isStaged
                        ? "border-success-500/30 bg-success-50 text-success-700 cursor-default"
                        : "border-brand-200 bg-surface-1 hover:bg-brand-50 text-brand-950",
                    )}
                  >
                    {isStaged ? <CheckCircle2 size={11} /> : <Wrench size={11} />}
                    <span>{isStaged ? "Staged in Fix Engine" : "Stage in Fix Engine"}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
