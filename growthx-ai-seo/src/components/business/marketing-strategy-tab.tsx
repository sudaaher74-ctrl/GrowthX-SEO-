"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  ExternalLink,
  FileText,
  Home,
  Link2,
  Loader2,
  Megaphone,
  RefreshCw,
  Sparkles,
  Tag,
  Target,
  TrendingUp,
} from "lucide-react";
import { ActionButton, PageHeader, Panel, Pill, StatusNote, Table, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { ContentIdeasPanels } from "@/components/content/content-ideas-panels";
import { useBusinessStrategy, useGenerateBusinessStrategy } from "@/hooks/use-growthx";
import type { BusinessStrategyReport, StrategyAction, StrategyPositioning } from "@/lib/api-client";
import { actionPlan, bandText, counterPlan, evidenceLines, rivalProductViews, type RivalProductView } from "@/lib/business-strategy";
import { stagingEngine } from "@/lib/staging-engine";
import { cn } from "@/lib/utils";

/**
 * Marketing Strategy: what your competitors sell and push, how their prices
 * compare with yours, and what to do about it.
 *
 * Replaces Marketing Signals, which listed each site's taglines and asked the
 * customer to press "Re-read" once per competitor before showing anything.
 * The facts here are counted from both catalogs and both crawls; the advice
 * is written by Sarvam from those facts and checked against them. Nothing
 * claims to know a competitor's sales — what a site links to from its
 * homepage, menus and articles is what it is pushing, and that is how it is
 * described.
 */
export function MarketingStrategyTab({ projectId }: { projectId: string }) {
  const query = useBusinessStrategy(projectId || null);
  const generate = useGenerateBusinessStrategy(projectId || null);
  const report = generate.data ?? query.data ?? null;

  // The first visit writes one without being asked: an empty tab with a
  // button is the "press Re-read for each competitor" problem again.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (!projectId || autoStarted.current || query.isLoading || query.error || query.data !== null) return;
    autoStarted.current = true;
    generate.mutate();
  }, [projectId, query.isLoading, query.error, query.data, generate]);

  const refresh = (
    <ActionButton
      variant="primary"
      icon={generate.isPending ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
      disabled={generate.isPending || !projectId}
      onClick={() => generate.mutate()}
    >
      {generate.isPending ? "Writing your strategy…" : report ? "Refresh strategy" : "Write my strategy"}
    </ActionButton>
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="Marketing Strategy"
        subtitle="What your competitors sell and push hardest, how their prices compare with yours, and what to do about it."
        actions={refresh}
      />

      {generate.isError && (
        <StatusNote tone="bad">
          {generate.error instanceof Error ? generate.error.message : "The strategy could not be written. Please try again."}
        </StatusNote>
      )}

      {query.isLoading ? (
        <Panel padded>
          <p className="flex items-center justify-center gap-2 py-6 text-[12.5px] text-brand-500">
            <Loader2 size={14} className="animate-spin" /> Loading your strategy…
          </p>
        </Panel>
      ) : !report ? (
        <WritingPanel pending={generate.isPending} />
      ) : (
        <StrategyBody report={report} projectId={projectId} refreshing={generate.isPending} />
      )}
    </div>
  );
}

function WritingPanel({ pending }: { pending: boolean }) {
  return (
    <Panel padded>
      <div className="mx-auto max-w-md py-8 text-center">
        <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary-50 text-primary-600">
          {pending ? <Loader2 size={20} className="animate-spin" /> : <Sparkles size={20} />}
        </div>
        <p className="mt-3 text-[14px] font-semibold text-brand-950">
          {pending ? "Writing your marketing strategy" : "No strategy yet"}
        </p>
        <p className="mt-1 text-[12.5px] text-brand-500">
          {pending
            ? "Reading your products and your competitors', comparing prices, and finding what they push hardest. This takes about a minute."
            : "Press “Write my strategy” to compare your products and prices with your competitors'."}
        </p>
      </div>
    </Panel>
  );
}

function StrategyBody({ report, projectId, refreshing }: { report: BusinessStrategyReport; projectId: string; refreshing: boolean }) {
  const { facts, strategy } = report;
  const views = rivalProductViews(report);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-brand-500">
        <span>Written {relativeTime(report.generatedAt)}</span>
        {report.model && (
          <span className="inline-flex items-center gap-1">
            <Sparkles size={11} className="text-primary-500" /> by {report.model}
          </span>
        )}
        {refreshing && (
          <span className="inline-flex items-center gap-1 text-primary-700">
            <Loader2 size={11} className="animate-spin" /> Writing a fresh one…
          </span>
        )}
      </div>

      {report.strategyError && (
        <div className="rounded-xl border border-warning-200 bg-warning-50 px-4 py-3 text-[12.5px] text-warning-700">
          {report.strategyError}
        </div>
      )}

      {strategy && (strategy.summary || strategy.positioning) && (
        <Panel title="Where you stand" padded>
          {strategy.summary && <p className="text-[13.5px] leading-relaxed text-brand-950">{strategy.summary}</p>}
          {strategy.positioning && (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
              <Callout icon={TrendingUp} label="Your edge" text={strategy.positioning.yourEdge} />
              <Callout icon={Target} label="What they lead with" text={strategy.positioning.theirAngle} />
              <Callout icon={Megaphone} label="Headline to use" text={strategy.positioning.message} strong />
            </div>
          )}
        </Panel>
      )}

      <Panel
        title="What your competitors push hardest"
        subtitle="Nobody can see another business's sales. These are the products their own website promotes most: linked from the most pages, from the homepage and from their articles."
      >
        {views.length === 0 ? (
          <p className="p-5 text-[12.5px] text-brand-500">
            We haven&apos;t found products on your competitors&apos; websites yet. Once Competitor Intelligence has read
            their sites, refresh this strategy.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 p-4 lg:grid-cols-2">
            {views.map((view) => (
              <RivalProductCard key={view.push.url} view={view} projectId={projectId} />
            ))}
          </div>
        )}
      </Panel>

      <PricesPanel report={report} />

      {strategy && strategy.actions.length > 0 && <ActionsPanel actions={strategy.actions} projectId={projectId} />}

      {strategy && (strategy.keywords.length > 0 || strategy.blogPosts.length > 0) && (
        <ContentIdeasPanels
          projectId={projectId}
          ideas={{
            keywords: strategy.keywords.map((k) => ({
              phrase: k.phrase,
              why: k.forProduct ? `${k.why} For your ${k.forProduct}.` : k.why,
              // The product's own page, or the page Google already shows for
              // the search, so a phrase for something you sell is never
              // labelled "Needs a new page".
              usePage: productPath(facts.you.products, k.forProduct) ?? (k.measured?.page ? urlPath(k.measured.page) : null),
              measured: k.measured ?? null,
            })),
            blogIdeas: strategy.blogPosts,
            model: report.model,
            search: facts.search
              ? {
                  status: facts.search.status,
                  days: facts.search.days,
                  range: facts.search.range,
                  almostWinning: facts.search.almostWinning.map((s) => ({ ...s, pagePath: s.page ? urlPath(s.page) : null })),
                }
              : undefined,
          }}
        />
      )}

      <PositioningPanel you={facts.you.positioning} competitors={facts.competitors.map((c) => ({ name: c.name, positioning: c.positioning }))} />
    </div>
  );
}

function Callout({ icon: Icon, label, text, strong }: { icon: React.ElementType; label: string; text: string; strong?: boolean }) {
  if (!text) return null;
  return (
    <div className={cn("rounded-lg border p-3", strong ? "border-primary-200 bg-primary-50" : "bg-brand-50")}>
      <p className={cn("flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-[0.06em]", strong ? "text-primary-700" : "text-brand-400")}>
        <Icon size={12} /> {label}
      </p>
      <p className={cn("mt-1.5 text-[12.5px] leading-snug", strong ? "font-semibold text-primary-800" : "text-brand-950")}>{text}</p>
    </div>
  );
}

function RivalProductCard({ view, projectId }: { view: RivalProductView; projectId: string }) {
  const { push, play, competitor } = view;
  const [saved, setSaved] = useState(false);
  const evidence = evidenceLines(push);

  const save = () => {
    stagingEngine.stage(projectId, {
      title: `Compete with ${competitor}'s ${push.name}`,
      category: "Business",
      source: "BUSINESS_MARKETING_SIGNAL",
      priority: push.onHomepage ? "HIGH" : "MEDIUM",
      impact: play?.whyItWorks || evidence.join(". "),
      effortHours: 2,
      deliverable: counterPlan(view),
      evidence: `${competitor} · ${evidence.join(" · ")}`,
      affectedUrl: push.url,
    });
    setSaved(true);
  };

  return (
    <div className="flex flex-col rounded-xl border bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <Pill tone="info">{competitor}</Pill>
            {push.source === "linked-page" && <Pill>Possibly a product</Pill>}
          </div>
          <a
            href={push.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-flex items-start gap-1 text-[13.5px] font-semibold leading-snug text-brand-950 hover:text-primary-700 hover:underline"
          >
            {push.name} <ExternalLink size={11} className="mt-1 shrink-0" />
          </a>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-brand-400">Their price</p>
          <p className="font-mono text-[14px] font-bold text-brand-950">{push.price ?? "—"}</p>
          {!push.price && <p className="text-[10.5px] text-brand-400">Not shown</p>}
        </div>
      </div>

      {evidence.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {push.linkedFrom > 0 && <EvidenceChip icon={Link2} text={evidence[0]} />}
          {push.onHomepage && <EvidenceChip icon={Home} text="On their homepage" />}
          {push.fromArticles.length > 0 && (
            <EvidenceChip icon={FileText} text={`${push.fromArticles.length} article${push.fromArticles.length === 1 ? "" : "s"} point here`} />
          )}
        </ul>
      )}
      {push.fromArticles.length > 0 && (
        <p className="mt-2 text-[11.5px] text-brand-500">
          Articles: {push.fromArticles.map((a) => `“${a.title}”`).join(", ")}
        </p>
      )}
      {(play?.keywords.length || push.linkWords.length) ? (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 text-[11px] text-brand-400">
            <Tag size={11} /> Words they use:
          </span>
          {[...new Set([...(play?.keywords ?? []), ...push.linkWords])].slice(0, 6).map((w) => (
            <span key={w} className="rounded-md bg-brand-100 px-1.5 py-0.5 text-[11px] text-brand-700">
              {w}
            </span>
          ))}
        </div>
      ) : null}

      {play && (
        <div className="mt-3 space-y-2 border-t pt-3">
          {play.whyItWorks && (
            <p className="text-[12.5px] text-brand-700">
              <span className="font-semibold text-brand-950">Why it works for them: </span>
              {play.whyItWorks}
            </p>
          )}
          {play.counter.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-success-700">How you can compete</p>
              <ol className="mt-1 space-y-1">
                {play.counter.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[12.5px] text-brand-950">
                    <span className="flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded-full bg-success-50 text-[10px] font-bold text-success-700">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}

      {play && (
        <div className="mt-3 flex justify-end">
          <ActionButton icon={saved ? <Check size={13} /> : <Sparkles size={13} />} disabled={saved} onClick={save}>
            {saved ? "Saved to Your Plans" : "Save as a plan"}
          </ActionButton>
        </div>
      )}
    </div>
  );
}

function EvidenceChip({ icon: Icon, text }: { icon: React.ElementType; text: string }) {
  return (
    <li className="inline-flex items-center gap-1 rounded-full border border-primary-100 bg-primary-50 px-2 py-0.5 text-[11px] font-medium text-primary-700">
      <Icon size={11} /> {text}
    </li>
  );
}

function PricesPanel({ report }: { report: BusinessStrategyReport }) {
  const { facts, strategy } = report;
  const competitors = facts.competitors.map((c) => c.name);
  return (
    <Panel title="Your prices next to theirs" subtitle="Lowest to highest price in each category, from the prices shown on each website.">
      {facts.prices.length === 0 ? (
        <p className="p-5 text-[12.5px] text-brand-500">
          There&apos;s no category yet where prices are shown to compare. You show a price on {facts.you.pricedCount} of{" "}
          {facts.you.productCount} products; your competitors on{" "}
          {facts.competitors.reduce((s, c) => s + c.pricedCount, 0)} of {facts.competitors.reduce((s, c) => s + c.productCount, 0)}.
        </p>
      ) : (
        <Table minWidth={560}>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th>You</Th>
              {competitors.map((c) => (
                <Th key={c}>{c}</Th>
              ))}
            </tr>
          </thead>
          <tbody>
            {facts.prices.map((row) => (
              <Tr key={row.category}>
                <Td className="font-medium text-brand-950">{row.category}</Td>
                <Td className="font-mono text-[12px] text-brand-950">
                  {row.you ? bandText(row.you) : <span className="font-sans text-brand-400">No price shown</span>}
                </Td>
                {competitors.map((c) => {
                  const t = row.them.find((x) => x.competitor === c);
                  return (
                    <Td key={c} className="font-mono text-[12px] text-brand-700">
                      {t ? bandText(t.band) : <span className="font-sans text-brand-400">—</span>}
                    </Td>
                  );
                })}
              </Tr>
            ))}
          </tbody>
        </Table>
      )}
      {strategy && strategy.pricing.length > 0 && (
        <div className="border-t bg-brand-50 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brand-400">Pricing advice</p>
          <ul className="mt-1.5 space-y-1">
            {strategy.pricing.map((line) => (
              <li key={line} className="flex gap-2 text-[12.5px] text-brand-950">
                <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary-500" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Panel>
  );
}

const PRIORITY: Record<StrategyAction["priority"], { label: string; tone: "bad" | "warn" | "default" }> = {
  high: { label: "Do first", tone: "bad" },
  medium: { label: "Do next", tone: "warn" },
  low: { label: "When you can", tone: "default" },
};

function ActionsPanel({ actions, projectId }: { actions: StrategyAction[]; projectId: string }) {
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const save = (action: StrategyAction) => {
    stagingEngine.stage(projectId, {
      title: action.title,
      category: "Business",
      source: "BUSINESS_MARKETING_SIGNAL",
      priority: action.priority === "high" ? "HIGH" : action.priority === "low" ? "LOW" : "MEDIUM",
      impact: action.why,
      effortHours: 2,
      deliverable: actionPlan(action),
      evidence: "Marketing Strategy",
    });
    setSaved((s) => new Set(s).add(action.title));
  };

  return (
    <Panel title="Your action plan" subtitle="The most important things to do, in order. Save any of them to Your Plans.">
      <ol className="divide-y">
        {actions.map((action, i) => (
          <li key={action.title} className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary-600 text-[12px] font-bold text-white">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-[13.5px] font-semibold text-brand-950">{action.title}</p>
                <Pill tone={PRIORITY[action.priority].tone}>{PRIORITY[action.priority].label}</Pill>
              </div>
              {action.why && <p className="mt-0.5 text-[12px] text-brand-500">{action.why}</p>}
              <ul className="mt-2 space-y-1">
                {action.steps.map((step) => (
                  <li key={step} className="flex gap-2 text-[12.5px] text-brand-950">
                    <Check size={13} className="mt-0.5 shrink-0 text-success-600" />
                    {step}
                  </li>
                ))}
              </ul>
            </div>
            <ActionButton
              icon={saved.has(action.title) ? <Check size={13} /> : <Sparkles size={13} />}
              disabled={saved.has(action.title)}
              onClick={() => save(action)}
            >
              {saved.has(action.title) ? "Saved" : "Save as a plan"}
            </ActionButton>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

function PositioningPanel({
  you,
  competitors,
}: {
  you: StrategyPositioning | null;
  competitors: Array<{ name: string; positioning: StrategyPositioning | null }>;
}) {
  const sites = [{ name: "You", positioning: you, you: true }, ...competitors.map((c) => ({ ...c, you: false }))];
  return (
    <Panel title="How each business describes itself" subtitle="Read from each homepage: what they promise, the offers they run, and their tone.">
      <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
        {sites.map((site) => (
          <div key={site.name} className={cn("rounded-xl border p-4", site.you ? "border-primary-200 bg-primary-50" : "bg-white")}>
            <p className="text-[13px] font-semibold text-brand-950">{site.name}</p>
            {!site.positioning ? (
              <p className="mt-2 text-[12px] text-brand-500">Couldn&apos;t read their homepage this time. Refresh the strategy to try again.</p>
            ) : (
              <div className="mt-2 space-y-2.5">
                {site.positioning.valueProps.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">What they promise</p>
                    <ul className="mt-1 space-y-0.5">
                      {site.positioning.valueProps.map((v) => (
                        <li key={v} className="text-[12px] leading-snug text-brand-950">
                          “{v}”
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {site.positioning.promos.length > 0 && (
                  <div>
                    <p className="text-[10.5px] font-semibold uppercase tracking-[0.06em] text-brand-400">Offers</p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {site.positioning.promos.map((p) => (
                        <Pill key={p} tone="good">
                          {p}
                        </Pill>
                      ))}
                    </div>
                  </div>
                )}
                {site.positioning.tone && (
                  <p className="text-[12px] text-brand-600">
                    <span className="font-semibold text-brand-950">Tone: </span>
                    {site.positioning.tone}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function productPath(products: BusinessStrategyReport["facts"]["you"]["products"], name: string | null): string | null {
  if (!name) return null;
  const hit = products.find((p) => p.name.toLowerCase() === name.toLowerCase());
  if (!hit) return null;
  try {
    return new URL(hit.url).pathname;
  } catch {
    return null;
  }
}

function urlPath(url: string): string {
  try {
    return new URL(url).pathname || "/";
  } catch {
    return url;
  }
}
