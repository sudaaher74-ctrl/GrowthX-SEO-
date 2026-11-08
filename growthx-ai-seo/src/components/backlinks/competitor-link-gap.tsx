"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ActionButton,
  Kpi,
  Panel,
  Pill,
  StatusNote,
  Table,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import type { CompetitorLinkGapItem } from "@/lib/backlink-intelligence";
import type { EnrichedRecommendationReport, PublisherOutreachState } from "@/lib/backlink-recommendations";
import { errorMessage } from "@/lib/error-message";

const fmtNumber = (val: number | null | undefined) =>
  val == null ? "—" : new Intl.NumberFormat().format(val);

function ExternalUrlLink({ url, label }: { url: string; label?: string }) {
  if (!/^https?:\/\//i.test(url)) return <span>{label || url}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 break-all text-primary-700 hover:underline"
    >
      <span>{label || url}</span>
      <svg className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
        />
      </svg>
    </a>
  );
}

export function CompetitorLinkGap({
  projectId,
  onOpenOpportunities,
}: {
  projectId: string;
  onOpenOpportunities?: () => void;
}) {
  const queryClient = useQueryClient();
  const [competitorFilter, setCompetitorFilter] = useState<string>("ALL");
  const [overlapOnly, setOverlapOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [activeAnalysis, setActiveAnalysis] = useState<{
    sourceId: string;
    sourceUrl: string;
    domain: string;
    report: EnrichedRecommendationReport;
  } | null>(null);

  const gapQuery = useQuery({
    queryKey: ["backlink-link-gap", projectId],
    queryFn: () => api.backlinks.linkGap(projectId),
  });

  const syncMutation = useMutation({
    mutationFn: (compDomain?: string) => api.backlinks.syncLinkGap(projectId, compDomain),
    onSuccess: async (res) => {
      queryClient.setQueryData(["backlink-link-gap", projectId], res);
      setNotice(
        res.warning ||
          `Synced competitor link gap across ${res.trackedCompetitors.length} tracked competitor(s). Found ${res.totalGapDomains} link gap domains.`,
      );
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["backlinks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["backlink-recommendations", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["backlink-recommendation-stats", projectId] }),
      ]);
    },
  });

  const analyzeSourceMutation = useMutation({
    mutationFn: async (item: CompetitorLinkGapItem) => {
      const sourceUrl =
        item.sampleSourceUrl || `https://${item.referringDomain}/`;
      const targetUrl =
        item.sampleTargetUrl ||
        (item.competitorsLinked[0]?.competitorDomain
          ? `https://${item.competitorsLinked[0].competitorDomain}/`
          : undefined);
      const res = await api.backlinks.importAndAnalyzeGapSource(projectId, {
        sourceUrl,
        targetUrl,
      });
      return { item, res, sourceUrl };
    },
    onSuccess: async ({ item, res, sourceUrl }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["backlink-link-gap", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["backlink-recommendations", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["backlink-recommendation-stats", projectId] }),
      ]);
      if (res.state === "UNAVAILABLE" || !res.analysis) {
        setNotice(
          res.reason ||
            `Imported ${sourceUrl} into monitored sources. Live HTML check will retry automatically.`,
        );
        return;
      }
      setNotice(`Analyzed ${item.referringDomain} live HTML and generated outreach pitch draft.`);
      setActiveAnalysis({
        sourceId: res.sourceId,
        sourceUrl,
        domain: item.referringDomain,
        report: res.analysis,
      });
    },
  });

  const data = gapQuery.data;

  const filteredItems = useMemo(() => {
    if (!data?.items) return [];
    return data.items.filter((item) => {
      if (overlapOnly && item.competitorOverlapCount < 2) return false;
      if (
        competitorFilter !== "ALL" &&
        !item.competitorsLinked.some((c) => c.competitorDomain === competitorFilter)
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchDomain = item.referringDomain.toLowerCase().includes(q);
        const matchUrl = (item.sampleSourceUrl || "").toLowerCase().includes(q);
        const matchComp = item.competitorsLinked.some((c) =>
          c.competitorDomain.toLowerCase().includes(q),
        );
        if (!matchDomain && !matchUrl && !matchComp) return false;
      }
      return true;
    });
  }, [data?.items, overlapOnly, competitorFilter, search]);

  return (
    <div className="space-y-5">
      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          label="Link Gap Domains"
          value={data ? fmtNumber(data.totalGapDomains) : "—"}
          sub={
            data?.ownDomain
              ? `Link to competitors, 0 links to ${data.ownDomain}`
              : "Domains linking to competitors only"
          }
        />
        <Kpi
          label="Multi-Competitor Overlap"
          value={data ? fmtNumber(data.multiCompetitorOverlapCount) : "—"}
          sub="Publishers linking to 2+ competitors"
        />
        <Kpi
          label="Reigel-Verified Sources"
          value={data ? fmtNumber(data.verifiedGapSourcesCount) : "—"}
          sub="Confirmed on live HTML by Reigel"
        />
        <Kpi
          label="Your Referring Domains"
          value={data ? fmtNumber(data.ownReferringDomainsCount) : "—"}
          sub="Excluded from Link Gap intersect"
        />
      </div>

      {notice && (
        <div role="status">
          <StatusNote>{notice}</StatusNote>
        </div>
      )}
      { data?.warning && !notice ? (
        <StatusNote tone="warn">{data.warning}</StatusNote>
      ) : null}
      {syncMutation.error ? (
        <StatusNote tone="bad">{errorMessage(syncMutation.error)}</StatusNote>
      ) : null}
      {analyzeSourceMutation.error ? (
        <StatusNote tone="bad">{errorMessage(analyzeSourceMutation.error)}</StatusNote>
      ) : null}

      {/* Competitor Coverage & Filter Bar */}
      <Panel
        title="Competitor Backlink Intersect (Link Gap Finder)"
        subtitle="Finds third-party websites that link to your tracked competitors but do not yet link to your website — combining DataForSEO snapshots, Reigel crawl evidence, and the public archive index."
        actions={
          <div className="flex flex-wrap gap-2">
            {onOpenOpportunities && (
              <ActionButton onClick={onOpenOpportunities}>
                Open Outreach Opportunities
              </ActionButton>
            )}
            <ActionButton
              variant="primary"
              disabled={syncMutation.isPending}
              onClick={() =>
                syncMutation.mutate(
                  competitorFilter !== "ALL" ? competitorFilter : undefined,
                )
              }
            >
              {syncMutation.isPending
                ? "Syncing Competitor Backlinks…"
                : competitorFilter !== "ALL"
                  ? `Sync ${competitorFilter} Backlinks`
                  : "Sync Competitor Link Gap"}
            </ActionButton>
          </div>
        }
        padded
      >
        <div className="space-y-4">
          {/* Competitor Pills */}
          {data?.trackedCompetitors && data.trackedCompetitors.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-brand-600">
                Filter by Competitor:
              </span>
              <button
                type="button"
                onClick={() => setCompetitorFilter("ALL")}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                  competitorFilter === "ALL"
                    ? "bg-brand-900 text-white"
                    : "bg-brand-100 text-brand-700 hover:bg-brand-200"
                }`}
              >
                All Competitors ({data.trackedCompetitors.length})
              </button>
              {data.trackedCompetitors.map((comp) => (
                <button
                  key={comp.domain}
                  type="button"
                  onClick={() => setCompetitorFilter(comp.domain)}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                    competitorFilter === comp.domain
                      ? "bg-brand-900 text-white"
                      : "bg-brand-100 text-brand-700 hover:bg-brand-200"
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      comp.referringDomainsCount > 0
                        ? "bg-good-500"
                        : "bg-brand-400"
                    }`}
                  />
                  <span>{comp.domain}</span>
                  <span className="opacity-75">
                    ({fmtNumber(comp.referringDomainsCount)})
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <StatusNote tone="warn">
              No tracked competitors found for this project yet. Add competitors in{" "}
              <a
                href="/competitors"
                className="font-semibold text-primary-700 underline"
              >
                Competitor Intelligence
              </a>{" "}
              to compare backlink profiles.
            </StatusNote>
          )}

          {/* Search & Multi-competitor toggle */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search referring domain, article URL, or competitor…"
                className="w-72 rounded-lg border border-brand-200 bg-surface-2 px-3 py-1.5 text-xs text-brand-900 outline-none focus:border-primary-600"
              />
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-brand-700">
                <input
                  type="checkbox"
                  checked={overlapOnly}
                  onChange={(e) => setOverlapOnly(e.target.checked)}
                />
                <span>Only show domains linking to 2+ competitors</span>
              </label>
            </div>
            <span className="text-xs text-brand-500">
              Showing {filteredItems.length} of {data?.totalGapDomains ?? 0} gap domains
            </span>
          </div>
        </div>
      </Panel>

      {/* Link Gap Table */}
      <Panel
        title="Link Gap Publishers & Referring Pages"
        subtitle="Sorted by competitor overlap count, Reigel HTML verification status, and domain rank."
      >
        <QueryState
          isLoading={gapQuery.isLoading}
          error={gapQuery.error}
          isEmpty={!gapQuery.isLoading && filteredItems.length === 0}
          emptyTitle="No competitor link gap domains found yet"
          emptyBody="Click 'Sync Competitor Link Gap' above to pull competitor backlinks from DataForSEO, completed website/competitor crawls, and the public archive index."
          emptyAction={
            <ActionButton
              variant="primary"
              disabled={syncMutation.isPending}
              onClick={() => syncMutation.mutate(undefined)}
            >
              {syncMutation.isPending ? "Syncing…" : "Sync Competitor Link Gap"}
            </ActionButton>
          }
        >
          <Table>
            <thead>
              <tr>
                <Th>Referring Domain &amp; Sample Page</Th>
                <Th>Competitors Linked</Th>
                <Th>Domain Rank</Th>
                <Th>Evidence Source</Th>
                <Th>1-Click Action</Th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const isAnalyzingThis =
                  analyzeSourceMutation.isPending &&
                  analyzeSourceMutation.variables?.referringDomain ===
                    item.referringDomain;
                const isVerified = item.competitorsLinked.some(
                  (c) => c.verifiedByReigel,
                );

                return (
                  <Tr key={item.referringDomain}>
                    <Td className="max-w-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-brand-950">
                          {item.referringDomain}
                        </span>
                        {item.competitorOverlapCount >= 2 && (
                          <Pill tone="good">
                            {item.competitorOverlapCount} competitors
                          </Pill>
                        )}
                      </div>
                      {item.sampleSourceUrl ? (
                        <div className="mt-1 text-xs">
                          <ExternalUrlLink url={item.sampleSourceUrl} />
                        </div>
                      ) : (
                        <p className="mt-1 text-xs text-brand-400">
                          Domain-level index record (`https://{item.referringDomain}`)
                        </p>
                      )}
                      {item.competitorsLinked[0]?.sampleAnchor ? (
                        <p className="mt-1 text-[11px] text-brand-500">
                          Anchor: “{item.competitorsLinked[0].sampleAnchor}”
                        </p>
                      ) : null}
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1.5">
                        {item.competitorsLinked.map((comp) => (
                          <span
                            key={comp.competitorDomain}
                            className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-brand-50 px-2 py-0.5 text-xs text-brand-800"
                          >
                            <span className="font-medium">
                              {comp.competitorDomain}
                            </span>
                            <span className="text-[11px] text-brand-500">
                              ({comp.backlinksCount})
                            </span>
                          </span>
                        ))}
                      </div>
                    </Td>

                    <Td>
                      <span className="font-mono text-xs font-semibold text-brand-900">
                        {item.maxRank != null ? fmtNumber(item.maxRank) : "—"}
                      </span>
                      <p className="text-[11px] text-brand-500">
                        {fmtNumber(item.totalCompetitorLinks)} link
                        {item.totalCompetitorLinks === 1 ? "" : "s"} ·{" "}
                        {fmtNumber(item.dofollowCount)} follow
                      </p>
                    </Td>

                    <Td>
                      <div className="flex flex-wrap gap-1">
                        {isVerified && <Pill tone="good">Reigel Verified</Pill>}
                        {item.dataSources.map((src) => (
                          <Pill
                            key={src}
                            tone={src === "DATAFORSEO" ? "info" : "default"}
                          >
                            {src === "DATAFORSEO"
                              ? "DataForSEO"
                              : src === "REIGEL_CRAWL"
                                ? "Reigel Crawl"
                                : "Public Archive"}
                          </Pill>
                        ))}
                      </div>
                    </Td>

                    <Td>
                      <ActionButton
                        variant="primary"
                        disabled={analyzeSourceMutation.isPending}
                        onClick={() => analyzeSourceMutation.mutate(item)}
                      >
                        {isAnalyzingThis
                          ? "Analyzing HTML…"
                          : "Analyze & Draft Outreach"}
                      </ActionButton>
                    </Td>
                  </Tr>
                );
              })}
            </tbody>
          </Table>
        </QueryState>
      </Panel>

      {/* Instant Outreach & Article Gap Modal when user clicks "Analyze & Draft Outreach" */}
      {activeAnalysis && (
        <GapOutreachModal
          projectId={projectId}
          sourceId={activeAnalysis.sourceId}
          sourceUrl={activeAnalysis.sourceUrl}
          domain={activeAnalysis.domain}
          report={activeAnalysis.report}
          onClose={() => setActiveAnalysis(null)}
        />
      )}
    </div>
  );
}

function GapOutreachModal({
  projectId,
  sourceId,
  sourceUrl,
  domain,
  report,
  onClose,
}: {
  projectId: string;
  sourceId: string;
  sourceUrl: string;
  domain: string;
  report: EnrichedRecommendationReport;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [pitch, setPitch] = useState(report.outreach?.pitchDraft || "");
  const [channel, setChannel] = useState(report.outreach?.contactChannel || "");
  const [status, setStatus] = useState<PublisherOutreachState["status"]>(
    report.outreach?.status || "READY_FOR_REVIEW",
  );
  const [approved, setApproved] = useState(
    Boolean(report.outreach?.approvedByUser),
  );
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  const saveOutreachMutation = useMutation({
    mutationFn: () =>
      api.backlinks.updateRecommendationOutreach(projectId, sourceId, {
        pitchDraft: pitch,
        contactChannel: channel,
        status,
        approvedByUser: approved,
      }),
    onSuccess: async (res) => {
      setSavedMsg(res.message);
      await queryClient.invalidateQueries({
        queryKey: ["backlink-recommendation", projectId, sourceId],
      });
    },
  });

  const pushOpportunityMutation = useMutation({
    mutationFn: () =>
      api.backlinks.pushRecommendationOpportunity(projectId, sourceId),
    onSuccess: async (res) => {
      setSavedMsg(res.message);
      await queryClient.invalidateQueries({
        queryKey: ["growth-opportunities", projectId],
      });
    },
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Link Gap Analysis & Outreach for ${domain}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-brand-950/50 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-brand-200 bg-surface-1 p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-brand-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-brand-950">
                Link Gap Analysis &amp; Outreach: {domain}
              </h3>
              {report.readiness && (
                <Pill
                  tone={
                    report.readiness.state === "READY"
                      ? "good"
                      : report.readiness.state === "PARTIAL"
                        ? "warn"
                        : "default"
                  }
                >
                  Readiness {report.readiness.score}/100
                </Pill>
              )}
            </div>
            <div className="mt-1 text-xs">
              <ExternalUrlLink url={sourceUrl} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-brand-400 hover:bg-brand-50 hover:text-brand-700"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 space-y-4">
          {savedMsg && <StatusNote tone="good">{savedMsg}</StatusNote>}

          {/* Article Summary & Identified Gaps */}
          {report.article && (
            <div className="rounded-xl border border-brand-200 bg-brand-50/50 p-3.5 text-xs">
              <p className="font-semibold text-brand-950">
                {report.article.title || domain}
              </p>
              <p className="mt-0.5 text-brand-600">
                {report.article.wordCount} words ·{" "}
                {report.article.listicle ? "Ranked Listicle" : "Editorial Page"}{" "}
                ·{" "}
                {report.article.ownLinked
                  ? "Already links to your site"
                  : report.article.ownMentioned
                    ? "Mentions your brand without a link"
                    : "Competitors featured — your brand not yet mentioned"}
              </p>
            </div>
          )}

          {report.gaps && report.gaps.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-brand-800">
                Why Competitors Were Linked (Detected Gaps):
              </p>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {report.gaps.slice(0, 4).map((g, i) => (
                  <div
                    key={`${g.factor}-${i}`}
                    className="rounded-lg border border-brand-200 bg-surface-2 p-2.5 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-brand-900">
                        {g.factor}
                      </span>
                      <Pill
                        tone={
                          g.priority === "High"
                            ? "bad"
                            : g.priority === "Medium"
                              ? "warn"
                              : "default"
                        }
                      >
                        {g.priority}
                      </Pill>
                    </div>
                    <p className="mt-1 text-[11px] text-brand-600">{g.gap}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-brand-700">
                Outreach Status
              </label>
              <select
                className="mt-1 w-full rounded-lg border border-brand-300 bg-surface-2 p-2 text-xs text-brand-900"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as PublisherOutreachState["status"])
                }
              >
                <option value="ANALYZED">Analyzed</option>
                <option value="QUALIFIED">Qualified</option>
                <option value="READY_FOR_REVIEW">Ready for Review</option>
                <option value="CONTACTED">Contacted</option>
                <option value="RESPONSE_PENDING">Response Pending</option>
                <option value="FEATURED">Featured</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-brand-700">
                Publisher Contact / Email
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="editor@publisher.com or contact URL"
                className="mt-1 w-full rounded-lg border border-brand-300 bg-surface-2 p-2 text-xs text-brand-900"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-brand-700">
              Personalized Editorial Outreach Pitch
            </label>
            <textarea
              rows={6}
              value={pitch}
              onChange={(e) => setPitch(e.target.value)}
              className="mt-1 w-full rounded-lg border border-brand-300 bg-surface-2 p-2.5 font-mono text-xs text-brand-900"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-brand-700">
            <input
              type="checkbox"
              checked={approved}
              onChange={(e) => setApproved(e.target.checked)}
            />
            <span className="font-medium">
              I reviewed this publisher and approve this outreach pitch.
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 pt-4">
          <ActionButton
            disabled={pushOpportunityMutation.isPending}
            onClick={() => pushOpportunityMutation.mutate()}
          >
            {pushOpportunityMutation.isPending
              ? "Adding…"
              : "Push Action Plan to Fix Engine"}
          </ActionButton>
          <div className="flex gap-2">
            <ActionButton onClick={onClose}>Close</ActionButton>
            <ActionButton
              variant="primary"
              disabled={saveOutreachMutation.isPending || !pitch.trim()}
              onClick={() => saveOutreachMutation.mutate()}
            >
              {saveOutreachMutation.isPending ? "Saving…" : "Save Outreach"}
            </ActionButton>
          </div>
        </div>
      </div>
    </div>
  );
}
