"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Eye,
  Globe,
  Loader2,
  Play,
  SlidersHorizontal,
  Square,
  XOctagon,
} from "lucide-react";
import { Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminCrawlDetail,
  AdminCrawlRun,
  AdminWebsiteItem,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  FilterChipGroup,
  NocButton,
  NocPanel,
  SlideOverDialog,
  formatDurationSec,
} from "./admin-primitives";

interface CrawlerEngineSectionProps {
  websites: AdminWebsiteItem[];
  crawls: AdminCrawlRun[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

type CrawlTab = "websites" | "jobs";
type SiteFilter = "all" | "own" | "competitor" | "verified" | "unverified";

export function CrawlerEngineSection({
  websites,
  crawls,
  loading,
  onRefresh,
}: CrawlerEngineSectionProps) {
  const [tab, setTab] = useState<CrawlTab>("websites");
  const [siteFilter, setSiteFilter] = useState<SiteFilter>("all");
  const [siteSearch, setSiteSearch] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [jobStatusFilter, setJobStatusFilter] = useState<"all" | "active" | "failed" | "completed">("all");
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);

  // Active drawers/modals
  const [launchSite, setLaunchSite] = useState<AdminWebsiteItem | null>(null);
  const [configSite, setConfigSite] = useState<AdminWebsiteItem | null>(null);
  const [inspectCrawlId, setInspectCrawlId] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<{ job: AdminCrawlRun; mode: "cancel" | "force-fail" } | null>(null);
  const [killBusy, setKillBusy] = useState(false);

  const filteredWebsites = useMemo(() => {
    const q = siteSearch.trim().toLowerCase();
    return websites.filter((w) => {
      const isComp = w.scope.startsWith("competitor:");
      if (siteFilter === "own" && isComp) return false;
      if (siteFilter === "competitor" && !isComp) return false;
      if (siteFilter === "verified" && !w.isVerified) return false;
      if (siteFilter === "unverified" && w.isVerified) return false;
      if (!q) return true;
      return (
        w.domain.toLowerCase().includes(q) ||
        (w.organizationName && w.organizationName.toLowerCase().includes(q)) ||
        (w.projectName && w.projectName.toLowerCase().includes(q))
      );
    });
  }, [websites, siteFilter, siteSearch]);

  const filteredCrawls = useMemo(() => {
    const q = jobSearch.trim().toLowerCase();
    return crawls.filter((c) => {
      if (jobStatusFilter === "active" && !["PENDING", "RUNNING"].includes(c.status)) return false;
      if (jobStatusFilter === "failed" && c.status !== "FAILED") return false;
      if (jobStatusFilter === "completed" && c.status !== "COMPLETED") return false;
      if (!q) return true;
      return (
        c.domain.toLowerCase().includes(q) ||
        c.id.toLowerCase().includes(q) ||
        (c.organizationName && c.organizationName.toLowerCase().includes(q)) ||
        (c.errorMessage && c.errorMessage.toLowerCase().includes(q))
      );
    });
  }, [crawls, jobStatusFilter, jobSearch]);

  const runningCount = crawls.filter((c) => ["PENDING", "RUNNING"].includes(c.status)).length;
  const failedCount = crawls.filter((c) => c.status === "FAILED").length;

  async function executeKill() {
    if (!killTarget) return;
    setKillBusy(true);
    setFeedback(null);
    try {
      if (killTarget.mode === "cancel") {
        await api.cancelAdminCrawl(killTarget.job.id);
        setFeedback({ tone: "warn", text: `Cancelled crawl ${killTarget.job.id.slice(0, 8)} (${killTarget.job.domain}).` });
      } else {
        await api.forceFailAdminCrawl(killTarget.job.id, "Force-terminated from Root NOC.");
        setFeedback({ tone: "warn", text: `Force-failed stuck crawl ${killTarget.job.id.slice(0, 8)} and released Redis tasks.` });
      }
      setKillTarget(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setKillBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <FilterChipGroup<CrawlTab>
          value={tab}
          onChange={setTab}
          options={[
            { id: "websites", label: "WEBSITE_REGISTRY", count: websites.length },
            {
              id: "jobs",
              label: "CRAWL_JOBS_CONTROL",
              count: crawls.length,
              dot: runningCount > 0 ? "good" : failedCount > 0 ? "bad" : undefined,
            },
          ]}
        />
        <div className="font-mono text-[11px] text-brand-400">
          IN_FLIGHT: <strong className="text-signal-400">{runningCount}</strong> · FAILED:{" "}
          <strong className={failedCount > 0 ? "text-error-700" : "text-brand-400"}>{failedCount}</strong>
        </div>
      </div>

      {tab === "websites" && (
        <NocPanel
          code="WEB"
          title="REGISTERED_WEBSITES_AND_CRAWL_OVERRIDES"
          subtitle="Direct operator control over domain verification, crawl schedule, concurrency/depth/politeness, and force-triggered audits."
          actions={
            <>
              <FilterChipGroup<SiteFilter>
                value={siteFilter}
                onChange={setSiteFilter}
                options={[
                  { id: "all", label: "ALL", count: websites.length },
                  { id: "own", label: "OWN" },
                  { id: "competitor", label: "COMPETITOR" },
                  { id: "verified", label: "VERIFIED" },
                  { id: "unverified", label: "UNVERIFIED" },
                ]}
              />
              <AdminSearchInput value={siteSearch} onChange={setSiteSearch} placeholder="Filter domain / org…" />
            </>
          }
        >
          {loading && websites.length === 0 ? (
            <AdminSkeletonRows rows={6} cols={7} />
          ) : (
            <AdminTableWrap label="Registered websites" minWidth={980}>
              <AdminThead>
                <tr>
                  <Th>Domain & Scope</Th>
                  <Th>Tenant / Project</Th>
                  <Th>Verify</Th>
                  <Th>Engine Params</Th>
                  <Th>Latest Audit</Th>
                  <Th align="right">Controls</Th>
                </tr>
              </AdminThead>
              <tbody>
                {filteredWebsites.length > 0 ? (
                  filteredWebsites.map((w) => {
                    const isComp = w.scope.startsWith("competitor:");
                    const latest = w.latestCrawl;
                    return (
                      <Tr key={w.id}>
                        <Td>
                          <div className="flex items-center gap-2">
                            <Globe size={13} className="shrink-0 text-signal-400" />
                            <div className="min-w-0">
                              <span className="block truncate font-mono text-[12px] font-bold text-brand-950">
                                {w.domain}
                              </span>
                              <span className="font-mono text-[10px] text-brand-400">
                                {isComp ? "COMPETITOR" : "OWN"} · {w.totalCrawls} runs · {w.crawlFrequency}
                              </span>
                            </div>
                          </div>
                        </Td>
                        <Td>
                          <span className="block text-[12px] font-semibold text-brand-900">
                            {w.organizationName ?? "—"}
                          </span>
                          <span className="block font-mono text-[10.5px] text-brand-400">
                            {w.projectName ?? "Unscoped"}
                          </span>
                        </Td>
                        <Td>
                          {w.isVerified ? (
                            <Pill tone="good">
                              <CheckCircle2 size={10} /> VERIFIED
                            </Pill>
                          ) : (
                            <Pill tone="warn">UNVERIFIED</Pill>
                          )}
                        </Td>
                        <Td>
                          <span className="font-mono text-[11px] text-brand-600 tabular-nums">
                            C:{w.maxConcurrency} · D:{w.maxDepth} · {w.rateLimitDelayMs}ms
                          </span>
                        </Td>
                        <Td>
                          {latest ? (
                            <div className="flex items-center gap-2 font-mono text-[11px]">
                              <Pill
                                tone={
                                  latest.status === "COMPLETED"
                                    ? "good"
                                    : latest.status === "FAILED"
                                      ? "bad"
                                      : latest.status === "RUNNING"
                                        ? "info"
                                        : "warn"
                                }
                                dot={latest.status === "RUNNING"}
                              >
                                {latest.status}
                              </Pill>
                              <span className="text-brand-600 tabular-nums">
                                {latest.pagesCrawled}p · {latest.healthScore != null ? `${latest.healthScore}/100` : "—"}
                              </span>
                              <button
                                type="button"
                                onClick={() => setInspectCrawlId(latest.id)}
                                className="text-signal-400 underline hover:text-brand-950 cursor-pointer"
                              >
                                inspect
                              </button>
                            </div>
                          ) : (
                            <span className="font-mono text-[11px] text-brand-400">NEVER_CRAWLED</span>
                          )}
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1.5">
                            <NocButton
                              variant="primary"
                              icon={<Play size={11} />}
                              onClick={() => setLaunchSite(w)}
                            >
                              RUN_AUDIT
                            </NocButton>
                            <NocButton
                              variant="secondary"
                              icon={<SlidersHorizontal size={11} />}
                              onClick={() => setConfigSite(w)}
                            >
                              CONFIG
                            </NocButton>
                          </div>
                        </Td>
                      </Tr>
                    );
                  })
                ) : (
                  <Tr>
                    <Td colSpan={6} className="py-10 text-center font-mono text-[12px] text-brand-400">
                      NO_WEBSITES_MATCH_FILTER
                    </Td>
                  </Tr>
                )}
              </tbody>
            </AdminTableWrap>
          )}
        </NocPanel>
      )}

      {tab === "jobs" && (
        <NocPanel
          code="JOB"
          title="CROSS_TENANT_CRAWL_JOBS"
          subtitle="Inspect live frontier/HTTP diagnostics, cancel active crawls, or force-close zombie runs."
          actions={
            <>
              <FilterChipGroup<"all" | "active" | "failed" | "completed">
                value={jobStatusFilter}
                onChange={setJobStatusFilter}
                options={[
                  { id: "all", label: "ALL", count: crawls.length },
                  { id: "active", label: "IN_FLIGHT", count: runningCount, dot: runningCount > 0 ? "good" : undefined },
                  { id: "failed", label: "FAILED", count: failedCount, dot: failedCount > 0 ? "bad" : undefined },
                  { id: "completed", label: "COMPLETED" },
                ]}
              />
              <AdminSearchInput value={jobSearch} onChange={setJobSearch} placeholder="Filter domain, ID, error…" />
            </>
          }
        >
          <AdminTableWrap label="Crawl jobs control" minWidth={980}>
            <AdminThead>
              <tr>
                <Th>Job / Domain</Th>
                <Th>Status</Th>
                <Th align="right">Pages</Th>
                <Th align="right">Issues</Th>
                <Th align="right">Score</Th>
                <Th align="right">Duration</Th>
                <Th align="right">Actions</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filteredCrawls.length > 0 ? (
                filteredCrawls.map((c) => {
                  const isInFlight = c.status === "PENDING" || c.status === "RUNNING";
                  return (
                    <Tr key={c.id}>
                      <Td>
                        <div className="max-w-[300px]">
                          <div className="flex items-center gap-2 font-mono text-[12px] font-bold text-brand-950">
                            <span className="truncate">{c.domain}</span>
                            <span className="text-[10px] font-normal text-brand-400">{c.id.slice(0, 8)}</span>
                          </div>
                          <span className="block truncate font-mono text-[10.5px] text-brand-400">
                            {c.organizationName ?? "Unscoped"} · {relativeTime(c.startedAt ?? c.createdAt)}
                          </span>
                          {c.errorMessage && (
                            <p className="mt-0.5 truncate font-mono text-[10.5px] text-error-700" title={c.errorMessage}>
                              ERR: {c.errorMessage}
                            </p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            c.status === "COMPLETED"
                              ? "good"
                              : c.status === "FAILED"
                                ? "bad"
                                : c.status === "RUNNING"
                                  ? "info"
                                  : "warn"
                          }
                          dot={isInFlight}
                        >
                          {c.status}
                        </Pill>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] text-brand-950 tabular-nums">
                          {c.pagesCrawled}
                          {c.pagesDiscovered > 0 ? <span className="text-brand-400">/{c.pagesDiscovered}</span> : null}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] text-brand-600 tabular-nums">{c.issuesFound}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] font-bold text-brand-950 tabular-nums">
                          {c.healthScore != null ? `${c.healthScore}/100` : "—"}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[11.5px] text-brand-400 tabular-nums">
                          {formatDurationSec(c.durationSec)}
                        </span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          <NocButton
                            variant="secondary"
                            icon={<Eye size={11} />}
                            onClick={() => setInspectCrawlId(c.id)}
                          >
                            INSPECT
                          </NocButton>
                          {isInFlight && (
                            <>
                              <NocButton
                                variant="warn"
                                icon={<Square size={10} />}
                                onClick={() => setKillTarget({ job: c, mode: "cancel" })}
                              >
                                CANCEL
                              </NocButton>
                              <NocButton
                                variant="danger"
                                icon={<XOctagon size={11} />}
                                onClick={() => setKillTarget({ job: c, mode: "force-fail" })}
                              >
                                FORCE_FAIL
                              </NocButton>
                            </>
                          )}
                        </div>
                      </Td>
                    </Tr>
                  );
                })
              ) : (
                <Tr>
                  <Td colSpan={7} className="py-10 text-center font-mono text-[12px] text-brand-400">
                    NO_CRAWL_JOBS_MATCH_FILTER
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </NocPanel>
      )}

      {launchSite && (
        <LaunchCrawlDrawer
          key={launchSite.id}
          site={launchSite}
          onClose={() => setLaunchSite(null)}
          onStarted={async (msg) => {
            setLaunchSite(null);
            setFeedback({ tone: "good", text: msg });
            setTab("jobs");
            await onRefresh();
          }}
        />
      )}

      {configSite && (
        <WebsiteConfigDrawer
          key={configSite.id}
          site={configSite}
          onClose={() => setConfigSite(null)}
          onSaved={async (msg) => {
            setConfigSite(null);
            setFeedback({ tone: "good", text: msg });
            await onRefresh();
          }}
        />
      )}

      {inspectCrawlId && (
        <CrawlDiagnosticsDrawer
          key={inspectCrawlId}
          jobId={inspectCrawlId}
          onClose={() => setInspectCrawlId(null)}
        />
      )}

      <ConfirmModal
        open={Boolean(killTarget)}
        title={killTarget?.mode === "cancel" ? "CANCEL_CRAWL_JOB" : "FORCE_FAIL_ZOMBIE_CRAWL"}
        description={
          killTarget?.mode === "cancel"
            ? `Cancel in-flight crawl ${killTarget.job.id} for ${killTarget.job.domain} and flush its Redis pending counters?`
            : `Force-mark crawl ${killTarget?.job.id} (${killTarget?.job.domain}) as FAILED and clear Redis pending task tracking?`
        }
        confirmLabel={killTarget?.mode === "cancel" ? "CANCEL_CRAWL" : "FORCE_FAIL"}
        tone={killTarget?.mode === "cancel" ? "warn" : "danger"}
        busy={killBusy}
        onConfirm={executeKill}
        onClose={() => setKillTarget(null)}
      />
    </div>
  );
}

function LaunchCrawlDrawer({
  site,
  onClose,
  onStarted,
}: {
  site: AdminWebsiteItem;
  onClose: () => void;
  onStarted: (message: string) => Promise<void>;
}) {
  const [concurrency, setConcurrency] = useState(String(site.maxConcurrency));
  const [depth, setDepth] = useState(String(site.maxDepth));
  const [pageLimit, setPageLimit] = useState("");
  const [delayMs, setDelayMs] = useState(String(site.rateLimitDelayMs));
  const [renderBudget, setRenderBudget] = useState("");
  const [useSitemap, setUseSitemap] = useState(true);
  const [forceVerify, setForceVerify] = useState(!site.isVerified);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.triggerAdminWebsiteCrawl(site.id, {
        maxConcurrency: concurrency.trim() ? Number(concurrency) : undefined,
        maxDepth: depth.trim() ? Number(depth) : undefined,
        pageLimit: pageLimit.trim() ? Number(pageLimit) : undefined,
        rateLimitDelayMs: delayMs.trim() ? Number(delayMs) : undefined,
        renderBudget: renderBudget.trim() ? Number(renderBudget) : undefined,
        useSitemap,
        forceVerify,
      });
      await onStarted(`Dispatched crawl job ${res.jobId} for ${res.domain}.`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <SlideOverDialog
      open
      title={`LAUNCH_AUDIT // ${site.domain}`}
      subtitle={`Website ID: ${site.id} · Org: ${site.organizationName ?? "Unscoped"}`}
      onClose={onClose}
      widthClass="w-[min(560px,100vw)]"
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <StatusNote tone="bad">{error}</StatusNote>}
        <div className="grid grid-cols-2 gap-3">
          <NumField label="MAX_CONCURRENCY (1-25)" value={concurrency} onChange={setConcurrency} />
          <NumField label="MAX_DEPTH (1-20)" value={depth} onChange={setDepth} />
          <NumField label="PAGE_LIMIT (blank = default)" value={pageLimit} onChange={setPageLimit} placeholder="e.g. 250" />
          <NumField label="RATE_LIMIT_DELAY_MS" value={delayMs} onChange={setDelayMs} />
          <NumField label="RENDER_BUDGET (headless)" value={renderBudget} onChange={setRenderBudget} placeholder="e.g. 25" />
        </div>

        <label className="flex items-center justify-between rounded-sm border border-brand-200 bg-surface-2 px-3 py-2.5 cursor-pointer">
          <span className="font-mono text-[11.5px] text-brand-900">USE_SITEMAP_DISCOVERY</span>
          <input type="checkbox" checked={useSitemap} onChange={(e) => setUseSitemap(e.target.checked)} />
        </label>

        {!site.isVerified && (
          <label className="flex items-center justify-between rounded-sm border border-warning-200 bg-warning-50 px-3 py-2.5 cursor-pointer">
            <div>
              <span className="block font-mono text-[11.5px] font-bold text-warning-700">FORCE_VERIFY_DOMAIN</span>
              <span className="block text-[11px] text-brand-500">
                Own-site crawls require verification; check this to verify the website before dispatch.
              </span>
            </div>
            <input type="checkbox" checked={forceVerify} onChange={(e) => setForceVerify(e.target.checked)} />
          </label>
        )}

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-200">
          <NocButton type="button" onClick={onClose}>
            CANCEL
          </NocButton>
          <NocButton type="submit" variant="primary" disabled={busy} icon={<Play size={11} />}>
            {busy ? "DISPATCHING…" : "DISPATCH_CRAWL_JOB"}
          </NocButton>
        </div>
      </form>
    </SlideOverDialog>
  );
}

function WebsiteConfigDrawer({
  site,
  onClose,
  onSaved,
}: {
  site: AdminWebsiteItem;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const [isVerified, setIsVerified] = useState(site.isVerified);
  const [crawlFrequency, setCrawlFrequency] = useState(site.crawlFrequency);
  const [maxConcurrency, setMaxConcurrency] = useState(String(site.maxConcurrency));
  const [maxDepth, setMaxDepth] = useState(String(site.maxDepth));
  const [rateLimitDelayMs, setRateLimitDelayMs] = useState(String(site.rateLimitDelayMs));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.updateAdminWebsite(site.id, {
        isVerified,
        crawlFrequency,
        maxConcurrency: Number(maxConcurrency),
        maxDepth: Number(maxDepth),
        rateLimitDelayMs: Number(rateLimitDelayMs),
      });
      await onSaved(`Updated crawl engine configuration for ${site.domain}.`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <SlideOverDialog
      open
      title={`ENGINE_CONFIG // ${site.domain}`}
      subtitle={`Persists directly to Postgres Website table + AuditLog`}
      onClose={onClose}
      widthClass="w-[min(520px,100vw)]"
    >
      <form onSubmit={save} className="space-y-4">
        {error && <StatusNote tone="bad">{error}</StatusNote>}

        <label className="flex items-center justify-between rounded-sm border border-brand-200 bg-surface-2 px-3 py-2.5 cursor-pointer">
          <div>
            <span className="block font-mono text-[11.5px] font-bold text-brand-950">DOMAIN_VERIFIED</span>
            <span className="block text-[11px] text-brand-400">Toggle domain ownership verification flag.</span>
          </div>
          <input type="checkbox" checked={isVerified} onChange={(e) => setIsVerified(e.target.checked)} />
        </label>

        <label className="block space-y-1">
          <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
            CRAWL_FREQUENCY
          </span>
          <select
            value={crawlFrequency}
            onChange={(e) => setCrawlFrequency(e.target.value as AdminWebsiteItem["crawlFrequency"])}
            className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-3 font-mono text-[12px] text-brand-950 focus:border-signal-400 focus:outline-none"
          >
            <option value="OFF">OFF</option>
            <option value="DAILY">DAILY</option>
            <option value="WEEKLY">WEEKLY</option>
            <option value="MONTHLY">MONTHLY</option>
          </select>
        </label>

        <div className="grid grid-cols-3 gap-3">
          <NumField label="CONCURRENCY" value={maxConcurrency} onChange={setMaxConcurrency} />
          <NumField label="MAX_DEPTH" value={maxDepth} onChange={setMaxDepth} />
          <NumField label="DELAY_MS" value={rateLimitDelayMs} onChange={setRateLimitDelayMs} />
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-brand-200">
          <NocButton type="button" onClick={onClose}>
            CANCEL
          </NocButton>
          <NocButton type="submit" variant="primary" disabled={busy}>
            {busy ? "SAVING…" : "COMMIT_CONFIG"}
          </NocButton>
        </div>
      </form>
    </SlideOverDialog>
  );
}

function CrawlDiagnosticsDrawer({ jobId, onClose }: { jobId: string; onClose: () => void }) {
  const [detail, setDetail] = useState<AdminCrawlDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const res = await api.getAdminCrawlDetail(jobId);
        if (active) setDetail(res);
      } catch (e) {
        if (active) setErr(errorMessage(e));
      } finally {
        if (active) setLoading(false);
      }
    }, 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [jobId]);

  return (
    <SlideOverDialog
      open
      title={detail ? `CRAWL_DIAGNOSTICS // ${detail.domain}` : `CRAWL_DIAGNOSTICS // ${jobId.slice(0, 8)}`}
      subtitle={detail ? `Job ${detail.id} · ${detail.organizationName ?? "Unscoped"} · Redis pending: ${detail.redisPendingTasks}` : "Loading frontier & page telemetry…"}
      headerAside={detail ? <Pill tone={detail.status === "COMPLETED" ? "good" : detail.status === "FAILED" ? "bad" : "info"}>{detail.status}</Pill> : null}
      onClose={onClose}
      widthClass="w-[min(820px,100vw)]"
    >
      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 font-mono text-[12px] text-brand-400">
          <Loader2 size={15} className="animate-spin text-signal-400" />
          QUERYING_FRONTIER_AND_PAGES…
        </div>
      ) : err ? (
        <StatusNote tone="bad">{err}</StatusNote>
      ) : detail ? (
        <div className="space-y-4">
          {detail.errorMessage && <StatusNote tone="bad">ERROR: {detail.errorMessage}</StatusNote>}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 font-mono">
            <MiniBox label="PAGES" value={`${detail.pagesCrawled} / ${detail.pagesDiscovered}`} />
            <MiniBox label="ISSUES" value={`${detail.issuesFound} (${detail.uniqueIssuesCount} uniq)`} />
            <MiniBox label="HEALTH_SCORE" value={detail.healthScore != null ? `${detail.healthScore}/100` : "—"} />
            <MiniBox label="LIMITS" value={`C:${detail.concurrency} D:${detail.depthLimit} P:${detail.pageLimit ?? "∞"}`} />
          </div>

          {/* Frontier & HTTP Status Codes */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-sm border border-brand-200 bg-surface-2/60 p-3 space-y-2">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-signal-400">
                FRONTIER_STATE_BUCKETS
              </span>
              {Object.keys(detail.frontierByStatus).length === 0 ? (
                <p className="font-mono text-[11px] text-brand-400">No frontier rows (pruned or pre-v2).</p>
              ) : (
                <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px]">
                  {Object.entries(detail.frontierByStatus).map(([k, v]) => (
                    <div key={k} className="flex justify-between rounded-xs bg-surface-1 px-2 py-1 border border-brand-200">
                      <span className="text-brand-400">{k}</span>
                      <strong className="text-brand-950">{v}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-sm border border-brand-200 bg-surface-2/60 p-3 space-y-2">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-signal-400">
                HTTP_STATUS_HISTOGRAM
              </span>
              {detail.pagesByStatusCode.length === 0 ? (
                <p className="font-mono text-[11px] text-brand-400">No crawled pages stored.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                  {detail.pagesByStatusCode.map((row) => (
                    <Pill
                      key={row.statusCode}
                      tone={row.statusCode >= 400 || row.statusCode === 0 ? "bad" : row.statusCode >= 300 ? "warn" : "good"}
                    >
                      HTTP {row.statusCode}: {row.count}
                    </Pill>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Problem pages */}
          {detail.problemPages.length > 0 && (
            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-error-700">
                ERROR_AND_4XX_5XX_PAGES ({detail.problemPages.length})
              </span>
              <div className="divide-y divide-brand-200/70 rounded-sm border border-brand-200 bg-surface-2/40 max-h-[200px] overflow-y-auto font-mono text-[11px]">
                {detail.problemPages.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5">
                    <span className="truncate text-brand-900" title={p.url}>
                      {p.url}
                    </span>
                    <span className="shrink-0 flex items-center gap-2">
                      <Pill tone="bad">HTTP {p.statusCode}</Pill>
                      {p.loadTimeMs != null && <span className="text-brand-400">{p.loadTimeMs}ms</span>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Quality Diagnostics JSON */}
          {detail.qualityDiagnostics && (
            <div className="space-y-1.5">
              <span className="block font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">
                RAW_QUALITY_DIAGNOSTICS_JSON
              </span>
              <pre className="max-h-[240px] overflow-auto rounded-sm border border-brand-200 bg-surface-2 p-3 font-mono text-[11px] text-brand-700">
                {JSON.stringify(detail.qualityDiagnostics, null, 2)}
              </pre>
            </div>
          )}
        </div>
      ) : null}
    </SlideOverDialog>
  );
}

function MiniBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-brand-200 bg-surface-2 px-3 py-2">
      <span className="block text-[9.5px] text-brand-400">{label}</span>
      <span className="block mt-0.5 text-[13px] font-bold text-brand-950 tabular-nums">{value}</span>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-1">
      <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-brand-400">{label}</span>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-9 w-full rounded-sm border border-brand-200 bg-surface-2 px-2.5 font-mono text-[12px] text-brand-950 placeholder:text-brand-400 focus:border-signal-400 focus:outline-none"
      />
    </label>
  );
}
