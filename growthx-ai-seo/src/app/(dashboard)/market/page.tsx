"use client";
import { useState } from "react";
import {
  ActionButton,
  Kpi,
  Mono,
  NotConnected,
  PageHeader,
  Panel,
  Pill,
  StatusNote,
  Table,
  Tabs,
  Td,
  Th,
  Tr,
} from "@/components/ui/console";
import { TrendingUp, MessageSquare, Users, PieChart, Zap, Loader2, CheckCircle2 } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  useWorkspace,
  usePortfolio,
  useVisibility,
  useMarketIntelligence,
  useGenerateMarket,
  useTrackedPrompts,
} from "@/hooks/use-growthx";

/**
 * Every figure on this page comes from the active project's own records:
 * the AI-visibility sweep (trend, share of voice, per-assistant citation rates),
 * the stored MarketIntelligence row (sentiment, trending topics), and the
 * project's tracked prompts. Where a project has not produced that data yet the
 * section renders an empty state — it is never backfilled with sample figures,
 * which would show one tenant another tenant's numbers.
 */
export default function MarketPage() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients?.find((c) => c.projectId === projectId) ?? null;
  const activeDomain = client?.domain ?? null;

  const visibility = useVisibility(projectId);
  const prompts = useTrackedPrompts(projectId);
  const { data: market, isLoading: isMarketLoading } = useMarketIntelligence(projectId);
  const generateMarket = useGenerateMarket(projectId);

  const [activeTab, setActiveTab] = useState("trends");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const tabs = [
    { id: "trends", label: "Market Trends", icon: TrendingUp },
    { id: "sov", label: "Share of Voice", icon: PieChart },
    { id: "sentiment", label: "Sentiment Analysis", icon: MessageSquare },
    { id: "audience", label: "Audience Insights", icon: Users },
  ];

  const handleGenerate = async () => {
    if (!projectId) return;
    setStatusMessage(null);
    try {
      await generateMarket.mutateAsync();
      setStatusMessage("Market Intelligence report refreshed successfully!");
    } catch (err) {
      console.error(err);
      setStatusMessage(err instanceof Error ? err.message : "Failed to generate market report");
    }
  };

  const summary = visibility.data?.summary ?? null;
  const trendData =
    visibility.data?.trend?.map((t, i) => ({ week: `W${i + 1}`, share: t.citationSharePct })) ?? [];
  const sovData = visibility.data?.shareOfVoice ?? [];
  const byAssistant = visibility.data?.byAssistant ?? [];
  const trackedPrompts = prompts.data ?? [];
  const trendingTopics = market?.trendingTopics ?? [];

  const monitoredVolume = trackedPrompts.reduce((acc, p) => acc + (p.estimatedVolume ?? 0), 0);
  const brandRow = sovData[0] ?? null;
  const totalMentions = sovData.reduce((acc, s) => acc + s.mentions, 0);

  const sweepNeeds = [
    "At least one tracked prompt on this project",
    "A completed AI visibility sweep",
  ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Intelligence"
        subtitle={
          activeDomain
            ? `Trends, Sentiment, Audience Insights, and Share of Voice for ${activeDomain}.`
            : "Trends, Sentiment, Audience Insights, and Share of Voice."
        }
        actions={
          <ActionButton
            variant="primary"
            icon={generateMarket.isPending ? <Loader2 size={12} className="animate-spin" /> : <Zap size={12} />}
            onClick={handleGenerate}
            disabled={generateMarket.isPending || !projectId}
          >
            {generateMarket.isPending ? "Generating Report..." : "Generate Market Report"}
          </ActionButton>
        }
      />

      {statusMessage && (
        <StatusNote>{statusMessage}</StatusNote>
      )}

      <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">

          {!projectId ? (
            <NotConnected
              title="No project selected"
              what="Market intelligence is scoped to a single project so that one client's data is never mixed with another's."
              needs={["An active organization", "A selected project"]}
            />
          ) : visibility.isLoading || isMarketLoading ? (
            <Panel title="Loading">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-brand-200 mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Analyzing market intelligence data...</p>
              </div>
            </Panel>
          ) : (
            <>
              {/* ── TAB 1: MARKET TRENDS ── */}
              {activeTab === "trends" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Kpi
                      label="Citation Share"
                      value={summary ? `${summary.citationSharePct.toFixed(1)}%` : "—"}
                      sub="Current brand search presence"
                    />
                    <Kpi
                      label="Change vs Previous"
                      value={summary?.deltaPt != null ? `${summary.deltaPt > 0 ? "+" : ""}${summary.deltaPt.toFixed(1)} pt` : "—"}
                      sub="Versus the preceding period"
                    />
                    <Kpi
                      label="Checks Run"
                      value={summary ? summary.checked.toLocaleString() : "—"}
                      sub="Prompt/assistant checks this period"
                    />
                    <Kpi
                      label="Monitored Volume"
                      value={monitoredVolume > 0 ? monitoredVolume.toLocaleString() : "—"}
                      sub="Est. monthly volume of tracked prompts"
                    />
                  </div>

                  {trendData.length === 0 ? (
                    <NotConnected
                      title="No trend data yet"
                      what="Citation share over time appears once this project has completed at least one AI visibility sweep."
                      needs={sweepNeeds}
                    />
                  ) : (
                    <Panel title="Market Search Trends" subtitle="AI Citation Share over time">
                      <div className="h-64 mt-2 w-full p-2">
                        <ResponsiveContainer width="100%" height="100%">
                          <AreaChart data={trendData}>
                            <defs>
                              <linearGradient id="colorShare" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="var(--color-accent-600)" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="var(--color-accent-600)" stopOpacity={0} />
                              </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-line)" />
                            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-brand-500)" }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "var(--color-brand-500)" }} tickFormatter={(val) => `${val}%`} />
                            <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid var(--color-line)" }} />
                            <Area type="monotone" dataKey="share" stroke="var(--color-accent-600)" strokeWidth={2} fillOpacity={1} fill="url(#colorShare)" />
                          </AreaChart>
                        </ResponsiveContainer>
                      </div>
                    </Panel>
                  )}

                  <Panel title="Top Monitored Search Queries" subtitle="Tracked prompts driving market share">
                    {trackedPrompts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No prompts are tracked for this project yet. Add them from the AI visibility page.
                      </div>
                    ) : (
                      <Table minWidth={600}>
                        <thead>
                          <tr>
                            <Th>Search Query</Th>
                            <Th>Intent</Th>
                            <Th>Est. Monthly Volume</Th>
                            <Th>Cluster</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {trackedPrompts.map((prompt) => (
                            <Tr key={prompt.id}>
                              <Td><span className="font-medium text-brand-950">{prompt.text}</span></Td>
                              <Td>{prompt.intent ? <Pill>{prompt.intent}</Pill> : <span className="text-xs text-[var(--text-muted)]">—</span>}</Td>
                              <Td><Mono tone="soft">{prompt.estimatedVolume?.toLocaleString() ?? "—"}</Mono></Td>
                              <Td><span className="text-xs text-[var(--text-muted)]">{prompt.cluster ?? "—"}</span></Td>
                            </Tr>
                          ))}
                        </tbody>
                      </Table>
                    )}
                  </Panel>
                </div>
              )}

              {/* ── TAB 2: SHARE OF VOICE ── */}
              {activeTab === "sov" && (
                <div className="space-y-4">
                  {sovData.length === 0 ? (
                    <NotConnected
                      title="No share-of-voice data yet"
                      what="Share of voice is derived from which domains AI assistants cite for this project's tracked prompts."
                      needs={sweepNeeds}
                    />
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Kpi label="Brand Share" value={`${brandRow?.sharePct.toFixed(1) ?? "0.0"}%`} sub="Your share of voice" tone="good" />
                        <Kpi label="Total Mentions" value={totalMentions.toLocaleString()} sub="Citations across AI models" />
                        <Kpi label="Tracked Domains" value={sovData.length.toString()} sub="Your brand plus competitors" />
                      </div>

                      <Panel title="Share of Voice Breakdown" subtitle="Brand visibility across AI assistants and target queries">
                        <Table minWidth={600}>
                          <thead>
                            <tr>
                              <Th>Domain / Entity</Th>
                              <Th>Category</Th>
                              <Th>Mentions</Th>
                              <Th>Share %</Th>
                            </tr>
                          </thead>
                          <tbody>
                            {sovData.map((sov, i) => (
                              <Tr key={sov.domain ?? i}>
                                <Td><span className="font-medium text-brand-950">{sov.domain || "Unknown"}</span></Td>
                                <Td><Pill tone={i === 0 ? "good" : "default"}>{sov.label}</Pill></Td>
                                <Td><span className="text-[13px] text-brand-700">{sov.mentions}</span></Td>
                                <Td>
                                  <div className="flex items-center gap-3">
                                    <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                                      <div
                                        className={`h-full ${i === 0 ? "bg-blue-600" : "bg-gray-400"}`}
                                        style={{ width: `${Math.min(100, sov.sharePct)}%` }}
                                      />
                                    </div>
                                    <span className="text-[13px] font-medium text-brand-700">{sov.sharePct.toFixed(1)}%</span>
                                  </div>
                                </Td>
                              </Tr>
                            ))}
                          </tbody>
                        </Table>
                      </Panel>
                    </>
                  )}
                </div>
              )}

              {/* ── TAB 3: SENTIMENT ANALYSIS ── */}
              {activeTab === "sentiment" && (
                <div className="space-y-4">
                  {!market ? (
                    <NotConnected
                      title="No sentiment report yet"
                      what="Sentiment is produced by the market intelligence report for this project."
                      needs={["A completed crawl", 'Click "Generate Market Report" above']}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="card p-5 border border-[var(--border-color)] rounded-xl bg-[var(--surface-1)]">
                        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block mb-1">Sentiment Score</span>
                        <div className="flex items-baseline gap-2">
                          <span className="text-3xl font-bold text-[var(--text-primary)]">
                            {market.sentimentScore > 0 ? "+" : ""}{(market.sentimentScore * 100).toFixed(0)}%
                          </span>
                        </div>
                        <p className="text-xs text-[var(--text-muted)] mt-2">Evaluated from this project&apos;s market intelligence report.</p>
                      </div>

                      <div className="card p-5 border border-[var(--border-color)] rounded-xl bg-[var(--surface-1)] md:col-span-2">
                        <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block mb-1">Executive Summary</span>
                        <p className="text-sm text-[var(--text-primary)] leading-relaxed mt-1">
                          {market.sentimentSummary ?? "No summary was generated for this project yet."}
                        </p>
                      </div>
                    </div>
                  )}

                  <Panel title="AI Model Perception Matrix" subtitle="Citation share by AI assistant">
                    {byAssistant.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No assistant-level results yet. Run an AI visibility sweep for this project.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                        {byAssistant.map((item) => (
                          <div key={item.assistant} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-[var(--text-primary)]">{item.assistant}</span>
                              {item.cited > 0 && <CheckCircle2 size={15} className="text-emerald-500" />}
                            </div>
                            <span className="text-xl font-bold text-[var(--text-primary)] block">
                              {item.citationSharePct.toFixed(1)}%
                            </span>
                            <span className="text-xs text-[var(--text-muted)] block">
                              Cited in {item.cited} of {item.checked} checks
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              )}

              {/* ── TAB 4: AUDIENCE INSIGHTS ── */}
              {activeTab === "audience" && (
                <div className="space-y-4">
                  <Panel title="Trending Market Topics" subtitle="Emerging customer search interest & buyer intent">
                    {trendingTopics.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No trending topics yet. Generate a market report to populate this list.
                      </div>
                    ) : (
                      <div className="p-4 flex flex-wrap gap-2.5">
                        {trendingTopics.map((topic) => (
                          <div key={topic} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-primary)]">
                            <TrendingUp size={13} className="text-blue-500" />
                            {topic}
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel title="Prompt Intent Mix" subtitle="Tracked prompts grouped by search intent">
                    {trackedPrompts.length === 0 ? (
                      <div className="p-8 text-center text-xs text-[var(--text-muted)]">
                        No tracked prompts to group yet.
                      </div>
                    ) : (
                      <div className="p-4 flex flex-wrap gap-2.5">
                        {Object.entries(
                          trackedPrompts.reduce<Record<string, number>>((acc, p) => {
                            const key = p.intent ?? "Unclassified";
                            acc[key] = (acc[key] ?? 0) + 1;
                            return acc;
                          }, {}),
                        ).map(([intent, count]) => (
                          <div key={intent} className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-primary)]">
                            <Pill>{intent}</Pill>
                            <Mono tone="soft">{count}</Mono>
                          </div>
                        ))}
                      </div>
                    )}
                  </Panel>
                </div>
              )}
            </>
          )}

        </div>
      </div>
    </div>
  );
}
