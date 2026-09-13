"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileCode2,
  GitPullRequest,
  Loader2,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { ActionButton, Pill } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { DesignStudioLink } from "@/components/design-studio/design-studio-link";
import { useRunFixes } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";
import type { AutomationRun, CrawlIssue, FixPreviewResult } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

/**
 * What a fix will change, and where.
 *
 * Everything shown here now comes from `POST /api/issues/:id/fix-preview`.
 * This modal used to render both sides of the diff from hardcoded templates:
 * the "current state" was a fixed comment describing the problem category
 * rather than the page's code, the "fixed code" was a template with the domain
 * interpolated — so a SCHEMA_PRODUCT_OFFERS defect was answered with a generic
 * WebPage schema — and the file path was guessed from the URL. One template
 * went further and wrote invented claims about the customer's business into
 * the suggested copy.
 *
 * The rule now: every panel is stored data or an explicit "we could not
 * establish this". Nothing is filled in to look complete.
 */

interface AutoFixModalProps {
  issue: CrawlIssue | null;
  /** Required to open a pull request; without it only the snippet is offered. */
  projectId?: string | null;
  /** True once a GitHub repository is connected for this project. */
  repoConnected?: boolean;
  onClose: () => void;
}

/** The stack a file path implies. Derived from the real file, not asked for. */
function stackFor(path: string | null): string | null {
  if (!path) return null;
  if (/\.(tsx|jsx|ts|js)$/.test(path)) return path.includes("/app/") ? "Next.js App Router" : "Next.js";
  if (path.endsWith(".liquid")) return "Shopify Liquid";
  if (path.endsWith(".html")) return "Static HTML";
  return null;
}

export function AutoFixModal({
  issue,
  projectId,
  repoConnected = false,
  onClose,
}: AutoFixModalProps) {
  const [copied, setCopied] = useState(false);
  // The finished run, once one has been attempted. Nothing here is set
  // optimistically: an earlier version flipped a local flag and told the user
  // the fix was "marked for verification" without contacting the server at all.
  const [run, setRun] = useState<AutomationRun | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const runFixes = useRunFixes(projectId ?? null);

  // `issue` is null whenever the modal has nothing to show. That check cannot
  // come before the hooks below: React matches hooks up by call order, so a
  // component that runs fewer of them on some renders crashes with "rendered
  // more hooks than during the previous render" the moment it is mounted with
  // a null issue and then given one.
  const affectedPath = useMemo(() => {
    if (!issue) return "";
    try {
      return new URL(issue.affectedUrl).pathname || "/";
    } catch {
      return issue.affectedUrl;
    }
  }, [issue]);

  // Generating the patch costs model tokens, so it is fetched once per issue
  // and cached rather than re-run whenever the modal re-renders.
  const preview = useQuery({
    queryKey: ["fix-preview", issue?.id],
    queryFn: () => api.fixPreview(issue!.id),
    enabled: Boolean(issue?.id),
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const data: FixPreviewResult | undefined = preview.data;
  const canOpenPr = Boolean(projectId && repoConnected);

  async function handleCopy() {
    if (!data) return;
    await navigator.clipboard.writeText(data.after.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleOpenPullRequest() {
    if (!issue || !projectId) return;
    setRunError(null);
    try {
      const result = await runFixes.mutateAsync([issue.id]);
      setRun(result);
    } catch (error) {
      setRunError(errorMessage(error));
    }
  }

  /**
   * Reports what the run actually did. A run that finishes without a pull
   * request is not a success: the build may have failed, or no file in the
   * repository matched the affected URL, and both leave the site unchanged.
   */
  const statusLine = (() => {
    if (runError) {
      return (
        <span className="flex items-center gap-1.5 text-xs font-semibold text-error-600">
          <AlertTriangle size={13} className="shrink-0" />
          <span className="truncate">{runError}</span>
        </span>
      );
    }

    if (runFixes.isPending) {
      return (
        <span className="flex items-center gap-1.5 text-xs text-brand-400">
          <Loader2 size={13} className="animate-spin shrink-0" />
          <span>Cloning, patching and building — this takes a few minutes.</span>
        </span>
      );
    }

    if (run?.pullRequestUrl) {
      return (
        <a
          href={run.pullRequestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-xs font-semibold text-success-600 hover:underline"
        >
          <CheckCircle2 size={13} className="shrink-0" />
          <span>Pull request opened — the diff there is the real change</span>
          <ExternalLink size={11} className="shrink-0" />
        </a>
      );
    }

    if (run) {
      const lastFailure = [...(run.steps ?? [])].reverse().find((step) => !step.ok);
      const message =
        run.error ??
        lastFailure?.detail ??
        "The run finished without opening a pull request. Nothing was changed.";
      return (
        <span
          className="flex items-center gap-1.5 text-xs font-semibold text-warning-600"
          title={message}
        >
          <AlertTriangle size={13} className="shrink-0" />
          <span className="truncate">{message}</span>
        </span>
      );
    }

    if (!canOpenPr) {
      return (
        <span className="text-xs text-brand-400">
          Connect a GitHub repository in Integrations to open fixes as a pull request.
          Until then, copy the snippet and deploy it yourself.
        </span>
      );
    }

    return (
      <span className="text-xs text-brand-400">
        Opens a pull request against your connected repository for review.
      </span>
    );
  })();

  if (!issue) return null;

  const stack = stackFor(data?.location.path ?? null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="relative flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border bg-white shadow-2xl">
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between border-b bg-brand-50/50 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-accent-600/10 p-2 text-accent-700">
              <Sparkles size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-brand-950">
                  {data?.fixType ? humanFixType(data.fixType) : issue.issueType}
                </h3>
                <Pill
                  tone={
                    issue.severity === "CRITICAL"
                      ? "bad"
                      : issue.severity === "HIGH"
                        ? "warn"
                        : "info"
                  }
                >
                  {issue.severity}
                </Pill>
              </div>
              <p className="mt-0.5 text-xs text-brand-400">
                {issue.issueType} · {affectedPath}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-md p-1.5 text-brand-400 transition hover:bg-brand-100 hover:text-brand-700"
          >
            <X size={18} />
          </button>
        </div>

        {/* ── Body ────────────────────────────────────────────────────── */}
        <div className="space-y-5 overflow-y-auto p-5">
          <div className="space-y-1.5 rounded-lg border bg-brand-50/70 p-3.5 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold text-brand-950">Audit diagnosis</span>
              <a
                href={issue.affectedUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 font-mono text-[11px] text-accent-600 hover:underline"
              >
                <span className="truncate">{issue.affectedUrl}</span>
                <ExternalLink size={10} className="shrink-0" />
              </a>
            </div>
            <p className="text-brand-700">{issue.description}</p>
            {issue.recommendation && (
              <p className="pt-0.5 text-[11px] text-brand-400">
                <strong className="text-brand-900">Recommended action:</strong>{" "}
                {issue.recommendation}
              </p>
            )}
          </div>

          <QueryState
            isLoading={preview.isLoading}
            error={preview.error}
            isEmpty={!data}
            emptyTitle="No fix could be generated"
            emptyBody="This issue has no page context stored, so nothing could be written from it."
          >
            {data && (
              <>
                {/* ── Where it goes ──────────────────────────────────── */}
                <section>
                  <SectionLabel>Where this changes</SectionLabel>
                  <div className="mt-1.5 rounded-lg border bg-white p-3">
                    <div className="flex items-start gap-2">
                      <FileCode2 size={14} className="mt-0.5 shrink-0 text-brand-400" />
                      <div className="min-w-0">
                        {data.location.path ? (
                          <p className="break-all font-mono text-[12px] font-semibold text-brand-950">
                            {data.location.path}
                          </p>
                        ) : (
                          <p className="text-[12px] font-semibold text-brand-600">
                            File not confirmed
                          </p>
                        )}
                        <p className="mt-0.5 text-[11px] text-brand-400">
                          {data.location.note}
                        </p>
                        {stack && (
                          <p className="mt-1 text-[11px] text-brand-500">
                            Detected stack: <strong className="text-brand-700">{stack}</strong>
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Only useful when nothing was confirmed — otherwise it is
                        noise next to a known-good path. */}
                    {data.location.source === "derived" && data.location.candidates.length > 0 && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-[11px] text-brand-500 hover:text-brand-700">
                          Paths checked ({data.location.candidates.length})
                        </summary>
                        <ul className="mt-1.5 space-y-0.5">
                          {data.location.candidates.slice(0, 8).map((candidate) => (
                            <li key={candidate} className="font-mono text-[10.5px] text-brand-400">
                              {candidate}
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </section>

                {/* ── What a reader will notice ──────────────────────── */}
                <section className="rounded-lg border bg-brand-50/70 p-3">
                  <p className="text-[11.5px] leading-relaxed text-brand-600">
                    {data.surfaceNote}
                  </p>
                  {data.surface === "PAGE" && (
                    <div className="mt-2">
                      <DesignStudioLink label="Preview in Design Studio" pageUrl={data.targetUrl} />
                    </div>
                  )}
                </section>

                {/* ── Before ─────────────────────────────────────────── */}
                <section>
                  <SectionLabel tone="bad">On the page today</SectionLabel>
                  <p className="mt-1 text-[11px] text-brand-400">{data.before.note}</p>

                  {data.before.existingSchemas.length > 0 ? (
                    <ul className="mt-1.5 space-y-1.5">
                      {data.before.existingSchemas.map((schema, index) => (
                        <li
                          key={`${schema.schemaType}-${index}`}
                          className="rounded-lg border bg-white p-2.5"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-[11px] font-semibold text-brand-950">
                              {schema.schemaType}
                            </span>
                            <Pill tone={schema.isValid ? "good" : "bad"}>
                              {schema.isValid ? "valid" : "invalid"}
                            </Pill>
                          </div>
                          {schema.rawJson && (
                            <pre className="mt-1.5 max-h-32 overflow-auto font-mono text-[10.5px] leading-relaxed text-brand-600">
                              {schema.rawJson}
                            </pre>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : data.before.value ? (
                    <pre className="mt-1.5 overflow-x-auto rounded-lg border border-error-200 bg-error-50 p-3 font-mono text-xs text-error-700">
                      {data.before.value}
                    </pre>
                  ) : (
                    <p className="mt-1.5 rounded-lg border border-dashed bg-white p-3 text-[11.5px] italic text-brand-400">
                      Nothing to replace — this fix adds something the page does not have.
                    </p>
                  )}
                </section>

                {/* ── After ──────────────────────────────────────────── */}
                <section>
                  <div className="flex items-center justify-between gap-2">
                    <SectionLabel tone="good">Proposed change</SectionLabel>
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-600 transition hover:text-accent-700"
                    >
                      {copied ? <Check size={12} className="text-success-500" /> : <Copy size={12} />}
                      <span>{copied ? "Copied" : "Copy snippet"}</span>
                    </button>
                  </div>

                  {/* Provenance, stated plainly: a deterministic fallback and a
                      model-written patch are not the same claim. */}
                  <p className="mt-1 text-[11px] text-brand-400">
                    {data.after.source === "model"
                      ? `Written from this page's own content${data.after.model ? ` by ${data.after.model}` : ""}.`
                      : "Derived deterministically from this page — no model was reachable."}
                  </p>

                  <pre className="mt-1.5 max-h-56 overflow-x-auto rounded-lg border bg-brand-950 p-3.5 font-mono text-xs leading-relaxed text-success-400">
                    {data.after.codeSnippet}
                  </pre>
                </section>

                {data.validatorUrl && (
                  <a
                    href={data.validatorUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-accent-600 hover:underline"
                  >
                    <Search size={12} />
                    Check this page with Google Rich Results
                    <ExternalLink size={10} />
                  </a>
                )}
              </>
            )}
          </QueryState>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-4 border-t bg-brand-50/50 px-5 py-3.5">
          <div className="flex min-w-0 items-center gap-2">{statusLine}</div>
          <div className="flex shrink-0 items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleCopy}
              disabled={!data}
              icon={copied ? <Check size={12} /> : <Copy size={12} />}
            >
              {copied ? "Copied" : "Copy snippet"}
            </ActionButton>
            {canOpenPr && (
              <ActionButton
                variant="primary"
                onClick={handleOpenPullRequest}
                disabled={runFixes.isPending || !data}
                icon={
                  runFixes.isPending ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <GitPullRequest size={12} />
                  )
                }
              >
                {runFixes.isPending
                  ? "Opening pull request…"
                  : run && !run.pullRequestUrl
                    ? "Retry & open PR"
                    : "Apply & open PR"}
              </ActionButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionLabel({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone?: "good" | "bad";
}) {
  return (
    <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-500">
      {tone && (
        <span
          className={
            tone === "good"
              ? "h-2 w-2 rounded-full bg-success-500"
              : "h-2 w-2 rounded-full bg-error-500"
          }
        />
      )}
      {children}
    </span>
  );
}

/** `PRODUCT_SCHEMA` reads as machinery; "Product schema" reads as a change. */
function humanFixType(fixType: string): string {
  const words = fixType.toLowerCase().split("_");
  return words
    .map((word, index) => (index === 0 ? word.charAt(0).toUpperCase() + word.slice(1) : word))
    .join(" ");
}
