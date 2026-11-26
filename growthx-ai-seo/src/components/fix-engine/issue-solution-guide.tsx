"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock,
  Code2,
  Copy,
  ExternalLink,
  FileText,
  GitPullRequest,
  Globe,
  HelpCircle,
  Lightbulb,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  UserCheck,
  Wrench,
} from "lucide-react";
import { ActionButton } from "@/components/ui/console";
import type { GrowthOpportunity, ManualVerificationResult } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";
import {
  GUIDE_PLATFORMS,
  getIssueFixGuide,
  type GuidePlatform,
} from "@/lib/issue-fix-guides";
import { cn } from "@/lib/utils";

const PLATFORM_STORAGE_KEY = "reigel.guide_platform";

function readSavedPlatform(defaultPlatform: GuidePlatform): GuidePlatform {
  if (typeof window === "undefined") return defaultPlatform;
  try {
    const saved = localStorage.getItem(PLATFORM_STORAGE_KEY) as GuidePlatform | null;
    if (saved && GUIDE_PLATFORMS.some((p) => p.id === saved)) return saved;
  } catch {
    // Ignore storage errors
  }
  return defaultPlatform;
}

function savePlatformPreference(platform: GuidePlatform) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PLATFORM_STORAGE_KEY, platform);
  } catch {
    // Ignore storage errors
  }
}

interface IssueSolutionGuideProps {
  finding: GrowthOpportunity;
  domain: string | null;
  sourceLink?: { href: string; label: string } | null;
  busy?: boolean;
  onMove?: (to: string, reason?: string) => void;
  onVerifyManual?: (url?: string, note?: string) => Promise<ManualVerificationResult>;
  onOpenCmsApply?: () => void;
  onOpenContentStudio?: () => void;
  onOpenGitHubFixes?: () => void;
}

export function IssueSolutionGuide({
  finding,
  domain,
  sourceLink,
  busy = false,
  onMove,
  onVerifyManual,
  onOpenCmsApply,
  onOpenContentStudio,
  onOpenGitHubFixes,
}: IssueSolutionGuideProps) {
  const guide = getIssueFixGuide({
    title: finding.title,
    summary: finding.summary,
    recommendedAction: finding.recommendedAction,
    domain,
    affectedPages: finding.affectedPages,
    fixClass: finding.fixClass,
    source: finding.source,
  });

  const defaultPlatform: GuidePlatform =
    guide.difficulty === "developer" ? "developer" : "wordpress";

  const [platform, setPlatform] = useState<GuidePlatform>(() =>
    readSavedPlatform(defaultPlatform),
  );
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [verifyingOpen, setVerifyingOpen] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState(
    finding.affectedPages?.[0] ||
      (domain ? `https://${domain.replace(/^https?:\/\//i, "")}/` : ""),
  );
  const [verifyNote, setVerifyNote] = useState("");
  const [verifyingBusy, setVerifyingBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyResult, setVerifyResult] = useState<ManualVerificationResult | null>(null);
  const [dismissing, setDismissing] = useState(false);
  const [dismissReason, setDismissReason] = useState("");

  const lifecycle = finding.lifecycle ?? "DETECTED";
  const pages = finding.affectedPages ?? [];
  const steps = guide.platformSteps[platform];

  const handleSelectPlatform = (next: GuidePlatform) => {
    setPlatform(next);
    savePlatformPreference(next);
  };

  const copyText = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((curr) => (curr === key ? null : curr)), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleRunVerify = async () => {
    if (!onVerifyManual) return;
    setVerifyingBusy(true);
    setVerifyError(null);
    try {
      const res = await onVerifyManual(verifyUrl.trim() || undefined, verifyNote.trim() || undefined);
      setVerifyResult(res);
    } catch (err) {
      setVerifyError(errorMessage(err));
    } finally {
      setVerifyingBusy(false);
    }
  };

  return (
    <div className="mt-4 space-y-4 rounded-2xl border border-brand-200/80 bg-surface-2/50 p-4 sm:p-5">
      {/* 1. COMPLETE PLAIN-ENGLISH EXPLANATION (WHAT'S WRONG + WHY IT MATTERS) */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-1.5">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
            <HelpCircle size={13} className="text-accent-500" />
            <span>What’s happening</span>
          </p>
          <p className="text-[13px] leading-relaxed text-brand-900">{guide.whatIsWrong}</p>
          {finding.evidence.length > 0 && (
            <ul className="mt-2 space-y-1 border-t border-brand-100 pt-2">
              {finding.evidence.slice(0, 3).map((e) => (
                <li key={`${e.label}-${e.value}`} className="text-[11.5px] text-brand-500">
                  <span className="font-medium text-brand-700">{e.label}:</span>{" "}
                  <span className="text-brand-950">{e.value}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col justify-between rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-2.5">
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
              <Lightbulb size={13} className="text-warning-500" />
              <span>Why this matters for your business</span>
            </p>
            <p className="text-[13px] leading-relaxed text-brand-900">{guide.whyItMatters}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 border-t border-brand-100 pt-2.5 text-[11.5px]">
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-semibold",
                guide.difficulty === "no_code"
                  ? "bg-success-50 text-success-700"
                  : guide.difficulty === "cms_or_dev"
                    ? "bg-accent-50 text-accent-700"
                    : "bg-brand-100 text-brand-700",
              )}
            >
              {guide.difficulty === "no_code" ? <UserCheck size={11} /> : <Wrench size={11} />}
              <span>{guide.difficultyLabel}</span>
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 font-mono text-[11px] font-medium text-brand-600">
              <Clock size={11} />
              <span>~{guide.estimatedTime}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. SPECIFIC SITE RECOMMENDATION + AFFECTED PAGES */}
      {(finding.recommendedAction?.trim() || pages.length > 0) && (
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-12">
          {finding.recommendedAction?.trim() && (
            <div
              className={cn(
                "rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-1.5",
                pages.length > 0 ? "lg:col-span-7" : "lg:col-span-12",
              )}
            >
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-500">
                <Sparkles size={13} className="text-signal-500" />
                <span>Recommended solution for your site</span>
              </p>
              <p className="whitespace-pre-line text-[12.5px] leading-relaxed text-brand-900">
                {finding.recommendedAction}
              </p>
            </div>
          )}

          {pages.length > 0 && (
            <div
              className={cn(
                "rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-2",
                finding.recommendedAction?.trim() ? "lg:col-span-5" : "lg:col-span-12",
              )}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-brand-500">
                Where to fix ({finding.affectedCount ?? pages.length}{" "}
                {(finding.affectedCount ?? pages.length) === 1 ? "page" : "pages"})
              </p>
              <ul className="space-y-1.5">
                {pages.slice(0, 5).map((url) => {
                  const href = url.startsWith("http") ? url : `https://${url}`;
                  return (
                    <li key={url} className="flex items-center justify-between gap-2 text-xs">
                      <a
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-mono text-[11px] text-brand-700 hover:text-brand-950 hover:underline"
                        title={url}
                      >
                        {url.replace(/^https?:\/\//, "")}
                      </a>
                      <ExternalLink size={11} className="shrink-0 text-brand-400" />
                    </li>
                  );
                })}
                {pages.length > 5 && (
                  <li className="text-[11px] text-brand-400">
                    and {pages.length - 5} more affected pages
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 3. STEP-BY-STEP SOLUTION BY PLATFORM (FOR ANY WEBSITE BUILDER OR DEVELOPER) */}
      <div className="rounded-xl border border-brand-200/70 bg-surface-1 p-4 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-brand-950">Step-by-step solution</p>
            <p className="text-[11px] text-brand-500">
              Choose the platform your website runs on to see exact instructions.
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Choose your website platform"
            className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-brand-200/70 bg-surface-2 p-1 text-[11px]"
          >
            {GUIDE_PLATFORMS.map((p) => {
              const active = platform === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => handleSelectPlatform(p.id)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 font-semibold transition cursor-pointer",
                    active
                      ? "bg-signal-400 text-signal-ink font-bold shadow-2xs"
                      : "text-brand-600 hover:text-brand-950",
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        <ol className="space-y-2.5">
          {steps.map((step, idx) => (
            <li key={idx} className="flex items-start gap-3 text-[12.5px] leading-relaxed text-brand-800">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-signal-400/20 font-mono text-[11px] font-bold text-brand-950">
                {idx + 1}
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        {/* Optional Ready-to-Copy Snippet (always open for Developer, cleanly collapsible for non-tech users) */}
        {guide.exampleCode && (
          platform === "developer" ? (
            <div className="rounded-xl border border-brand-200 bg-surface-2 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-600">
                  <Code2 size={12} />
                  <span>{guide.exampleLabel || "Example snippet"}</span>
                </span>
                <button
                  type="button"
                  onClick={() => copyText(guide.exampleCode!, "snippet")}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-100 cursor-pointer"
                >
                  {copiedKey === "snippet" ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                  <span>{copiedKey === "snippet" ? "Copied" : "Copy"}</span>
                </button>
              </div>
              <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-brand-900">
                {guide.exampleCode}
              </pre>
            </div>
          ) : (
            <details className="rounded-xl border border-brand-200/70 bg-surface-2/70 px-3 py-2">
              <summary className="cursor-pointer text-[11.5px] font-semibold text-brand-600 hover:text-brand-950">
                Optional: View example format / snippet
              </summary>
              <div className="mt-2 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-brand-500">
                    {guide.exampleLabel || "Reference example"}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyText(guide.exampleCode!, "snippet")}
                    className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-100 cursor-pointer"
                  >
                    {copiedKey === "snippet" ? <Check size={11} className="text-success-600" /> : <Copy size={11} />}
                    <span>{copiedKey === "snippet" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <pre className="overflow-x-auto whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-brand-900">
                  {guide.exampleCode}
                </pre>
              </div>
            </details>
          )
        )}

        {/* Verification Checklist */}
        {guide.verifySteps.length > 0 && (
          <div className="border-t border-brand-100 pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-brand-400">
              How to be sure it’s fixed
            </p>
            <ul className="mt-1.5 space-y-1">
              {guide.verifySteps.map((v, idx) => (
                <li key={idx} className="flex items-start gap-2 text-xs text-brand-600">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-success-600" />
                  <span>{v}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* 4. UNIVERSAL ACTION BAR (WORKS FOR NON-TECH OWNERS, DEVELOPERS, & CONNECTED PLATFORMS) */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-200/70 pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {/* Primary Universal Action: Copy Clear Instructions for Developer / Team */}
          <ActionButton
            variant="primary"
            icon={copiedKey === "handoff" ? <Check size={12} /> : <Copy size={12} />}
            onClick={() => copyText(guide.developerHandoff, "handoff")}
          >
            {copiedKey === "handoff" ? "Copied for Developer!" : "Copy Fix Guide for Developer"}
          </ActionButton>

          {/* 1-Click Share on WhatsApp */}
          <a
            href={`https://wa.me/?text=${encodeURIComponent(guide.developerHandoff)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-brand-100/70 transition"
          >
            <MessageSquare size={12} />
            <span>Send on WhatsApp</span>
          </a>

          {/* Live Verification Check */}
          {onVerifyManual && !["VERIFIED", "MEASURED"].includes(lifecycle) && (
            <ActionButton
              variant="secondary"
              icon={<CheckCircle2 size={12} className="text-success-600" />}
              onClick={() => {
                setVerifyingOpen((v) => !v);
                setVerifyError(null);
              }}
            >
              {verifyingOpen ? "Hide Live Check" : "I Fixed It — Verify Live"}
            </ActionButton>
          )}

          {/* Optional AI Content Writer */}
          {onOpenContentStudio && (
            <ActionButton
              variant="secondary"
              icon={<FileText size={12} />}
              onClick={onOpenContentStudio}
            >
              Write Copy with AI
            </ActionButton>
          )}

          {/* Optional Auto-Apply Tools (CMS & GitHub) — available without intimidating non-tech users */}
          {onOpenCmsApply && (
            <ActionButton
              variant="secondary"
              icon={<Globe size={12} />}
              onClick={onOpenCmsApply}
            >
              Auto-Apply (CMS)
            </ActionButton>
          )}

          {onOpenGitHubFixes && (
            <ActionButton
              variant="secondary"
              icon={<GitPullRequest size={12} />}
              onClick={onOpenGitHubFixes}
            >
              GitHub PR (Dev)
            </ActionButton>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          {sourceLink && (
            <Link
              href={sourceLink.href}
              className="font-semibold text-brand-600 hover:text-brand-950 hover:underline"
            >
              {sourceLink.label}
            </Link>
          )}
          {onMove && lifecycle === "DETECTED" && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onMove("QUEUED")}
              className="font-semibold text-brand-700 hover:text-brand-950 cursor-pointer"
            >
              Save to Plan
            </button>
          )}
          {onMove && ["DETECTED", "QUEUED"].includes(lifecycle) && !dismissing && (
            <button
              type="button"
              onClick={() => setDismissing(true)}
              className="font-medium text-brand-400 hover:text-error-600 cursor-pointer"
            >
              Dismiss
            </button>
          )}
        </div>
      </div>

      {/* Dismiss Reason Form */}
      {onMove && dismissing && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-surface-1 p-3">
          <input
            value={dismissReason}
            onChange={(e) => setDismissReason(e.target.value)}
            placeholder="Why are you skipping this? (required)"
            aria-label="Reason for dismissing"
            className="h-8 flex-1 min-w-[200px] rounded-lg border border-brand-200 bg-surface-2 px-3 text-xs text-brand-950 outline-none focus:border-primary-500"
          />
          <ActionButton
            disabled={busy || dismissReason.trim() === ""}
            onClick={() => onMove("DISMISSED", dismissReason.trim())}
          >
            Confirm Dismiss
          </ActionButton>
          <button
            type="button"
            onClick={() => setDismissing(false)}
            className="text-xs text-brand-500 hover:underline cursor-pointer"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Live Website Verification Drawer */}
      {verifyingOpen && onVerifyManual && (
        <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-2.5">
          <div>
            <p className="text-xs font-bold text-brand-950">Check your live website right now</p>
            <p className="text-[11.5px] text-brand-500">
              Once you or your developer publish the update, paste the page link below. Reigel will check the live page and confirm it’s fixed.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="url"
              value={verifyUrl}
              onChange={(e) => setVerifyUrl(e.target.value)}
              placeholder="https://yourdomain.com/page"
              aria-label="Live URL to verify"
              className="h-9 rounded-lg border border-brand-200 bg-surface-2 px-3 font-mono text-[11.5px] text-brand-950 outline-none focus:border-primary-500"
            />
            <input
              type="text"
              value={verifyNote}
              onChange={(e) => setVerifyNote(e.target.value)}
              placeholder="Optional note (e.g. Updated in Shopify)"
              aria-label="Implementation note"
              className="h-9 rounded-lg border border-brand-200 bg-surface-2 px-3 text-[11.5px] text-brand-950 outline-none focus:border-primary-500"
            />
          </div>
          <ActionButton
            variant="primary"
            disabled={verifyingBusy || !verifyUrl.trim()}
            icon={verifyingBusy ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
            onClick={handleRunVerify}
          >
            {verifyingBusy ? "Checking live page…" : "Check Live Page Now"}
          </ActionButton>

          {verifyError && (
            <p role="alert" className="text-xs font-medium text-error-600">
              {verifyError}
            </p>
          )}

          {verifyResult && (
            <div
              role="status"
              className={cn(
                "rounded-lg border p-3 text-xs space-y-1.5",
                verifyResult.verified
                  ? "border-success-500/40 bg-success-50 text-success-700"
                  : "border-warning-500/40 bg-warning-50 text-warning-700",
              )}
            >
              <p className="font-bold flex items-center gap-1.5">
                {verifyResult.verified ? (
                  <CheckCircle2 size={14} className="shrink-0" />
                ) : (
                  <AlertTriangle size={14} className="shrink-0" />
                )}
                <span>{verifyResult.summary}</span>
              </p>
              <ul className="space-y-0.5 pl-4 list-disc text-[11.5px]">
                {verifyResult.checks.map((c) => (
                  <li key={c.name}>
                    <strong>{c.name}:</strong> {c.passed ? "Pass" : "Needs attention"} ({c.observed})
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
