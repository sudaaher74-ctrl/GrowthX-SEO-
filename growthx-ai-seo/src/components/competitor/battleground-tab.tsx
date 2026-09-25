"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Plus, Swords, X } from "lucide-react";
import { ActionButton, Kpi, Panel, Pill, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api, type TrackedCompetitor } from "@/lib/api-client";
import { useCrawlPages, useLatestCrawl, useLocalSeo, useVisibility } from "@/hooks/use-growthx";
import { buildKeywordProfiles, titleCase } from "@/lib/keyword-extractor";
import { stagingEngine } from "@/lib/staging-engine";
import {
  LOW_SAMPLE,
  bestRival,
  buildCounterBrief,
  buildMetrics,
  buildMoves,
  buildThreats,
  measuredColumns,
  type GapCandidate,
  type Metric,
  type Move,
  type RivalInput,
  type ThreatLevel,
} from "@/lib/battleground";

const MAX_RIVALS = 5;

interface BattlegroundTabProps {
  projectId: string;
  domain: string;
  brand: string;
  competitors: TrackedCompetitor[];
  onAddCompetitor: () => void;
  onOpenCounterMoves: () => void;
}

function ignoredKey(projectId: string) {
  return `growthx.battleground.ignored.${projectId}`;
}

function readIgnored(projectId: string): Set<string> {
  try {
    const raw = window.localStorage.getItem(ignoredKey(projectId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

function EmptyNote({ title, message }: { title: string; message: string }) {
  return (
    <div className="py-6 text-center">
      <p className="text-[13px] font-semibold text-brand-950">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[12px] leading-relaxed text-brand-500">{message}</p>
    </div>
  );
}

function SourceBadge({ metric }: { metric: Pick<Metric, "source" | "sample" | "key"> }) {
  const low = metric.key === "ai" && (metric.sample ?? 0) < LOW_SAMPLE;
  const label = metric.key === "ai" && metric.sample != null ? `AI sampled n=${metric.sample}` : metric.source;
  return <Pill tone={low ? "warn" : "info"}>{label}</Pill>;
}

const THREAT_TONE: Record<ThreatLevel, "bad" | "warn" | "good" | "default"> = {
  High: "bad",
  Medium: "warn",
  Low: "good",
  "Not measured": "default",
};

export function BattlegroundTab({
  projectId,
  domain,
  brand,
  competitors,
  onAddCompetitor,
  onOpenCounterMoves,
}: BattlegroundTabProps) {
  const ourCrawl = useLatestCrawl(domain || null);
  const ourPages = useCrawlPages(ourCrawl.data?.id ?? null, ourCrawl.data?.status);
  const visibility = useVisibility(projectId || null);
  const localSeo = useLocalSeo(projectId || null);

  const [selected, setSelected] = useState<string[] | null>(null);
  const selectedIds = selected ?? competitors.slice(0, MAX_RIVALS).map((c) => c.id);
  const rivals = competitors.filter((c) => selectedIds.includes(c.id));

  // Re-read when the project changes, during render rather than in an effect.
  const [ignored, setIgnored] = useState<Set<string>>(() => new Set());
  const [ignoredFor, setIgnoredFor] = useState("");
  if (projectId && ignoredFor !== projectId) {
    setIgnoredFor(projectId);
    setIgnored(readIgnored(projectId));
  }

  const [briefFor, setBriefFor] = useState<Move | null>(null);

  // Gaps are read against the first selected rival that has been crawled.
  const gapRival = rivals.find((c) => (c.pagesCrawled ?? 0) > 0) ?? null;
  const rivalPages = useQuery({
    queryKey: ["competitor-pages", projectId, gapRival?.id],
    queryFn: () => api.listCompetitorPages(projectId, gapRival!.id),
    enabled: Boolean(projectId && gapRival?.id),
    staleTime: 60_000,
  });

  const rivalInputs: RivalInput[] = useMemo(
    () =>
      rivals.map((c) => ({
        id: c.id,
        name: c.name || c.label || c.domain,
        domain: c.domain,
        pagesCrawled: c.pagesCrawled && c.pagesCrawled > 0 ? c.pagesCrawled : null,
        healthScore: c.healthScore ?? null,
        aiNamed: c.aiMentions?.named ?? null,
        aiAnswers: c.aiMentions?.answers ?? null,
        rating: c.rating ?? null,
        reviewCount: c.reviewCount ?? null,
        lastAnalyzedAt: c.lastAnalyzedAt,
      })),
    [rivals],
  );

  const summary = visibility.data?.summary;
  const metrics = useMemo(
    () =>
      buildMetrics(
        {
          domain,
          pagesCrawled: ourCrawl.data?.pagesCrawled ?? null,
          healthScore: ourCrawl.data?.healthScore ?? null,
          aiSharePct: summary?.citationSharePct ?? null,
          aiChecked: summary?.checked ?? null,
          // Google gives no rating to a listing without reviews; 0.0 is not a score.
          rating: localSeo.data?.reviewCount ? localSeo.data.rating : null,
          reviewCount: localSeo.data?.reviewCount ?? null,
        },
        rivalInputs,
      ),
    [domain, ourCrawl.data, summary, localSeo.data, rivalInputs],
  );

  const gaps = useMemo(() => {
    const content: GapCandidate[] = [];
    const keyword: GapCandidate[] = [];
    if (!gapRival || !rivalPages.data) return { content, keyword };
    const rivalName = gapRival.name || gapRival.label || gapRival.domain;
    const ours = ourPages.data?.data ?? [];
    const ourText = ours.map((p) => `${p.title ?? ""} ${p.url}`.toLowerCase());

    for (const p of rivalPages.data) {
      const raw = (Array.isArray(p.h1) ? p.h1[0] : "") || p.title || "";
      const topic = raw.replace(/\s*[|–-]\s*[^|–-]+$/, "").trim();
      if (!topic) continue;
      const probe = topic.toLowerCase().slice(0, 20);
      if (!ourText.some((t) => t.includes(probe))) {
        content.push({ rival: rivalName, rivalDomain: gapRival.domain, topic: titleCase(topic), url: p.url });
      }
    }

    const ourProfiles = buildKeywordProfiles(ours);
    buildKeywordProfiles(rivalPages.data).forEach((_profile, kw) => {
      if (!ourProfiles.has(kw)) keyword.push({ rival: rivalName, rivalDomain: gapRival.domain, topic: titleCase(kw) });
    });
    return { content, keyword };
  }, [gapRival, rivalPages.data, ourPages.data]);

  const moves = useMemo(() => buildMoves(metrics, gaps, ignored), [metrics, gaps, ignored]);
  const threats = useMemo(() => buildThreats(metrics, rivalInputs), [metrics, rivalInputs]);
  const columns = measuredColumns(metrics);
  const hiddenColumns = metrics.filter((m) => !columns.includes(m)).map((m) => m.label);

  const ignore = (id: string) => {
    const next = new Set(ignored).add(id);
    setIgnored(next);
    try {
      window.localStorage.setItem(ignoredKey(projectId), JSON.stringify([...next]));
    } catch {
      // Per-browser convenience only; the move simply reappears next visit.
    }
  };

  const toggleRival = (id: string) => {
    const current = selectedIds;
    if (current.includes(id)) setSelected(current.filter((x) => x !== id));
    else if (current.length < MAX_RIVALS) setSelected([...current, id]);
  };

  if (competitors.length === 0) {
    return (
      <Panel padded>
        <EmptyNote
          title="No rivals tracked yet"
          message="Add a competitor to see who you are winning and losing against, and what to do about it."
        />
        <div className="mt-3 flex justify-center">
          <ActionButton variant="primary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
            Add competitor
          </ActionButton>
        </div>
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {/* Rival selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-lg border border-brand-950 bg-brand-950 px-3 py-1.5 text-[12px] font-medium text-white">
          You · {domain || "your site"}
        </span>
        {competitors.map((c) => {
          const on = selectedIds.includes(c.id);
          const full = !on && selectedIds.length >= MAX_RIVALS;
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggleRival(c.id)}
              disabled={full}
              title={full ? `Compare up to ${MAX_RIVALS} rivals at once` : undefined}
              className={`rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:opacity-40 ${
                on ? "bg-white text-brand-950" : "bg-brand-50 text-brand-400 line-through"
              }`}
            >
              {c.name || c.label || c.domain}
            </button>
          );
        })}
        <ActionButton variant="secondary" icon={<Plus size={13} />} onClick={onAddCompetitor}>
          Add rival
        </ActionButton>
        <span className="ml-auto text-[11px] text-brand-400">
          Your last crawl: {ourCrawl.data?.finishedAt ? relativeTime(ourCrawl.data.finishedAt) : "not yet"}
        </span>
      </div>

      {/* Scoreboard: you vs your best rival on each measure */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {metrics.map((m) => {
          const best = bestRival(m);
          const delta = m.you != null && best?.value != null ? Number((m.you - best.value).toFixed(m.key === "rating" ? 1 : 0)) : null;
          return (
            <Kpi
              key={m.key}
              label={m.label}
              value={m.you != null ? m.short(m.you) : "—"}
              delta={delta}
              deltaSuffix={m.key === "ai" ? "pt" : ""}
              sub={
                <span className="flex flex-col items-start gap-1.5">
                  <span>
                    {m.you == null
                      ? "Not measured for you yet"
                      : best?.value != null
                        ? `Best rival: ${best.name}, ${m.key === "ai" ? `named in ${m.format(best.value)}` : m.format(best.value)}`
                        : "No rival measured yet"}
                  </span>
                  <SourceBadge metric={m} />
                </span>
              }
            />
          );
        })}
      </div>
      <p className="text-[11px] text-brand-400">
        Organic visibility and local grid share are not shown: they need a search-ranking data source, which is not
        connected yet.
      </p>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* This week's moves */}
        <div className="lg:col-span-2">
          <Panel
            title="This week's moves"
            subtitle="Where a rival is measurably ahead, and what they have that you do not"
            actions={
              <ActionButton variant="secondary" onClick={onOpenCounterMoves}>
                Saved counter-moves
              </ActionButton>
            }
            padded
          >
            {moves.length === 0 ? (
              <EmptyNote
                title="No moves to make yet"
                message={
                  rivalInputs.some((r) => r.pagesCrawled)
                    ? "You are level with or ahead of every measured rival. Moves appear here when a rival pulls ahead."
                    : "Rivals appear here once they have been crawled. Crawls start when a competitor is added."
                }
              />
            ) : (
              <ul className="space-y-3">
                {moves.map((move) => (
                  <li key={move.id} className="rounded-xl border bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Swords size={14} className="text-brand-400" />
                      <span className="text-[12px] font-semibold text-brand-950">{move.rival}</span>
                      <Pill tone="info">{move.source}</Pill>
                      <Pill tone={move.confidence === "Measured" ? "good" : "warn"}>{move.confidence}</Pill>
                      <span className="ml-auto text-[11px] text-brand-400" title="Needs GSC and GA4 revenue data">
                        ₹ value: needs GSC + GA4
                      </span>
                    </div>
                    <p className="mt-2 text-[13px] font-semibold text-brand-950">{move.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-brand-600">{move.detail}</p>
                    <div className="mt-3 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => ignore(move.id)}
                        className="rounded-lg px-3 py-1.5 text-[12px] font-medium text-brand-500 hover:bg-brand-100"
                      >
                        Ignore
                      </button>
                      <ActionButton variant="primary" onClick={() => setBriefFor(move)}>Counter</ActionButton>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>

        {/* Threat per rival */}
        <Panel title="Threat level" subtitle="How many measures each rival leads you on" padded>
          <ul className="space-y-2.5">
            {threats.map((t) => (
              <li key={t.id} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold text-brand-950">{t.name}</p>
                  <p className="text-[11px] text-brand-400">
                    {t.measured === 0
                      ? "Not crawled or sampled yet"
                      : t.ahead.length === 0
                        ? `Behind you on all ${t.measured} measured`
                        : `Ahead on ${t.ahead.join(", ")}`}
                  </p>
                </div>
                <Pill tone={THREAT_TONE[t.level]}>{t.level}</Pill>
              </li>
            ))}
          </ul>
          <p className="mt-4 border-t pt-3 text-[11px] text-brand-400">
            Rival pages are snapshotted daily at 03:00 UTC, so changes can be tracked over time.
          </p>
        </Panel>
      </div>

      {/* Benchmark: every column filled for at least one rival, or hidden */}
      <Panel
        title="Benchmark"
        subtitle={hiddenColumns.length ? `Hidden until measured for a rival: ${hiddenColumns.join(", ")}` : undefined}
      >
        {columns.length === 0 ? (
          <div className="p-4">
            <EmptyNote title="Nothing measured for rivals yet" message="Crawl results and AI samples appear here as they arrive." />
          </div>
        ) : (
          <Table minWidth={640}>
            <thead>
              <tr>
                <Th>Site</Th>
                {columns.map((m) => (
                  <Th key={m.key} align="right">
                    {m.label}
                  </Th>
                ))}
              </tr>
            </thead>
            <tbody>
              <Tr>
                <Td className="font-semibold text-brand-950">You · {domain}</Td>
                {columns.map((m) => (
                  <Td key={m.key} align="right">
                    {m.you != null ? m.format(m.you) : <span className="text-brand-400">not measured</span>}
                  </Td>
                ))}
              </Tr>
              {rivalInputs.map((r) => (
                <Tr key={r.id}>
                  <Td>{r.name}</Td>
                  {columns.map((m) => {
                    const v = m.rivals.find((x) => x.id === r.id)?.value ?? null;
                    return (
                      <Td key={m.key} align="right">
                        {v != null ? m.format(v) : <span className="text-brand-400">not measured</span>}
                      </Td>
                    );
                  })}
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Panel>

      {briefFor && (
        <CounterBriefModal
          move={briefFor}
          brief={buildCounterBrief(briefFor, { domain, brand: brand || domain })}
          onClose={() => setBriefFor(null)}
          onSave={(brief) => {
            stagingEngine.stage(projectId, {
              title: briefFor.title,
              category: "Competitor Intelligence",
              source: "COMPETITOR_CONTENT",
              priority: briefFor.weight >= 0.5 ? "HIGH" : "MEDIUM",
              impact: briefFor.detail,
              effortHours: 2,
              deliverable: brief,
              evidence: `${briefFor.source} · ${briefFor.confidence}`,
            });
            setBriefFor(null);
            onOpenCounterMoves();
          }}
        />
      )}
    </div>
  );
}

function CounterBriefModal({
  move,
  brief,
  onClose,
  onSave,
}: {
  move: Move;
  brief: string;
  onClose: () => void;
  onSave: (brief: string) => void;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(brief);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Counter-move brief"
      className="fixed inset-0 z-50 flex items-center justify-center bg-brand-950/40 p-4"
      onClick={onClose}
    >
      <div className="w-full max-w-2xl" onClick={(e) => e.stopPropagation()}>
        <Panel
          title="Counter-move brief"
          subtitle={`${move.rival} · ${move.title}`}
          actions={
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1 text-brand-400 hover:bg-brand-100">
              <X size={16} />
            </button>
          }
          padded
        >
          <p className="mb-2 text-[11px] text-brand-500">
            Ready to copy and hand over. Nothing is changed on your site: apply it in your CMS, or send it to whoever
            edits the site.
          </p>
          <pre className="max-h-[50vh] overflow-auto whitespace-pre-wrap rounded-lg border bg-brand-50 p-3 font-mono text-[11.5px] leading-relaxed text-brand-950">
            {brief}
          </pre>
          <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
            <ActionButton variant="secondary" icon={copied ? <Check size={13} /> : <Copy size={13} />} onClick={copy}>
              {copied ? "Copied" : "Copy brief"}
            </ActionButton>
            <ActionButton variant="primary" onClick={() => onSave(brief)}>Save to Counter-Moves</ActionButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}
