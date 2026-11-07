"use client";

import { Suspense, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  Globe,
  Loader2,
  ShieldCheck,
  Sparkles,
  Zap,
} from "lucide-react";
import { api, auth, subscribeToAuthChange } from "@/lib/api-client";
import { setActiveProject, useWorkspace } from "@/hooks/use-growthx";
import { cn } from "@/lib/utils";

function cleanDomainInput(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/[/?#].*$/, "");
}

function AnalyzeOnboardingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { orgId, setOrgId, projects } = useWorkspace();

  const signedIn = useSyncExternalStore(
    subscribeToAuthChange,
    () => auth.isAuthenticated(),
    () => null,
  );

  const urlParam = (searchParams.get("url") || "").trim();

  const [domainInput, setDomainInput] = useState<string>(() => {
    if (urlParam) return cleanDomainInput(urlParam);
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("growthx_pending_domain");
        if (saved) return cleanDomainInput(saved);
      } catch {}
    }
    return "";
  });

  const [phase, setPhase] = useState<"input" | "crawling">("input");
  const [activeDomain, setActiveDomain] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (urlParam) {
      const cleaned = cleanDomainInput(urlParam);
      setDomainInput(cleaned);
    }
  }, [urlParam]);

  useEffect(() => {
    if (signedIn === false) {
      const target = domainInput ? `/login?url=${encodeURIComponent(domainInput)}` : "/login";
      router.replace(target);
    }
  }, [signedIn, domainInput, router]);

  // Poll live crawl status once crawling starts
  const crawlQuery = useQuery({
    queryKey: ["onboarding-crawl", activeDomain],
    queryFn: () => api.getLatestCrawl(activeDomain),
    enabled: phase === "crawling" && Boolean(activeDomain),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status === "COMPLETED" || status === "FAILED" || status === "CANCELLED") {
        return false;
      }
      return 2500;
    },
  });

  const crawlData = crawlQuery.data;
  const crawlStatus = crawlData?.status ?? "PENDING";
  const pagesCrawled = crawlData?.pagesCrawled ?? 0;
  const isCompleted = crawlStatus === "COMPLETED";
  const isFailed = crawlStatus === "FAILED" || crawlStatus === "CANCELLED";

  // Automatically redirect to Website Audit (/website) when the crawl finishes
  useEffect(() => {
    if (phase !== "crawling" || !isCompleted) return;
    const timer = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });
      queryClient.invalidateQueries({ queryKey: ["latest-crawl"] });
      queryClient.invalidateQueries({ queryKey: ["issue-counts"] });
      queryClient.invalidateQueries({ queryKey: ["issue-groups"] });
      router.replace("/website");
    }, 900);
    return () => clearTimeout(timer);
  }, [phase, isCompleted, queryClient, router]);

  async function handleStartAudit(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = cleanDomainInput(domainInput);
    if (!cleaned || !cleaned.includes(".")) {
      setError("Please enter a valid website domain, e.g. yourwebsite.com");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      let resolvedOrgId = orgId || auth.getOrgId();
      if (!resolvedOrgId) {
        const orgs = await api.listOrganizations();
        if (orgs?.[0]?.id) {
          resolvedOrgId = orgs[0].id;
          setOrgId(resolvedOrgId);
        }
      }

      const run = await api.autopilot.start(cleaned, null);

      try {
        localStorage.removeItem("growthx_pending_domain");
      } catch {}

      if (resolvedOrgId) {
        queryClient.setQueryData<{ id: string; name: string }[]>(
          ["projects", resolvedOrgId],
          (current = []) =>
            current.some((project) => project.id === run.projectId)
              ? current
              : [...current, { id: run.projectId, name: run.domain }],
        );
      }

      setActiveProject(run.projectId);
      queryClient.setQueryData(["autopilot", run.projectId], run);
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["portfolio"] });

      setActiveDomain(run.domain || cleaned);
      setPhase("crawling");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start the website audit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn !== true) return null;

  const crawlSteps = [
    {
      label: "Registering workspace & verifying domain",
      detail: `Connected to ${activeDomain} and verified HTTPS / robots.txt`,
      done: true,
      active: false,
    },
    {
      label: "Crawling website pages & sitemap",
      detail:
        pagesCrawled > 0
          ? `${pagesCrawled} ${pagesCrawled === 1 ? "page" : "pages"} scanned so far`
          : "Discovering internal links and reading pages…",
      done: isCompleted,
      active: !isCompleted && !isFailed,
    },
    {
      label: "Checking technical health, speed & SEO issues",
      detail: "Evaluating titles, meta tags, indexability, headings, and Core Web Vitals",
      done: isCompleted,
      active: !isCompleted && !isFailed && pagesCrawled > 0,
    },
    {
      label: "Preparing your Website Audit dashboard",
      detail: isCompleted
        ? "Audit complete! Redirecting to Website Audit…"
        : "Organizing findings and fix priorities",
      done: isCompleted,
      active: isCompleted,
    },
  ];

  return (
    <div className="dash-dark dark min-h-screen flex flex-col justify-between bg-surface-1 text-brand-950">
      {/* Top Bar */}
      <header
        className="flex h-16 items-center justify-between border-b px-6 sm:px-10"
        style={{ borderColor: "var(--border-color)" }}
      >
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-sm font-black text-signal-ink shadow-xs">
            R
          </span>
          <span className="text-base font-extrabold tracking-tight text-brand-950">
            Reigel
          </span>
          <span className="rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase tracking-wider text-brand-500">
            AI SEO
          </span>
        </Link>

        {projects.length > 0 && phase === "input" && (
          <Link
            href="/website"
            className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3.5 py-1.5 text-xs font-semibold text-brand-600 transition hover:border-brand-300 hover:text-brand-950"
          >
            <span>Go to Website Audit</span>
            <ArrowRight size={13} />
          </Link>
        )}
      </header>

      {/* Main Content */}
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-4 py-12 sm:px-6">
        {phase === "input" ? (
          <div
            className="rounded-3xl border bg-surface-2/80 p-7 sm:p-10 shadow-xl"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface-1 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-500">
              <Sparkles size={11} className="text-signal-400" />
              Step 1 of 2 · Website Setup
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-950">
              Add your website for audit
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-brand-500">
              Enter your website domain below. Our crawler will scan your pages, technical health, speed, and SEO issues, then open your Website Audit report automatically.
            </p>

            <form onSubmit={handleStartAudit} className="mt-6 space-y-4" noValidate>
              <div>
                <label
                  htmlFor="onboarding-domain"
                  className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-brand-500"
                >
                  Website Domain
                </label>
                <div
                  className="flex items-center overflow-hidden rounded-2xl border bg-surface-1 px-3.5 py-1 focus-within:border-brand-400 transition-colors"
                  style={{ borderColor: "var(--border-color)" }}
                >
                  <Globe size={17} className="shrink-0 text-brand-400" />
                  <span className="ml-2.5 select-none font-mono text-xs text-brand-400">
                    https://
                  </span>
                  <input
                    id="onboarding-domain"
                    type="text"
                    required
                    autoFocus
                    value={domainInput}
                    onChange={(e) => setDomainInput(e.target.value)}
                    placeholder="yourwebsite.com"
                    className="w-full bg-transparent px-1.5 py-3 font-mono text-sm font-semibold text-brand-950 placeholder:text-brand-400 focus:outline-none"
                  />
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-xl border border-error-500/30 bg-error-50 px-3.5 py-2.5 text-xs font-medium text-error-700"
                >
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !domainInput.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-signal-400 px-5 py-3.5 text-sm font-extrabold text-signal-ink shadow-md transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
              >
                {submitting ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Starting crawler…</span>
                  </>
                ) : (
                  <>
                    <span>Start Website Audit</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            <div
              className="mt-7 grid grid-cols-1 gap-2.5 border-t pt-5 text-xs text-brand-500 sm:grid-cols-3"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-center gap-2">
                <Zap size={13} className="shrink-0 text-signal-400" />
                <span>Full-site page crawl</span>
              </div>
              <div className="flex items-center gap-2">
                <ShieldCheck size={13} className="shrink-0 text-success-700" />
                <span>Technical & speed checks</span>
              </div>
              <div className="flex items-center gap-2">
                <Check size={13} className="shrink-0 text-signal-400" />
                <span>Auto-opens Website Audit</span>
              </div>
            </div>
          </div>
        ) : (
          <div
            className="rounded-3xl border bg-surface-2/80 p-7 sm:p-10 shadow-xl"
            style={{ borderColor: "var(--border-color)" }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-surface-1 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-brand-500">
                {isCompleted ? (
                  <>
                    <Check size={11} className="text-success-700" />
                    Audit Complete
                  </>
                ) : (
                  <>
                    <Loader2 size={11} className="animate-spin text-signal-400" />
                    Step 2 of 2 · Crawling Website
                  </>
                )}
              </span>

              <span className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-3 py-1 font-mono text-xs font-bold text-brand-950">
                <span className="h-2 w-2 rounded-full bg-success-500 animate-pulse" />
                {activeDomain}
              </span>
            </div>

            <h1 className="mt-4 text-2xl sm:text-3xl font-extrabold tracking-tight text-brand-950">
              {isCompleted
                ? `Finished auditing ${activeDomain}`
                : `Scanning ${activeDomain}…`}
            </h1>
            <p className="mt-1.5 text-sm text-brand-500">
              {isCompleted
                ? "Your website audit is ready. Opening your Website Audit report now…"
                : "Our crawler is reading your pages and checking technical SEO, speed, and indexability. You will be redirected automatically when it finishes."}
            </p>

            {/* Live Pages Counter Box */}
            <div
              className="mt-6 flex items-center justify-between rounded-2xl border bg-surface-1 p-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div>
                <p className="text-[10.5px] font-bold uppercase tracking-wider text-brand-400">
                  Live Crawler Progress
                </p>
                <p className="mt-0.5 text-xs text-brand-500">
                  {isCompleted
                    ? "All discovered pages have been analyzed"
                    : "Discovering and auditing internal pages in real time"}
                </p>
              </div>
              <div className="text-right">
                <span className="font-mono text-2xl font-extrabold text-brand-950">
                  {pagesCrawled}
                </span>
                <span className="ml-1.5 text-xs font-semibold text-brand-400">
                  {pagesCrawled === 1 ? "page" : "pages"}
                </span>
              </div>
            </div>

            {/* Step-by-Step Progress List */}
            <div className="mt-5 space-y-3">
              {crawlSteps.map((s, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-start gap-3 rounded-2xl border p-3.5 transition-all",
                    s.done
                      ? "border-success-500/30 bg-success-50/40"
                      : s.active
                        ? "border-brand-300 bg-surface-1"
                        : "border-brand-200/50 bg-surface-1/40 opacity-60",
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-mono text-xs font-bold",
                      s.done
                        ? "bg-success-500 text-white"
                        : s.active
                          ? "bg-signal-400 text-signal-ink"
                          : "border border-brand-300 text-brand-400",
                    )}
                  >
                    {s.done ? (
                      <Check size={13} strokeWidth={3} />
                    ) : s.active ? (
                      <Loader2 size={13} className="animate-spin" />
                    ) : (
                      idx + 1
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-brand-950">{s.label}</p>
                    <p className="mt-0.5 text-[11px] text-brand-500">{s.detail}</p>
                  </div>
                </div>
              ))}
            </div>

            {isFailed && (
              <div className="mt-4 rounded-xl border border-warning-500/30 bg-warning-50 px-4 py-3 text-xs text-warning-700">
                The initial crawl encountered an issue or stopped early. You can still open Website Audit to inspect diagnostics or trigger a fresh scan.
              </div>
            )}

            {/* Action Footer */}
            <div
              className="mt-6 flex flex-col gap-2.5 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
              style={{ borderColor: "var(--border-color)" }}
            >
              <span className="text-[11px] text-brand-400">
                {isCompleted
                  ? "Redirecting to Website Audit…"
                  : "Large websites can also be viewed live while crawling."}
              </span>
              <button
                type="button"
                onClick={() => router.replace("/website")}
                className={cn(
                  "inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-xs font-bold transition cursor-pointer",
                  isCompleted
                    ? "bg-signal-400 text-signal-ink shadow-xs"
                    : "border border-brand-200 bg-surface-1 text-brand-700 hover:border-brand-300 hover:text-brand-950",
                )}
              >
                <span>Open Website Audit</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="py-5 text-center text-xs text-brand-400">
        Reigel AI SEO · Automated Website Audit & Fix Engine
      </footer>
    </div>
  );
}

export default function AnalyzePage() {
  return (
    <Suspense
      fallback={
        <div className="dash-dark dark flex min-h-screen items-center justify-center bg-surface-1 text-brand-950">
          <Loader2 size={24} className="animate-spin text-brand-400" />
        </div>
      }
    >
      <AnalyzeOnboardingInner />
    </Suspense>
  );
}
