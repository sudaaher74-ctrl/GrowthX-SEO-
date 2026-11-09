"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Layers,
  Plus,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Zap,
} from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, StatusNote, Table, Td, Th, Tr } from "@/components/ui/console";
import { QueryState } from "@/components/ui/query-state";
import { api } from "@/lib/api-client";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";
import type { BacklinkReport } from "@/lib/backlinks";
import type { BacklinkOverviewResponse } from "@/lib/backlink-intelligence";

const number = (value: number | null | undefined) => (value == null ? "—" : new Intl.NumberFormat().format(value));
const time = (value?: string | null) => (value ? new Date(value).toLocaleString() : "Not synced yet");

export function BacklinkOverview({
  projectId,
  report,
  onSources,
  onOpportunities,
}: {
  projectId: string;
  report?: BacklinkReport;
  onSources: () => void;
  onOpportunities: () => void;
}) {
  const [stagedDomains, setStagedDomains] = useState<Record<string, boolean>>({});
  const [disavowedDomains, setDisavowedDomains] = useState<Record<string, boolean>>({});
  const [copiedDisavow, setCopiedDisavow] = useState(false);
  const [stagedDisavow, setStagedDisavow] = useState(false);
  const [customDomainInput, setCustomDomainInput] = useState("");
  const [stagedAnchors, setStagedAnchors] = useState<Record<string, boolean>>({});

  const client = useQueryClient();
  const overview = useQuery({
    queryKey: ["backlink-intelligence", projectId],
    queryFn: () => api.backlinks.intelligenceOverview(projectId),
    retry: false,
  });
  const sync = useMutation({
    mutationFn: () => api.backlinks.syncIntelligence(projectId),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["backlink-intelligence", projectId] });
    },
  });
  const snapshot = overview.data as BacklinkOverviewResponse | null | undefined;

  // Toxic / Spam Score categorization
  const topReferringDomains = snapshot?.topReferringDomains || [];
  const safeDomains = topReferringDomains.filter((d) => (d.spamScore ?? 0) < 10);
  const suspiciousDomains = topReferringDomains.filter((d) => (d.spamScore ?? 0) >= 10 && (d.spamScore ?? 0) <= 30);
  const toxicDomains = topReferringDomains.filter((d) => (d.spamScore ?? 0) > 30);

  const totalDomainsCount = topReferringDomains.length;
  const safePct = totalDomainsCount > 0 ? Math.round((safeDomains.length / totalDomainsCount) * 100) : 100;
  const suspPct = totalDomainsCount > 0 ? Math.round((suspiciousDomains.length / totalDomainsCount) * 100) : 0;
  const toxicPct = totalDomainsCount > 0 ? Math.round((toxicDomains.length / totalDomainsCount) * 100) : 0;

  // Active Disavow List: domains explicitly marked true, plus toxicDomains (unless marked false)
  const activeDisavowList = useMemo(() => {
    const set = new Set<string>();
    for (const td of toxicDomains) {
      if (disavowedDomains[td.domain] !== false) {
        set.add(td.domain);
      }
    }
    for (const [domain, isDisavowed] of Object.entries(disavowedDomains)) {
      if (isDisavowed) {
        set.add(domain);
      } else {
        set.delete(domain);
      }
    }
    return Array.from(set);
  }, [disavowedDomains, toxicDomains]);

  const toggleDisavow = (domain: string) => {
    const isCurrentlyDisavowed = activeDisavowList.includes(domain);
    setDisavowedDomains((prev) => ({ ...prev, [domain]: !isCurrentlyDisavowed }));
  };

  const handleAddCustomDomain = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = customDomainInput.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (!clean) return;
    setDisavowedDomains((prev) => ({ ...prev, [clean]: true }));
    setCustomDomainInput("");
  };

  const handleRemoveDisavow = (domain: string) => {
    setDisavowedDomains((prev) => ({ ...prev, [domain]: false }));
  };

  // Anchor text over-optimization analysis
  const topAnchors = snapshot?.topAnchors || [];
  const totalAnchorLinks = topAnchors.reduce((acc, a) => acc + (a.backlinks || 0), 0);
  const brandName = (snapshot?.domain || report?.ownDomains?.[0] || "").replace(/^www\./, "").split(".")[0]?.toLowerCase();

  const anchorAnalysis = useMemo(() => {
    return topAnchors.map((a) => {
      const share = totalAnchorLinks > 0 ? a.backlinks / totalAnchorLinks : 0;
      const lower = a.anchor.toLowerCase().trim();
      const isBranded = brandName ? lower.includes(brandName) : false;
      const isGeneric = ["click here", "read more", "website", "link", "source", "here", "learn more", "visit", ""].includes(lower);
      const isExactMatch = !isBranded && !isGeneric && lower.length > 0;
      const isOverOptimized = isExactMatch && share > 0.20; // > 20% commercial exact match triggers alert
      return {
        ...a,
        share,
        isBranded,
        isGeneric,
        isExactMatch,
        isOverOptimized,
      };
    });
  }, [topAnchors, totalAnchorLinks, brandName]);

  const overOptimizedAnchors = anchorAnalysis.filter((a) => a.isOverOptimized);

  const targetDomain = snapshot?.domain || report?.ownDomains?.[0] || "your-site.com";

  const generateDisavowText = () => {
    const lines = [
      `# Google Search Console Disavow List`,
      `# Generated by GrowthX SEO Autonomous Intelligence`,
      `# Target Domain: ${targetDomain}`,
      `# Timestamp: ${new Date().toISOString()}`,
      `# Flagged Disavowed Domains: ${activeDisavowList.length}`,
      `#`,
      `# Instructions: Upload this file directly to Google Search Console Disavow Tool`,
      `# at: https://search.google.com/search-console/disavow-links`,
      `#`,
    ];
    if (activeDisavowList.length === 0) {
      lines.push(`# No toxic domains currently selected for disavow.`);
      lines.push(`# Use the Disavow Manager in GrowthX to flag suspicious referring domains.`);
    } else {
      for (const d of activeDisavowList) {
        lines.push(`domain:${d}`);
      }
    }
    return lines.join("\n");
  };

  const handleDownloadDisavow = () => {
    const content = generateDisavowText();
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `disavow-${targetDomain}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyDisavow = () => {
    const content = generateDisavowText();
    void navigator.clipboard.writeText(content);
    setCopiedDisavow(true);
    setTimeout(() => setCopiedDisavow(false), 2000);
  };

  const handleStageDisavowFix = () => {
    stagingEngine.stage(projectId, {
      title: `Submit Disavow List (${activeDisavowList.length} Domains) to Google Search Console`,
      category: "Backlink Hygiene",
      source: "AUTHORITY_GAP",
      priority: "HIGH",
      impact: `De-index negative SEO and toxic link signals from ${activeDisavowList.length} flagged referring domains.`,
      effortHours: 1,
      deliverable: `Download disavow.txt and upload to GSC Disavow Tool. Monitor Search Console Security & Manual Actions tab.`,
      evidence: `Flagged domains: ${activeDisavowList.slice(0, 5).join(", ")}${activeDisavowList.length > 5 ? ` (+${activeDisavowList.length - 5} more)` : ""}`,
    });
    setStagedDisavow(true);
  };

  const handleStageAnchorFix = (anchor: string, share: number, backlinks: number) => {
    stagingEngine.stage(projectId, {
      title: `Diversify Over-Optimized Inbound Anchors: "${anchor}" (${Math.round(share * 100)}% share)`,
      category: "Anchor Text Hygiene",
      source: "AUTHORITY_GAP",
      priority: "HIGH",
      impact: `Exact-match commercial anchor exceeds 20% safe natural threshold (${number(backlinks)} links). Mitigate Google SpamBrain algorithmic suppression.`,
      effortHours: 2,
      deliverable: `Publish editorial content targeting brand-name variants, naked URLs, and long-tail anchor text to restore natural distribution.`,
      evidence: `Anchor text "${anchor}" represents ${Math.round(share * 100)}% of tracked inbound link text in the backlink index.`,
    });
    setStagedAnchors((prev) => ({ ...prev, [anchor]: true }));
  };

  const handleStageReferringDomain = (domain: string, rank?: number, backlinks?: number) => {
    stagingEngine.stage(projectId, {
      title: `Protect High-Authority Backlinks: ${domain}`,
      category: "Backlink Monitoring",
      source: "AUTHORITY_GAP",
      priority: (rank ?? 0) >= 70 ? "HIGH" : "MEDIUM",
      impact: `Referring domain rank #${rank ?? 0} with ${backlinks ?? 1} backlinks in index. Monitor against link drift or anchor drop.`,
      effortHours: 1,
      deliverable: `Configure automated weekly link destination check and reciprocal content asset reinforcement.`,
      evidence: `Top referring domain from DataForSEO backlink snapshot.`,
    });
    setStagedDomains((prev) => ({ ...prev, [domain]: true }));
  };

  const totalFollow = snapshot ? (snapshot.metrics.dofollow || 0) + (snapshot.metrics.nofollow || 0) : 0;
  const dofollowPct = totalFollow > 0 && snapshot ? Math.round(((snapshot.metrics.dofollow || 0) / totalFollow) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* ── SNAPSHOT PANEL ── */}
      <Panel
        title="Your backlink snapshot"
        subtitle="DataForSEO link index monitoring with Reigel live page destination verification."
        actions={
          <ActionButton variant="primary" disabled={sync.isPending} onClick={() => sync.mutate()}>
            {sync.isPending ? "Syncing…" : "Refresh DataForSEO"}
          </ActionButton>
        }
        padded
      >
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-brand-500">
          <Pill tone="info">DataForSEO index</Pill>
          <span>{snapshot ? `Updated ${time(snapshot.checkedAt)}` : "No provider snapshot yet"}</span>
          {snapshot?.isStale ? <Pill tone="warn">Older than 24 hours</Pill> : null}
          {snapshot?.costUsd != null ? <span>Last sync cost: ${snapshot.costUsd.toFixed(4)}</span> : null}
          <span>Refresh makes up to four billable provider requests.</span>
        </div>
        {snapshot?.warning ? <StatusNote tone="warn">{snapshot.warning}</StatusNote> : null}
        {sync.error ? (
          <div className="mb-3">
            <StatusNote tone="bad">
              Sync failed: {sync.error.message}
              {snapshot ? " Your previous snapshot is still shown." : ""}
            </StatusNote>
          </div>
        ) : null}

        {!snapshot ? (
          <QueryState
            isLoading={overview.isLoading}
            error={overview.error}
            isEmpty={!overview.isLoading && !overview.error}
            emptyTitle="No DataForSEO snapshot yet"
            emptyBody="Refresh DataForSEO to load the first backlink index snapshot. This will make up to four billable provider requests."
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Kpi
                label="Backlinks in index"
                value={number(snapshot.metrics.backlinks)}
                sub="Provider-reported links; not direct checks"
              />
              <Kpi
                label="Referring domains"
                value={number(snapshot.metrics.referringDomains)}
                sub="DataForSEO index estimate"
              />
              <Kpi
                label="Follow links"
                value={number(snapshot.metrics.dofollow)}
                sub={`${dofollowPct}% dofollow ratio · ${number(snapshot.metrics.nofollow)} nofollow`}
              />
              <Kpi
                label="Broken in index"
                value={number(snapshot.metrics.brokenBacklinks)}
                sub="Provider status; verify before action"
                tone={snapshot.metrics.brokenBacklinks ? "danger" : "default"}
              />
            </div>

            {/* Dofollow / Nofollow Quality Meter Bar */}
            {totalFollow > 0 && (
              <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs">
                <div className="flex items-center justify-between text-xs text-brand-600 mb-1.5">
                  <span className="font-semibold text-brand-950 flex items-center gap-1.5">
                    <ShieldCheck size={14} className="text-success-600" /> Link Profile Natural Balance
                  </span>
                  <span className="font-mono text-[11px]">
                    <strong className="text-success-700">{dofollowPct}% Dofollow</strong> ({number(snapshot.metrics.dofollow)}) &middot;{" "}
                    <span className="text-brand-500">{100 - dofollowPct}% Nofollow</span> ({number(snapshot.metrics.nofollow)})
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-brand-200/70 flex">
                  <div
                    className="h-full bg-success-500 transition-all"
                    style={{ width: `${dofollowPct}%` }}
                    title={`Dofollow: ${dofollowPct}%`}
                  />
                  <div
                    className="h-full bg-brand-400 transition-all"
                    style={{ width: `${100 - dofollowPct}%` }}
                    title={`Nofollow: ${100 - dofollowPct}%`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </Panel>

      {/* ── VERIFICATION & NEXT ACTIONS ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Reigel verification" subtitle="Source pages checked directly by Reigel crawler." padded>
          <div className="grid grid-cols-2 gap-3">
            <Kpi
              label="Fresh verified links"
              value={number(report?.summary.verifiedLinks)}
              sub="Reigel evidence · within 7 days"
            />
            <Kpi
              label="Confirmed lost"
              value={number(report?.summary.confirmedLostLinks)}
              sub="Requires repeat successful checks"
            />
          </div>
          <div className="mt-3 flex gap-2">
            <ActionButton onClick={onSources}>Review source checks</ActionButton>
            <ActionButton onClick={onOpportunities}>View next actions</ActionButton>
          </div>
        </Panel>

        <Panel title="What to do next" subtitle="Turn index discoveries into evidence, then act on confirmed issues." padded>
          <ol className="space-y-3 text-sm text-brand-700">
            <li>
              <strong>1. Discover:</strong> Review referring domains and competitor link sources.
            </li>
            <li>
              <strong>2. Verify:</strong> Ask Reigel to fetch source pages and inspect exact link destinations.
            </li>
            <li>
              <strong>3. Act:</strong> Revisit confirmed losses or destination problems in Next Actions.
            </li>
          </ol>
          {report?.queue.available ? (
            <p className="mt-3 text-xs text-brand-500">
              Verification queue: {number(report.queue.waiting)} waiting · {number(report.queue.active)} active
            </p>
          ) : null}
        </Panel>
      </div>

      {/* ── TOP REFERRING DOMAINS TABLE ── */}
      {snapshot ? (
        <Panel
          title="Top referring domains"
          subtitle="DataForSEO indexed sources · open a domain to inspect its reported links."
        >
          <QueryState
            isEmpty={!snapshot.topReferringDomains.length}
            emptyTitle="No referring domains in this snapshot"
            emptyBody="Refresh the provider snapshot to check again."
          >
            <Table minWidth={760}>
              <thead>
                <tr>
                  <Th>Referring Domain</Th>
                  <Th>Authority Tier</Th>
                  <Th>Spam Score</Th>
                  <Th align="right">Indexed Links</Th>
                  <Th align="right">Domain Rank</Th>
                  <Th align="right">First Seen</Th>
                  <Th align="right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {snapshot.topReferringDomains.slice(0, 10).map((item) => {
                  const rankVal = item.rank ?? 0;
                  const spamVal = item.spamScore ?? 0;
                  const isDisavowed = activeDisavowList.includes(item.domain);
                  return (
                    <Tr key={item.domain}>
                      <Td>
                        <div className="flex items-center gap-1.5">
                          <span className="font-semibold text-brand-950 font-mono text-xs">{item.domain}</span>
                          <a
                            href={`https://${item.domain}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-950 transition-colors"
                            title={`Visit ${item.domain}`}
                          >
                            <ExternalLink size={11} />
                          </a>
                        </div>
                      </Td>
                      <Td>
                        {rankVal >= 70 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-success-500/20 bg-success-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700">
                            High Authority
                          </span>
                        ) : rankVal >= 40 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-primary-500/20 bg-primary-500/10 px-1.5 py-0.5 text-[10.5px] font-semibold text-primary-700">
                            Established
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded border border-brand-200/70 bg-surface-2 px-1.5 py-0.5 text-[10.5px] font-medium text-brand-500">
                            Niche
                          </span>
                        )}
                      </Td>
                      <Td>
                        {spamVal > 30 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-error-500/30 bg-error-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-error-700">
                            <ShieldAlert size={10} className="text-error-600" />
                            Toxic ({spamVal}%)
                          </span>
                        ) : spamVal >= 10 ? (
                          <span className="inline-flex items-center gap-1 rounded border border-warning-500/30 bg-warning-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-warning-700">
                            <AlertTriangle size={10} className="text-warning-600" />
                            Review ({spamVal}%)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded border border-success-500/20 bg-success-50 px-1.5 py-0.5 text-[10.5px] font-semibold text-success-700">
                            <ShieldCheck size={10} className="text-success-600" />
                            Safe (&lt;10%)
                          </span>
                        )}
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs text-brand-950">{number(item.backlinks)}</span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-xs font-bold text-brand-950">#{number(item.rank)}</span>
                      </Td>
                      <Td align="right">
                        <span className="text-xs text-brand-500">{time(item.firstSeen)}</span>
                      </Td>
                      <Td align="right">
                        <div className="flex items-center justify-end gap-1.5">
                          {stagedDomains[item.domain] ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-success-700">
                              <CheckCircle2 size={12} className="text-success-600" />
                              <span>Protected</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleStageReferringDomain(item.domain, item.rank, item.backlinks)}
                              className="inline-flex items-center gap-1 rounded-md border border-brand-200/80 bg-surface-1 px-2 py-0.5 text-[11px] font-semibold text-brand-800 hover:bg-brand-50 hover:text-brand-950 transition-colors shadow-2xs"
                              title="Stage link monitoring & expansion action in Fix Engine"
                            >
                              <Zap size={10} className="text-signal-500" />
                              <span>Protect</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleDisavow(item.domain)}
                            className={cn(
                              "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition-colors shadow-2xs",
                              isDisavowed
                                ? "border border-error-500/40 bg-error-50 text-error-700 hover:bg-error-100"
                                : "border border-brand-200/80 bg-surface-1 text-brand-600 hover:bg-brand-50 hover:text-brand-950"
                            )}
                            title={isDisavowed ? "Remove from Google disavow list" : "Add domain to Google disavow list"}
                          >
                            <ShieldAlert size={10} className={isDisavowed ? "text-error-600" : "text-brand-400"} />
                            <span>{isDisavowed ? "Disavowed" : "Disavow"}</span>
                          </button>
                        </div>
                      </Td>
                    </Tr>
                  );
                })}
              </tbody>
            </Table>
          </QueryState>
        </Panel>
      ) : null}

      {/* ── BACKLINK TOXICITY & GOOGLE DISAVOW GENERATOR ── */}
      <Panel
        title="Backlink Toxicity & Google Disavow Generator"
        subtitle="Automated spam-score risk analysis, anchor text over-optimization alerts, and RFC-compliant Google Search Console disavow exporter."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant="secondary"
              onClick={handleCopyDisavow}
              disabled={activeDisavowList.length === 0}
            >
              {copiedDisavow ? (
                <span className="flex items-center gap-1 text-success-700">
                  <Check size={12} /> Copied
                </span>
              ) : (
                <span className="flex items-center gap-1">
                  <Copy size={12} /> Copy disavow.txt
                </span>
              )}
            </ActionButton>
            <ActionButton
              variant="primary"
              onClick={handleDownloadDisavow}
              disabled={activeDisavowList.length === 0}
            >
              <span className="flex items-center gap-1">
                <Download size={12} /> Download disavow.txt
              </span>
            </ActionButton>
            <ActionButton
              onClick={handleStageDisavowFix}
              disabled={stagedDisavow || activeDisavowList.length === 0}
            >
              {stagedDisavow ? (
                <span className="flex items-center gap-1 text-success-700 font-bold">
                  <CheckCircle2 size={12} /> Staged in Fix Engine
                </span>
              ) : (
                <span className="flex items-center gap-1 font-semibold">
                  <Zap size={12} className="text-signal-500" /> Stage in Fix Engine
                </span>
              )}
            </ActionButton>
          </div>
        }
        padded
      >
        <div className="space-y-5">
          {/* 1. Toxicity Barometer KPIs */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Safe Referring Domains"
              value={`${number(safeDomains.length)} (${safePct}%)`}
              sub="Spam score < 10% · Natural trust authority"
              tone="good"
            />
            <Kpi
              label="Suspicious Domains"
              value={`${number(suspiciousDomains.length)} (${suspPct}%)`}
              sub="Spam score 10%–30% · Requires verification"
              tone={suspiciousDomains.length > 0 ? "default" : "good"}
            />
            <Kpi
              label="High-Risk Toxic Domains"
              value={`${number(toxicDomains.length)} (${toxicPct}%)`}
              sub="Spam score > 30% · Urgent disavow candidates"
              tone={toxicDomains.length > 0 ? "danger" : "good"}
            />
            <Kpi
              label="Active Disavow Staging"
              value={`${number(activeDisavowList.length)} domains`}
              sub="Ready for Google Search Console submission"
              tone={activeDisavowList.length > 0 ? "danger" : "default"}
            />
          </div>

          {/* Toxicity Spectrum Meter */}
          {totalDomainsCount > 0 && (
            <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-3.5 shadow-2xs">
              <div className="flex items-center justify-between text-xs text-brand-600 mb-2">
                <span className="font-semibold text-brand-950 flex items-center gap-1.5">
                  <ShieldCheck size={14} className="text-success-600" /> Domain Toxicity Risk Spectrum
                </span>
                <span className="font-mono text-[11px] flex items-center gap-2">
                  <span className="text-success-700 font-bold">{safePct}% Safe</span> &middot;
                  <span className="text-warning-700 font-bold">{suspPct}% Suspicious</span> &middot;
                  <span className="text-error-700 font-bold">{toxicPct}% Toxic</span>
                </span>
              </div>
              <div className="h-2.5 w-full overflow-hidden rounded-full bg-brand-200/70 flex">
                <div
                  className="h-full bg-success-500 transition-all"
                  style={{ width: `${safePct}%` }}
                  title={`Safe: ${safePct}%`}
                />
                <div
                  className="h-full bg-warning-500 transition-all"
                  style={{ width: `${suspPct}%` }}
                  title={`Suspicious: ${suspPct}%`}
                />
                <div
                  className="h-full bg-error-500 transition-all"
                  style={{ width: `${toxicPct}%` }}
                  title={`Toxic: ${toxicPct}%`}
                />
              </div>
            </div>
          )}

          {/* 2. Anchor Text Over-Optimization Alert & Analysis */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-2 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Layers size={16} className="text-brand-700" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-950">
                  Anchor Text Profile &amp; Over-Optimization Monitor
                </h4>
              </div>
              <span className="text-[11px] font-mono text-brand-500">
                Safe Threshold: &lt;20% commercial exact-match share
              </span>
            </div>

            {overOptimizedAnchors.length > 0 ? (
              <div className="space-y-3 mb-4">
                {overOptimizedAnchors.map((anchor) => (
                  <div
                    key={anchor.anchor}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-warning-200/80 bg-warning-50/80 p-3 text-xs"
                  >
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle size={16} className="text-warning-700 shrink-0 mt-0.5" />
                      <div>
                        <div className="font-bold text-warning-800">
                          Google SpamBrain Alert: Over-Optimized Commercial Anchor Detected
                        </div>
                        <p className="mt-0.5 text-warning-700">
                          Keyword <strong className="font-mono text-brand-950">&ldquo;{anchor.anchor}&rdquo;</strong>{" "}
                          accounts for <strong>{Math.round(anchor.share * 100)}%</strong> of all inbound backlinks (
                          {number(anchor.backlinks)} links across {number(anchor.referringDomains)} domains). Exact-match commercial anchors exceeding 20% trigger algorithmic suppression.
                        </p>
                      </div>
                    </div>
                    <ActionButton
                      variant="primary"
                      onClick={() => handleStageAnchorFix(anchor.anchor, anchor.share, anchor.backlinks)}
                      disabled={stagedAnchors[anchor.anchor]}
                    >
                      {stagedAnchors[anchor.anchor] ? (
                        <span className="flex items-center gap-1 text-xs">
                          <CheckCircle2 size={12} /> Staged
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs">
                          <Zap size={12} /> Stage Diversification
                        </span>
                      )}
                    </ActionButton>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-lg border border-success-200/60 bg-success-50/60 p-2.5 text-xs text-success-800 mb-4">
                <ShieldCheck size={14} className="text-success-600 shrink-0" />
                <span>
                  <strong>Natural Anchor Profile:</strong> No commercial exact-match anchors exceed the 20% over-optimization threshold. Inbound anchor signals are well-distributed across brand and topical terms.
                </span>
              </div>
            )}

            {/* Top Anchor Text Breakdown Chips */}
            {topAnchors.length > 0 && (
              <div className="space-y-2">
                <div className="text-[11px] font-semibold text-brand-700">Top Inbound Anchor Shares:</div>
                <div className="flex flex-wrap gap-2">
                  {anchorAnalysis.slice(0, 8).map((anchor) => (
                    <div
                      key={anchor.anchor}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-all",
                        anchor.isOverOptimized
                          ? "border-warning-300 bg-warning-100/70 text-warning-900 font-semibold"
                          : anchor.isBranded
                            ? "border-success-200 bg-success-50 text-success-800"
                            : "border-brand-200 bg-surface-1 text-brand-800"
                      )}
                    >
                      <span className="font-mono text-[11px]">{anchor.anchor || "(empty / image)"}</span>
                      <span className="font-bold text-brand-950 font-mono text-[10.5px]">
                        {Math.round(anchor.share * 100)}%
                      </span>
                      <span className="text-[10px] text-brand-500">({number(anchor.backlinks)})</span>
                      {anchor.isOverOptimized && (
                        <span className="rounded bg-warning-500/20 px-1 text-[9px] font-bold text-warning-800 uppercase">
                          Alert
                        </span>
                      )}
                      {anchor.isBranded && (
                        <span className="rounded bg-success-500/20 px-1 text-[9px] font-bold text-success-700 uppercase">
                          Brand
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Interactive Google Search Console Disavow Generator & Workspace */}
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-3">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-950 flex items-center gap-1.5">
                  <FileText size={15} className="text-brand-700" /> Google Search Console Disavow File (`disavow.txt`)
                </h4>
                <p className="mt-0.5 text-xs text-brand-500">
                  Formatted strictly according to Google Disavow specifications (<code className="font-mono text-[11px]">domain:domain-name.com</code>).
                </p>
              </div>

              {/* Add Custom Domain Form */}
              <form onSubmit={handleAddCustomDomain} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Add custom domain (e.g. spam-site.com)"
                  value={customDomainInput}
                  onChange={(e) => setCustomDomainInput(e.target.value)}
                  className="rounded-lg border border-brand-200 bg-surface-2 px-2.5 py-1 text-xs text-brand-950 placeholder:text-brand-400 focus:outline-primary-600 min-w-[220px]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-brand-950 px-2.5 py-1 text-xs font-bold text-brand-50 hover:bg-brand-800 transition-colors shadow-2xs"
                >
                  <Plus size={12} />
                  <span>Add</span>
                </button>
              </form>
            </div>

            {/* Active Disavow Staging List Pills */}
            <div className="mb-3">
              <div className="text-[11px] font-semibold text-brand-600 mb-1.5 flex items-center justify-between">
                <span>Staged Domains to Disavow ({activeDisavowList.length}):</span>
                {activeDisavowList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setDisavowedDomains({})}
                    className="text-[10.5px] text-brand-400 hover:text-error-600 transition-colors"
                  >
                    Clear All
                  </button>
                )}
              </div>
              {activeDisavowList.length === 0 ? (
                <div className="rounded-lg border border-dashed border-brand-200 bg-surface-2/60 p-3 text-center text-xs text-brand-500">
                  No domains currently staged. Click <strong className="font-semibold text-brand-800">&ldquo;Disavow&rdquo;</strong> in the table above or enter a domain in the field to add it to your disavow export.
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {activeDisavowList.map((domain) => (
                    <span
                      key={domain}
                      className="inline-flex items-center gap-1.5 rounded-md border border-error-200 bg-error-50/80 px-2 py-0.5 font-mono text-xs font-medium text-error-800"
                    >
                      <span>domain:{domain}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveDisavow(domain)}
                        className="text-error-500 hover:text-error-900 transition-colors"
                        title="Remove from disavow list"
                      >
                        &times;
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Generated Raw Code Box */}
            <div className="relative rounded-lg border border-brand-200/80 bg-brand-950 p-3 text-brand-100 font-mono text-[11.5px] overflow-x-auto max-h-48 leading-relaxed">
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyDisavow}
                  className="rounded bg-brand-800 hover:bg-brand-700 px-2 py-0.5 text-[10.5px] font-sans font-semibold text-brand-200 transition-colors"
                >
                  {copiedDisavow ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="whitespace-pre">{generateDisavowText()}</pre>
            </div>
          </div>
        </div>
      </Panel>

      {/* ── AUTHORITY LINK ACQUISITION STRATEGY ── */}
      <Panel
        title="Authority Link Acquisition Playbook"
        subtitle="Proven outreach and digital PR playbooks to win high-quality inbound backlinks."
        padded
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs transition-all hover:border-brand-300 hover:shadow-card">
            <div className="flex items-center gap-2 text-primary-700">
              <Zap size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Unlinked Mentions</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Scan editorial articles and blogs that mention your brand name or founders without linking. A lightweight email request converts over 30% into live dofollow links.
            </p>
          </div>

          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs transition-all hover:border-brand-300 hover:shadow-card">
            <div className="flex items-center gap-2 text-warning-700">
              <Layers size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Broken Link Interception</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Identify 404 dead links pointing to discontinued competitor pages in your niche. Reach out to the webmaster with your updated guide as a turnkey replacement.
            </p>
          </div>

          <div className="rounded-xl border border-brand-200/80 bg-surface-1 p-4 shadow-2xs transition-all hover:border-brand-300 hover:shadow-card">
            <div className="flex items-center gap-2 text-success-700">
              <ShieldCheck size={16} aria-hidden="true" />
              <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-950">Competitor Gap Outreach</h4>
            </div>
            <p className="mt-2 text-xs leading-5 text-brand-600">
              Use the Competitor Link Gap tab to find trusted resource directories that link to 2+ rivals. Request inclusion in their industry vendor directory.
            </p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
