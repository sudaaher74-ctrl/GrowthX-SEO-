"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileSpreadsheet,
  Link2,
  Lock,
  MessageSquare,
  RotateCcw,
  Save,
  Share2,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { api } from "@/lib/api-client";
import type { MonthlyReportPayload } from "@/lib/api-types";
import { downloadCsvFile } from "@/lib/report-csv";
import { errorMessage } from "@/lib/error-message";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "");
  } catch {
    return url;
  }
}

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return "—";
  return new Intl.NumberFormat().format(v);
}

export interface MonthlyReportSnapshotContext {
  projectId: string;
  domain: string;
  month: string;
  monthLabel: string;
  isCurrentMonth: boolean;
  whiteLabel: MonthlyReportPayload["whiteLabel"];
  liveKpis: NonNullable<MonthlyReportPayload["kpis"]>;
  liveAiVisibility: MonthlyReportPayload["aiVisibility"];
  liveCompetitors: MonthlyReportPayload["competitors"];
  liveFixes: NonNullable<MonthlyReportPayload["fixes"]>;
  dailyGscRows: Array<{ date: string; a: number | null; b: number | null }>;
  dailyGa4Rows: Array<{ date: string; a: number | null; b: number | null }>;
}

/**
 * Provides all 7 agency-grade reporting capabilities for Monthly Report:
 * 1. Frozen historical snapshots (lock & load past months accurately)
 * 2. Zero-login white-labeled client portal share link (generate/copy/revoke)
 * 3. Missing data pillars (Backlinks, Top/Declining Keywords, Regressions/Rollbacks, Next Month Top 5 ROI Priorities)
 * 4. Truthful 3-part Executive Summary + editable Account Manager Commentary
 * 5. Server-rendered Playwright PDF download + 1-click CSV export
 */
export function useMonthlyReportSnapshotData(ctx: MonthlyReportSnapshotContext | null) {
  const projectId = ctx?.projectId ?? "";
  const month = ctx?.month ?? "";

  const snapshotQuery = useQuery({
    queryKey: ["monthly-snapshot", projectId, month],
    queryFn: () => api.monthlyReports.get(projectId, month),
    enabled: Boolean(projectId && month),
    retry: false,
  });

  const backlinksQuery = useQuery({
    queryKey: ["monthly-backlinks", projectId],
    queryFn: () => api.backlinks.report(projectId, 0),
    enabled: Boolean(projectId),
    retry: false,
  });

  const topKeywordsQuery = useQuery({
    queryKey: ["monthly-keywords-top", projectId],
    queryFn: () => api.gscQueries(projectId, 28, 15),
    enabled: Boolean(projectId),
    retry: false,
  });

  const decliningKeywordsQuery = useQuery({
    queryKey: ["monthly-keywords-declining", projectId],
    queryFn: () => api.gscDeclining(projectId, 28),
    enabled: Boolean(projectId),
    retry: false,
  });

  const ledgerQuery = useQuery({
    queryKey: ["monthly-ledger", projectId],
    queryFn: () => api.getFixImpactLedger(projectId),
    enabled: Boolean(projectId),
    retry: false,
  });

  const topFindingsQuery = useQuery({
    queryKey: ["monthly-findings", projectId],
    queryFn: () => api.findings(projectId, { limit: 5 }),
    enabled: Boolean(projectId),
    retry: false,
  });

  const snapshot = snapshotQuery.data ?? null;
  const useFrozen = Boolean(snapshot?.isLocked && snapshot.payload);

  // Assemble live pillars when not locked (or for locking a fresh snapshot)
  const liveTopKeywords = (topKeywordsQuery.data ?? []).slice(0, 12).map((q) => ({
    query: q.key,
    clicks: q.clicks,
    impressions: q.impressions,
    position: q.position,
    ctr: q.ctr,
  }));

  const liveDecliningKeywords = (decliningKeywordsQuery.data ?? []).slice(0, 8).map((q) => ({
    query: q.query,
    clicks: q.currentClicks,
    position: q.currentPosition,
    previousPosition: q.previousPosition,
  }));

  const bl = backlinksQuery.data;
  const liveBacklinks: MonthlyReportPayload["backlinks"] = bl
    ? {
        totalVerified: bl.summary.verifiedLinks,
        referringDomains: bl.summary.referringDomains,
        newCount: bl.sources.length,
        lostCount: bl.summary.confirmedLostLinks,
        topSources: bl.sources.slice(0, 10).map((s) => ({
          domain: hostOf(s.sourceUrl),
          url: s.sourceUrl,
          status: s.status,
        })),
      }
    : null;

  const monthLedger = (ledgerQuery.data ?? []).filter(
    (e) => !month || (e.createdAt && e.createdAt.slice(0, 7) === month),
  );
  const liveAccountability = monthLedger
    .filter((e) => e.eventType === "REGRESSION_DETECTED" || e.eventType === "FIX_ROLLED_BACK")
    .map((e) => ({
      eventType: e.eventType,
      title: e.title,
      affectedUrl: e.affectedUrl ?? null,
      createdAt: e.createdAt,
    }));

  const livePriorities = (topFindingsQuery.data?.items ?? []).slice(0, 5).map((f) => ({
    title: f.title,
    source: f.source,
    potential: f.potential,
    effort: f.effort,
    roiNote: f.evidence.find((e) => e.label === "Site historical ROI")?.value ?? null,
  }));

  const regressionsCount = liveAccountability.filter((e) => e.eventType === "REGRESSION_DETECTED").length;
  const rollbacksCount = liveAccountability.filter((e) => e.eventType === "FIX_ROLLED_BACK").length;

  const liveWins: string[] = [];
  if (ctx?.liveKpis.clicks != null && ctx.liveKpis.clicks > 0) {
    const diffStr =
      ctx.liveKpis.clicksDiff != null
        ? ` (${ctx.liveKpis.clicksDiff >= 0 ? "+" : ""}${fmtNum(ctx.liveKpis.clicksDiff)} vs prior month)`
        : "";
    liveWins.push(`${fmtNum(ctx.liveKpis.clicks)} Google Search clicks recorded${diffStr}.`);
  }
  if (ctx?.liveKpis.sessions != null && ctx.liveKpis.sessions > 0) {
    liveWins.push(`${fmtNum(ctx.liveKpis.sessions)} total website sessions tracked in GA4.`);
  }
  if (liveBacklinks && liveBacklinks.referringDomains > 0) {
    liveWins.push(`${fmtNum(liveBacklinks.referringDomains)} verified referring domains (${fmtNum(liveBacklinks.totalVerified)} live links).`);
  }
  if (ctx?.liveKpis.healthScore != null) {
    liveWins.push(`Technical website health score measured at ${ctx.liveKpis.healthScore}/100.`);
  }

  const liveWorkCompleted: string[] = [];
  if (ctx && ctx.liveFixes.length > 0) {
    liveWorkCompleted.push(`${ctx.liveFixes.length} website optimization${ctx.liveFixes.length === 1 ? "" : "s"} verified live in DOM.`);
  }
  if (regressionsCount > 0) {
    liveWorkCompleted.push(`Regression Guard caught & reopened ${regressionsCount} recurring defect${regressionsCount === 1 ? "" : "s"}.`);
  }
  if (rollbacksCount > 0) {
    liveWorkCompleted.push(`${rollbacksCount} change${rollbacksCount === 1 ? "" : "s"} safely rolled back.`);
  }

  const livePayload: MonthlyReportPayload | null = ctx
    ? {
        domain: ctx.domain,
        month: ctx.month,
        monthLabel: ctx.monthLabel,
        generatedAt: new Date().toISOString(),
        whiteLabel: ctx.whiteLabel,
        executiveSummary: {
          wins: liveWins,
          workCompleted: liveWorkCompleted,
          nextMonthFocus: livePriorities.slice(0, 3).map((p) => p.title),
        },
        kpis: {
          ...ctx.liveKpis,
          regressions: regressionsCount,
          rollbacks: rollbacksCount,
          referringDomains: liveBacklinks?.referringDomains ?? null,
          verifiedBacklinks: liveBacklinks?.totalVerified ?? null,
        },
        topKeywords: liveTopKeywords,
        decliningKeywords: liveDecliningKeywords,
        aiVisibility: ctx.liveAiVisibility,
        backlinks: liveBacklinks,
        competitors: ctx.liveCompetitors,
        fixes: ctx.liveFixes,
        accountabilityEvents: liveAccountability,
        nextMonthPriorities: livePriorities,
      }
    : null;

  const activePayload = useFrozen ? snapshot!.payload : livePayload;

  return {
    snapshot,
    useFrozen,
    activePayload,
    livePayload,
    isLoadingSnapshot: snapshotQuery.isLoading,
  };
}

export function MonthlyReportToolbarActions({
  ctx,
  snapshotData,
}: {
  ctx: MonthlyReportSnapshotContext;
  snapshotData: ReturnType<typeof useMonthlyReportSnapshotData>;
}) {
  const queryClient = useQueryClient();
  const { snapshot, activePayload, livePayload } = snapshotData;
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<{ tone: "good" | "bad"; text: string } | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);

  const lockMutation = useMutation({
    mutationFn: () =>
      api.monthlyReports.lock(ctx.projectId, ctx.month, {
        payload: livePayload ?? undefined,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["monthly-snapshot", ctx.projectId, ctx.month], saved);
      setToast({ tone: "good", text: `Locked ${ctx.monthLabel} snapshot for historical accuracy.` });
    },
    onError: (err) => setToast({ tone: "bad", text: errorMessage(err) }),
  });

  const shareMutation = useMutation({
    mutationFn: () =>
      api.monthlyReports.share(ctx.projectId, ctx.month, {
        expiresInDays: 30,
        payload: livePayload ?? undefined,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["monthly-snapshot", ctx.projectId, ctx.month] });
      setShareOpen(true);
    },
    onError: (err) => setToast({ tone: "bad", text: errorMessage(err) }),
  });

  const revokeMutation = useMutation({
    mutationFn: () => api.monthlyReports.revokeShare(ctx.projectId, ctx.month),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["monthly-snapshot", ctx.projectId, ctx.month] });
      setToast({ tone: "good", text: "Client share link revoked." });
      setShareOpen(false);
    },
    onError: (err) => setToast({ tone: "bad", text: errorMessage(err) }),
  });

  const shareUrl =
    snapshot?.shareToken && typeof window !== "undefined"
      ? `${window.location.origin}/share/report/${snapshot.shareToken}`
      : null;

  const handleCopyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast({ tone: "bad", text: "Could not copy link automatically." });
    }
  };

  const handleDownloadCsv = () => {
    if (!activePayload) return;
    const k = activePayload.kpis ?? {};
    downloadCsvFile(`${ctx.domain}-${ctx.month}-monthly-report.csv`, [
      {
        title: "Executive KPIs",
        headers: ["Metric", "Value"],
        rows: [
          ["Domain", ctx.domain],
          ["Month", ctx.monthLabel],
          ["Search Clicks", k.clicks ?? ""],
          ["Impressions", k.impressions ?? ""],
          ["Website Sessions", k.sessions ?? ""],
          ["Site Health Score", k.healthScore ?? ""],
          ["AI Citation Share (%)", k.aiCitationSharePct ?? ""],
          ["Referring Domains", k.referringDomains ?? ""],
          ["Verified Backlinks", k.verifiedBacklinks ?? ""],
          ["Verified Fixes", k.verifiedFixes ?? 0],
          ["Regressions Caught", k.regressions ?? 0],
          ["Rollbacks", k.rollbacks ?? 0],
        ],
      },
      {
        title: "Daily Search Performance (GSC)",
        headers: ["Date", "Clicks", "Impressions"],
        rows: ctx.dailyGscRows.map((r) => [r.date, r.a ?? "", r.b ?? ""]),
      },
      {
        title: "Daily Website Traffic (GA4)",
        headers: ["Date", "Sessions", "Users"],
        rows: ctx.dailyGa4Rows.map((r) => [r.date, r.a ?? "", r.b ?? ""]),
      },
      {
        title: "Top Keywords",
        headers: ["Keyword", "Clicks", "Impressions", "Avg Position"],
        rows: (activePayload.topKeywords ?? []).map((kw) => [kw.query, kw.clicks, kw.impressions, kw.position]),
      },
      {
        title: "Backlinks",
        headers: ["Domain", "Source URL", "Status"],
        rows: (activePayload.backlinks?.topSources ?? []).map((s) => [s.domain, s.url, s.status]),
      },
      {
        title: "Verified Fixes",
        headers: ["Title", "URL", "Field", "Status", "PR URL"],
        rows: (activePayload.fixes ?? []).map((f) => [f.title, f.url, f.field, f.status, f.pullRequestUrl ?? ""]),
      },
      {
        title: "Next Month Top 5 Priorities",
        headers: ["Action", "Source", "Impact", "Effort", "Historical ROI"],
        rows: (activePayload.nextMonthPriorities ?? []).map((p) => [p.title, p.source, p.potential, p.effort, p.roiNote ?? ""]),
      },
    ]);
  };

  const handleServerPdf = async () => {
    if (pdfBusy) return;
    setPdfBusy(true);
    setToast(null);
    try {
      const blob = await api.monthlyReports.downloadPdf(ctx.projectId, ctx.month, {
        payload: activePayload ?? undefined,
        agencyNotes: snapshot?.agencyNotes,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${ctx.domain.replace(/[^a-z0-9.-]/gi, "-")}-monthly-report-${ctx.month}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setToast({ tone: "good", text: "Server-rendered A4 PDF downloaded." });
    } catch (err) {
      setToast({ tone: "bad", text: `Server PDF unavailable (${errorMessage(err)}). Use Print / Save PDF instead.` });
    } finally {
      setPdfBusy(false);
    }
  };

  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={lockMutation.isPending}
        onClick={() => lockMutation.mutate()}
        title={snapshot?.isLocked ? "Update & re-freeze this month's snapshot" : "Freeze this month's data so historical figures never drift"}
        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
      >
        <Lock size={12} className={snapshot?.isLocked ? "text-success-600" : "text-brand-500"} />
        <span>
          {lockMutation.isPending ? "Locking…" : snapshot?.isLocked ? "Snapshot Locked" : "Lock Snapshot"}
        </span>
      </button>

      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (snapshot?.shareToken) setShareOpen((v) => !v);
            else shareMutation.mutate();
          }}
          disabled={shareMutation.isPending}
          className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
        >
          <Share2 size={12} className="text-primary-600" />
          <span>{shareMutation.isPending ? "Creating link…" : "Share Client Link"}</span>
        </button>

        {shareOpen && shareUrl && (
          <div className="absolute right-0 top-10 z-40 w-80 rounded-2xl border border-brand-200 bg-surface-1 p-3.5 shadow-xl space-y-2.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-brand-950 flex items-center gap-1.5">
                <Link2 size={13} className="text-primary-600" />
                Zero-Login Client Portal Link
              </span>
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="text-brand-400 hover:text-brand-900 cursor-pointer"
              >
                ×
              </button>
            </div>
            <p className="text-[11px] text-brand-500">
              Read-only frozen white-labeled deliverable. Clients can open and export without signing in.
            </p>
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                readOnly
                value={shareUrl}
                className="flex-1 rounded-lg border border-brand-200 bg-surface-2 px-2 py-1.5 font-mono text-[10.5px] text-brand-800"
              />
              <button
                type="button"
                onClick={handleCopyShare}
                className="inline-flex items-center gap-1 rounded-lg bg-signal-400 px-2.5 py-1.5 text-[11px] font-bold text-signal-ink hover:bg-signal-500 cursor-pointer"
              >
                {copied ? <Check size={12} /> : <Copy size={12} />}
                <span>{copied ? "Copied" : "Copy"}</span>
              </button>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-brand-200/70">
              <a
                href={shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-accent-700 hover:underline"
              >
                <span>Open preview</span>
                <ExternalLink size={11} />
              </a>
              <button
                type="button"
                disabled={revokeMutation.isPending}
                onClick={() => revokeMutation.mutate()}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-error-700 hover:underline cursor-pointer"
              >
                <Trash2 size={11} />
                <span>Revoke link</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={pdfBusy}
        onClick={handleServerPdf}
        title="Download server-rendered A4 white-labeled PDF"
        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer disabled:opacity-50"
      >
        <Download size={12} className="text-brand-600" />
        <span>{pdfBusy ? "Rendering PDF…" : "A4 PDF"}</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadCsv}
        title="Export all monthly metrics, keywords, backlinks, and fixes as CSV"
        className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-800 hover:bg-surface-2 transition cursor-pointer"
      >
        <FileSpreadsheet size={12} className="text-success-700" />
        <span>CSV</span>
      </button>

      {toast && (
        <span
          className={`w-full sm:w-auto rounded-lg px-2.5 py-1 text-[11px] font-semibold ${
            toast.tone === "good"
              ? "bg-success-50 text-success-700 border border-success-200"
              : "bg-error-50 text-error-700 border border-error-200"
          }`}
        >
          {toast.text}
        </span>
      )}
    </div>
  );
}

export function MonthlyReportExecutiveSummaryAndNotes({
  ctx,
  snapshotData,
}: {
  ctx: MonthlyReportSnapshotContext;
  snapshotData: ReturnType<typeof useMonthlyReportSnapshotData>;
}) {
  const queryClient = useQueryClient();
  const { snapshot, useFrozen, activePayload, livePayload } = snapshotData;

  const [draftNotes, setDraftNotes] = useState<string | null>(null);
  const [notesMonthKey, setNotesMonthKey] = useState<string>("");
  const [savedNotice, setSavedNotice] = useState(false);

  const currentKey = `${ctx.projectId}:${ctx.month}`;
  const notesValue = notesMonthKey === currentKey && draftNotes !== null ? draftNotes : (snapshot?.agencyNotes ?? "");

  const saveNotesMutation = useMutation({
    mutationFn: () => api.monthlyReports.saveNotes(ctx.projectId, ctx.month, notesValue),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["monthly-snapshot", ctx.projectId, ctx.month] });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 2500);
    },
  });

  const lockMutation = useMutation({
    mutationFn: () =>
      api.monthlyReports.lock(ctx.projectId, ctx.month, {
        payload: livePayload ?? undefined,
        agencyNotes: notesValue,
      }),
    onSuccess: (saved) => {
      queryClient.setQueryData(["monthly-snapshot", ctx.projectId, ctx.month], saved);
    },
  });

  const summary = activePayload?.executiveSummary;

  return (
    <div className="space-y-4">
      {/* Historical Snapshot Integrity Banner */}
      {useFrozen && snapshot?.lockedAt ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-success-200/80 bg-success-50/70 px-4 py-2.5 text-xs text-success-800">
          <div className="flex items-center gap-2 font-medium">
            <Lock size={13} className="text-success-600 shrink-0" />
            <span>
              Viewing frozen historical snapshot for <strong>{ctx.monthLabel}</strong> (locked{" "}
              {new Date(snapshot.lockedAt).toLocaleDateString(undefined, {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
              ). Past metrics remain preserved accurately.
            </span>
          </div>
        </div>
      ) : !ctx.isCurrentMonth ? (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 rounded-xl border border-warning-200/80 bg-warning-50/70 px-4 py-2.5 text-xs text-warning-800">
          <div className="flex items-center gap-2">
            <AlertTriangle size={13} className="text-warning-600 shrink-0" />
            <span>
              <strong>{ctx.monthLabel}</strong> is not locked yet — AI Visibility and Competitor panels reflect current workspace data until frozen.
            </span>
          </div>
          <button
            type="button"
            disabled={lockMutation.isPending}
            onClick={() => lockMutation.mutate()}
            className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-2.5 py-1 text-[11px] font-semibold text-brand-50 hover:bg-brand-800 cursor-pointer disabled:opacity-50"
          >
            <Lock size={11} />
            <span>{lockMutation.isPending ? "Locking…" : "Lock Snapshot Now"}</span>
          </button>
        </div>
      ) : null}

      {/* 3-Column Auto-Generated Executive Summary */}
      {summary && (
        <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles size={15} className="text-primary-600" />
            <h2 className="text-sm font-bold text-brand-950">Executive Summary — {ctx.monthLabel}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { title: "Wins Observed This Month", items: summary.wins, empty: "Connect GSC/GA4 or run a crawl to measure monthly wins." },
              { title: "Work Verified Live", items: summary.workCompleted, empty: "No verified Fix Engine deployments recorded in this month yet." },
              { title: "Next Month's Focus", items: summary.nextMonthFocus, empty: "All open Fix Engine priorities are currently resolved." },
            ].map((col) => (
              <div key={col.title} className="rounded-xl border border-brand-200/70 bg-surface-2/50 p-3.5 space-y-2">
                <p className="text-[11px] font-bold uppercase tracking-wider text-brand-700">{col.title}</p>
                {col.items.length > 0 ? (
                  <ul className="space-y-1.5 text-xs text-brand-800 list-disc pl-4">
                    {col.items.map((line, i) => (
                      <li key={i}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-brand-400">{col.empty}</p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Editable Account Manager Commentary */}
      <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
            <MessageSquare size={14} className="text-brand-600" />
            <span>Account Manager Commentary</span>
          </h2>
          <div className="no-print flex items-center gap-2">
            {savedNotice && <span className="text-[11px] font-semibold text-success-700">Saved ✓</span>}
            <button
              type="button"
              disabled={saveNotesMutation.isPending}
              onClick={() => saveNotesMutation.mutate()}
              className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-brand-900 hover:bg-surface-3 transition cursor-pointer disabled:opacity-50"
            >
              <Save size={11} />
              <span>{saveNotesMutation.isPending ? "Saving…" : "Save Note"}</span>
            </button>
          </div>
        </div>
        <textarea
          rows={3}
          value={notesValue}
          onChange={(e) => {
            setNotesMonthKey(currentKey);
            setDraftNotes(e.target.value);
          }}
          placeholder="Add strategic notes, client context, campaign highlights, or next-month goals (included in PDF & shared client link)…"
          className="no-print w-full rounded-xl border border-brand-200 bg-surface-2/50 p-3 text-xs text-brand-900 placeholder:text-brand-400 focus:border-brand-400 focus:outline-none"
        />
        {notesValue.trim() && (
          <p className="hidden print:block whitespace-pre-wrap text-xs leading-relaxed text-brand-800">
            {notesValue}
          </p>
        )}
      </section>
    </div>
  );
}

export function MonthlyReportMissingPillars({
  snapshotData,
  activeTab,
}: {
  snapshotData: ReturnType<typeof useMonthlyReportSnapshotData>;
  activeTab: "ALL" | "TRAFFIC" | "AI" | "FIXES" | "AUDIT";
}) {
  const payload = snapshotData.activePayload;
  if (!payload) return null;

  const showKeywords = activeTab === "ALL" || activeTab === "TRAFFIC";
  const showBacklinks = activeTab === "ALL" || activeTab === "AUDIT";
  const showAccountabilityAndNext = activeTab === "ALL" || activeTab === "FIXES";

  return (
    <div className="space-y-6">
      {/* Top & Declining Search Keywords */}
      {showKeywords && ((payload.topKeywords?.length ?? 0) > 0 || (payload.decliningKeywords?.length ?? 0) > 0) && (
        <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Top &amp; Declining Search Keywords</h2>
              <p className="text-xs text-brand-500">Measured Search Console queries driving clicks and rankings to protect.</p>
            </div>
            <Link href="/organic-search" className="no-print text-xs font-semibold text-accent-700 hover:underline">
              Full Keyword Explorer →
            </Link>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-brand-200/70 overflow-hidden">
              <div className="bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand-600">
                Top Performing Queries
              </div>
              {payload.topKeywords && payload.topKeywords.length > 0 ? (
                <table className="report-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-brand-200 text-[10px] uppercase text-brand-400">
                      <th className="px-3 py-1.5">Query</th>
                      <th className="px-3 py-1.5 text-right">Clicks</th>
                      <th className="px-3 py-1.5 text-right">Pos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-200/60">
                    {payload.topKeywords.slice(0, 8).map((kw) => (
                      <tr key={kw.query}>
                        <td className="px-3 py-1.5 font-medium text-brand-950 truncate max-w-[200px]">{kw.query}</td>
                        <td className="px-3 py-1.5 text-right font-mono">{fmtNum(kw.clicks)}</td>
                        <td className="px-3 py-1.5 text-right font-mono">#{Number(kw.position).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-3 text-xs text-brand-400">No top keywords available.</p>
              )}
            </div>

            <div className="rounded-xl border border-brand-200/70 overflow-hidden">
              <div className="bg-surface-2 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-brand-600">
                Declining Queries to Defend
              </div>
              {payload.decliningKeywords && payload.decliningKeywords.length > 0 ? (
                <table className="report-table w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-brand-200 text-[10px] uppercase text-brand-400">
                      <th className="px-3 py-1.5">Query</th>
                      <th className="px-3 py-1.5 text-right">Prev</th>
                      <th className="px-3 py-1.5 text-right">Now</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-200/60">
                    {payload.decliningKeywords.slice(0, 8).map((kw) => (
                      <tr key={kw.query}>
                        <td className="px-3 py-1.5 font-medium text-brand-950 truncate max-w-[200px]">{kw.query}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-brand-500">
                          {kw.previousPosition != null ? `#${Number(kw.previousPosition).toFixed(1)}` : "—"}
                        </td>
                        <td className="px-3 py-1.5 text-right font-mono text-error-700 font-semibold">
                          #{Number(kw.position).toFixed(1)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="p-3 text-xs text-brand-400">No declining queries observed in the comparison period.</p>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Backlinks & Authority Pillar */}
      {showBacklinks && (
        <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-brand-950">Backlinks &amp; Authority Profile</h2>
              <p className="text-xs text-brand-500">Live-verified referring domains, link velocity, and lost links.</p>
            </div>
            <Link href="/reports/backlinks" className="no-print text-xs font-semibold text-accent-700 hover:underline">
              Full Backlinks Report →
            </Link>
          </div>

          {payload.backlinks ? (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-xl border border-brand-200/80 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-brand-500">Verified Links</p>
                  <p className="mt-1 font-mono text-lg font-bold text-brand-950">{fmtNum(payload.backlinks.totalVerified)}</p>
                </div>
                <div className="rounded-xl border border-brand-200/80 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-brand-500">Referring Domains</p>
                  <p className="mt-1 font-mono text-lg font-bold text-brand-950">{fmtNum(payload.backlinks.referringDomains)}</p>
                </div>
                <div className="rounded-xl border border-brand-200/80 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-brand-500">Checked Sources</p>
                  <p className="mt-1 font-mono text-lg font-bold text-brand-950">{fmtNum(payload.backlinks.newCount)}</p>
                </div>
                <div className="rounded-xl border border-brand-200/80 bg-surface-2/50 p-3">
                  <p className="text-[10px] font-semibold uppercase text-brand-500">Lost Links</p>
                  <p className="mt-1 font-mono text-lg font-bold text-error-700">{fmtNum(payload.backlinks.lostCount)}</p>
                </div>
              </div>
              {payload.backlinks.topSources.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-brand-200/70">
                  <table className="report-table w-full text-left text-xs">
                    <thead className="bg-surface-2 text-[10px] uppercase text-brand-500">
                      <tr>
                        <th className="px-3 py-2">Referring Domain</th>
                        <th className="px-3 py-2">Source URL</th>
                        <th className="px-3 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-200/60">
                      {payload.backlinks.topSources.slice(0, 6).map((s) => (
                        <tr key={s.url}>
                          <td className="px-3 py-1.5 font-semibold text-brand-950">{s.domain}</td>
                          <td className="px-3 py-1.5 font-mono text-[11px] text-brand-600 truncate max-w-[260px]">{s.url}</td>
                          <td className="px-3 py-1.5 font-mono text-[10.5px] text-brand-700">{s.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <p className="text-xs text-brand-500">
              No backlink sources recorded yet. Run Backlink Discovery in the Backlinks tab to include authority metrics here.
            </p>
          )}
        </section>
      )}

      {/* Fix Engine Accountability (Regressions & Rollbacks) + Next Month Top 5 ROI Priorities */}
      {showAccountabilityAndNext && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-3">
            <h2 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
              <RotateCcw size={14} className="text-brand-600" />
              <span>Regression Guard &amp; Rollback Log</span>
            </h2>
            {payload.accountabilityEvents && payload.accountabilityEvents.length > 0 ? (
              <ul className="space-y-2">
                {payload.accountabilityEvents.map((evt, idx) => (
                  <li
                    key={`${evt.eventType}-${idx}`}
                    className="rounded-xl border border-brand-200/70 bg-surface-2/50 p-3 text-xs space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-brand-950">{evt.title}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                          evt.eventType === "REGRESSION_DETECTED"
                            ? "bg-error-50 text-error-700 border border-error-200"
                            : "bg-warning-50 text-warning-700 border border-warning-200"
                        }`}
                      >
                        {evt.eventType === "REGRESSION_DETECTED" ? "Regression Caught" : "Rolled Back"}
                      </span>
                    </div>
                    {evt.affectedUrl && <p className="font-mono text-[10.5px] text-brand-500 truncate">{evt.affectedUrl}</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-success-200/60 bg-success-50/40 p-3 text-xs text-success-800">
                <CheckCircle2 size={14} className="text-success-600 shrink-0" />
                <span>Zero regressions or rollbacks recorded this month.</span>
              </div>
            )}
          </section>

          <section className="report-section rounded-2xl border border-brand-200/80 bg-surface-1 p-5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary-600" />
                <span>Next Month&apos;s Top 5 Priorities</span>
              </h2>
              <Link href="/fix-engine" className="no-print inline-flex items-center gap-1 text-xs font-semibold text-accent-700 hover:underline">
                <span>Fix Engine</span>
                <ArrowRight size={11} />
              </Link>
            </div>
            {payload.nextMonthPriorities && payload.nextMonthPriorities.length > 0 ? (
              <ul className="space-y-2">
                {payload.nextMonthPriorities.slice(0, 5).map((p, idx) => (
                  <li
                    key={`${p.title}-${idx}`}
                    className="rounded-xl border border-brand-200/70 bg-surface-2/40 px-3 py-2 text-xs flex items-start justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-brand-950">
                        {idx + 1}. {p.title}
                      </p>
                      {p.roiNote && <p className="text-[10.5px] text-success-700 mt-0.5">{p.roiNote}</p>}
                    </div>
                    <span className="shrink-0 rounded-md border border-brand-200 bg-surface-1 px-1.5 py-0.5 font-mono text-[10px] font-bold text-brand-700">
                      {p.potential}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-brand-400">No open priorities queued in Fix Engine.</p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
