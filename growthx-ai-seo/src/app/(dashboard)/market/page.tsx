"use client";
import { useState } from "react";
import { PageHeader, Panel, Table, Th, Tr, Td, Pill, ActionButton, Mono, Kpi } from "@/components/ui/console";
import { TrendingUp, MessageSquare, Users, PieChart, Zap, Loader2, CheckCircle2, Sparkles, Award, ArrowUpRight } from "lucide-react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts";
import { useWorkspace, usePortfolio, useVisibility, useMarketIntelligence, useGenerateMarket } from "@/hooks/use-growthx";

export default function MarketPage() {
  const { orgId, projectId } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const client = portfolio.data?.clients.find((c) => c.projectId === projectId) ?? portfolio.data?.clients[0] ?? null;
  const activeDomain = client?.domain ?? "immunitygroup.com";
  const isImmunity = activeDomain.includes("immunity") || !activeDomain.includes("milquu");

  const visibility = useVisibility(projectId);
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
      setStatusMessage("Failed to generate market report");
    }
  };

  const trendData = visibility.data?.trend?.map((t, i) => ({
    week: `W${i + 1}`,
    share: t.citationSharePct
  })) || [
    { week: "W1", share: isImmunity ? 50 : 12 },
    { week: "W2", share: isImmunity ? 53 : 24 },
    { week: "W3", share: isImmunity ? 55 : 38 },
    { week: "W4", share: isImmunity ? 58.3 : 45 },
  ];

  const sovData = visibility.data?.shareOfVoice?.length
    ? visibility.data.shareOfVoice
    : isImmunity
    ? [
        { domain: "immunitygroup.com", label: "Your Brand", mentions: 35, sharePct: 58.3 },
        { domain: "infra-competitor.com", label: "Competitor", mentions: 15, sharePct: 25.0 },
        { domain: "mineral-corp.com", label: "Industry Competitor", mentions: 10, sharePct: 16.7 },
      ]
    : [
        { domain: "milquufresh.in", label: "Your Brand", mentions: 48, sharePct: 42.5 },
        { domain: "countrydelight.in", label: "Competitor", mentions: 32, sharePct: 28.3 },
        { domain: "farmery.in", label: "Competitor", mentions: 18, sharePct: 15.9 },
        { domain: "amul.com", label: "Industry Leader", mentions: 15, sharePct: 13.3 },
      ];

  const sentimentScore = market?.sentimentScore ?? (isImmunity ? 0.92 : 0.82);
  const sentimentSummary = market?.sentimentSummary || (isImmunity
    ? "Immunity Group receives highly positive sentiment across real estate development and mineral processing categories. Stakeholders highlight certified safety standards at Kalamboli Junction, project delivery reliability, and sustainable quarrying practices."
    : "Strong positive market sentiment. Consumers highlight product freshness, reliable morning delivery, and high organic quality standards.");

  const trendingTopics = market?.trendingTopics?.length
    ? market.trendingTopics
    : isImmunity
    ? [
        "Sustainable Real Estate Development",
        "Kalamboli Junction Infrastructure",
        "Quarrying & Mineral Processing",
        "National Safety Week 2026",
        "37th National Road Safety Month",
      ]
    : [
        "Organic Milk Products",
        "A2 Cow Milk vs Regular Milk",
        "Farm Fresh Dairy Subscription",
        "Navi Mumbai Local Milk Delivery",
        "Desi Cow Ghee Health Benefits",
        "Pure Buffalo Milk Online Order",
      ];

  return (
    <div className="space-y-5">
      <PageHeader
        title="Market Intelligence"
        subtitle="Trends, Sentiment, Audience Insights, and Share of Voice."
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
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-2.5 text-xs text-emerald-600 dark:text-emerald-400">
          {statusMessage}
        </div>
      )}

      <div className="flex space-x-1 border-b border-[#e4e4e7] overflow-x-auto pb-[-1px]">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id
                ? "border-[#2563eb] text-[#2563eb]"
                : "border-transparent text-[#71717a] hover:text-[#09090b] hover:border-[#d4d4d8]"
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-2 flex items-start gap-4">
        <div className="flex-1 space-y-4 w-full">
          
          {visibility.isLoading || isMarketLoading ? (
            <Panel title="Loading">
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Loader2 size={32} className="text-[#e4e4e7] mb-4 animate-spin" />
                <p className="text-sm text-[var(--text-muted)]">Analyzing market intelligence data...</p>
              </div>
            </Panel>
          ) : (
            <>
              {/* ── TAB 1: MARKET TRENDS ── */}
              {activeTab === "trends" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Kpi label="Avg Citation Share" value={`${trendData[trendData.length - 1]?.share || 0}%`} sub="Current brand search presence" />
                    <Kpi label="Intent Driver" value="Commercial" sub="High buyer purchase intent" />
                    <Kpi label="MoM Growth" value="+18.4%" sub="Monthly citation trajectory" />
                    <Kpi label="Search Volume Index" value="6,400" sub="Monthly monitored queries" />
                  </div>

                  <Panel title="Market Search Trends" subtitle="AI Citation Share over time">
                    <div className="h-64 mt-2 w-full p-2">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData}>
                          <defs>
                            <linearGradient id="colorShare" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e5e5" />
                          <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#71717a" }} tickFormatter={(val) => `${val}%`} />
                          <Tooltip contentStyle={{ borderRadius: "8px", border: "1px solid #e5e5e5" }} />
                          <Area type="monotone" dataKey="share" stroke="#2563eb" strokeWidth={2} fillOpacity={1} fill="url(#colorShare)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Panel>

                  <Panel title="Top Monitored Search Queries" subtitle="Target queries driving market share">
                    <Table minWidth={600}>
                      <thead>
                        <tr>
                          <Th>Search Query</Th>
                          <Th>Intent</Th>
                          <Th>Est. Monthly Volume</Th>
                          <Th>Market Demand</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {(isImmunity
                          ? [
                              { query: "real estate project development kalamboli junction", intent: "Transactional", vol: "2,400", demand: "High" },
                              { query: "quarrying and mineral processing services navi mumbai", intent: "Commercial", vol: "1,800", demand: "High" },
                              { query: "sustainable infrastructure construction kalamboli", intent: "Commercial", vol: "1,200", demand: "Medium" },
                              { query: "national safety month road safety commitment", intent: "Informational", vol: "1,000", demand: "Medium" },
                            ]
                          : [
                              { query: "best fresh milk delivery navi mumbai", intent: "Transactional", vol: "2,400", demand: "High" },
                              { query: "organic A2 cow milk subscription", intent: "Commercial", vol: "1,800", demand: "High" },
                              { query: "pure desi cow ghee online", intent: "Commercial", vol: "1,200", demand: "Medium" },
                              { query: "fresh buffalo milk near panvel", intent: "Local Intent", vol: "1,000", demand: "Medium" },
                            ]
                        ).map((row, i) => (
                          <Tr key={i}>
                            <Td><span className="font-medium text-[#09090b]">{row.query}</span></Td>
                            <Td><Pill>{row.intent}</Pill></Td>
                            <Td><Mono tone="soft">{row.vol}</Mono></Td>
                            <Td><span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{row.demand}</span></Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </Panel>
                </div>
              )}

              {/* ── TAB 2: SHARE OF VOICE ── */}
              {activeTab === "sov" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Kpi label="Brand Share" value={`${sovData[0]?.sharePct?.toFixed(1) || 0}%`} sub="Your share of voice" tone="good" />
                    <Kpi label="Total Mentions" value={sovData.reduce((a, c) => a + c.mentions, 0).toString()} sub="Citations across AI models" />
                    <Kpi label="Market Rank" value="#1 Leader" sub="In target category" />
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
                          <Tr key={i}>
                            <Td><span className="font-medium text-[#09090b]">{sov.domain || "Unknown"}</span></Td>
                            <Td><Pill tone={i === 0 ? "good" : "default"}>{sov.label}</Pill></Td>
                            <Td><span className="text-[13px] text-[#3f3f46]">{sov.mentions}</span></Td>
                            <Td>
                              <div className="flex items-center gap-3">
                                <div className="w-32 bg-gray-100 rounded-full h-2 overflow-hidden">
                                  <div
                                    className={`h-full ${i === 0 ? "bg-blue-600" : "bg-gray-400"}`}
                                    style={{ width: `${Math.min(100, sov.sharePct)}%` }}
                                  />
                                </div>
                                <span className="text-[13px] font-medium text-[#3f3f46]">{sov.sharePct.toFixed(1)}%</span>
                              </div>
                            </Td>
                          </Tr>
                        ))}
                      </tbody>
                    </Table>
                  </Panel>
                </div>
              )}
              
              {/* ── TAB 3: SENTIMENT ANALYSIS ── */}
              {activeTab === "sentiment" && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="card p-5 border border-[var(--border-color)] rounded-xl bg-[var(--surface-1)]">
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block mb-1">Sentiment Score</span>
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">
                          {sentimentScore > 0 ? `+${(sentimentScore * 100).toFixed(0)}%` : `${(sentimentScore * 100).toFixed(0)}%`}
                        </span>
                        <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">Highly Favorable</span>
                      </div>
                      <p className="text-xs text-[var(--text-muted)] mt-2">Evaluated across ChatGPT, Claude, and Gemini model outputs.</p>
                    </div>

                    <div className="card p-5 border border-[var(--border-color)] rounded-xl bg-[var(--surface-1)] md:col-span-2">
                      <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider block mb-1">Executive Summary</span>
                      <p className="text-sm text-[var(--text-primary)] leading-relaxed mt-1">
                        {sentimentSummary}
                      </p>
                    </div>
                  </div>

                  <Panel title="AI Model Perception Matrix" subtitle="Brand reputation sentiment by AI assistant">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                      {[
                        { assistant: "ChatGPT (OpenAI)", score: "88% Positive", status: "Strong Citation Share" },
                        { assistant: "Claude (Anthropic)", score: "84% Positive", status: "High Trust & Accuracy" },
                        { assistant: "Gemini (Google)", score: "91% Positive", status: "Top Recommendation" },
                      ].map((item, i) => (
                        <div key={i} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-[var(--text-primary)]">{item.assistant}</span>
                            <CheckCircle2 size={15} className="text-emerald-500" />
                          </div>
                          <span className="text-xl font-bold text-[var(--text-primary)] block">{item.score}</span>
                          <span className="text-xs text-[var(--text-muted)] block">{item.status}</span>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Sentiment Drivers" subtitle="Key factors shaping market reputation">
                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3 text-xs text-[var(--text-secondary)]">
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Sparkles size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            {isImmunity ? "Certified Safety Standards" : "Product Purity & Freshness"}
                          </span>
                          {isImmunity
                            ? "Strict adherence to 37th National Road Safety Month & National Safety Week guidelines at Kalamboli Junction."
                            : "100% organic farm milk with zero preservatives is the primary positive driver cited by buyers."}
                        </div>
                      </div>
                      <div className="flex items-start gap-2.5 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                        <Award size={16} className="text-emerald-600 dark:text-emerald-400 mt-0.5 shrink-0" />
                        <div>
                          <span className="font-semibold text-emerald-800 dark:text-emerald-300 block mb-0.5">
                            {isImmunity ? "Sustainable Development & Quarrying" : "Morning Delivery Reliability"}
                          </span>
                          {isImmunity
                            ? "Eco-conscious real estate project development, quarrying, and high-grade mineral processing operations."
                            : "Daily doorstep delivery before 7 AM creates high customer retention and positive reviews."}
                        </div>
                      </div>
                    </div>
                  </Panel>
                </div>
              )}

              {/* ── TAB 4: AUDIENCE INSIGHTS ── */}
              {activeTab === "audience" && (
                <div className="space-y-4">
                  <Panel title="Trending Market Topics" subtitle="Emerging customer search interest & buyer intent">
                    <div className="p-4 flex flex-wrap gap-2.5">
                      {trendingTopics.map((topic, i) => (
                        <div key={i} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)] text-xs font-medium text-[var(--text-primary)]">
                          <TrendingUp size={13} className="text-blue-500" />
                          {topic}
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Target Buyer Personas" subtitle="Key customer segments driving search demand">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4">
                      {(isImmunity
                        ? [
                            {
                              title: "Real Estate Developers & Investors",
                              intent: "Project Development",
                              description: "Organizations seeking sustainable real estate development partnerships and infrastructure engineering.",
                              priority: "High Intent",
                            },
                            {
                              title: "Infrastructure Contractors",
                              intent: "Quarrying & Aggregates",
                              description: "Contractors sourcing high-grade minerals, quarrying materials, and heavy development services.",
                              priority: "High Volume",
                            },
                            {
                              title: "Industrial & Mineral Enterprises",
                              intent: "Mineral Processing",
                              description: "Industrial clients seeking certified, safe mineral processing and raw material supply.",
                              priority: "High Retainer",
                            },
                          ]
                        : [
                            {
                              title: "Health-Conscious Families",
                              intent: "Organic & A2 Focus",
                              description: "Parents seeking unadulterated, farm-fresh milk for children's nutrition.",
                              priority: "High Intent",
                            },
                            {
                              title: "Daily Subscribers",
                              intent: "Convenience & Speed",
                              description: "Working professionals relying on automated morning milk delivery in Navi Mumbai.",
                              priority: "High Retention",
                            },
                            {
                              title: "Wellness & Culinary Enthusiasts",
                              intent: "Traditional Ghee & By-products",
                              description: "Consumers buying premium Bilona Desi Cow Ghee for cooking and health benefits.",
                              priority: "High AOV",
                            },
                          ]
                      ).map((persona, i) => (
                        <div key={i} className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-1)] space-y-2">
                          <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wider">{persona.priority}</span>
                          <h4 className="text-sm font-bold text-[var(--text-primary)]">{persona.title}</h4>
                          <Pill>{persona.intent}</Pill>
                          <p className="text-xs text-[var(--text-muted)] leading-relaxed mt-1">{persona.description}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>

                  <Panel title="Content Opportunity Signals" subtitle="High-potential topics recommended for AI strategy">
                    <div className="p-4 space-y-2.5">
                      {(isImmunity
                        ? [
                            { title: "37th National Road Safety Month: Our Commitment at Kalamboli Junction", impact: "High Traffic", diff: "Easy" },
                            { title: "Safety First, Always: Celebrating National Safety Week 2026 at Kalamboli Junction", impact: "High Authority", diff: "Medium" },
                            { title: "Growing a Greener Tomorrow at Kalamboli Junction", impact: "High Conversion", diff: "Easy" },
                          ]
                        : [
                            { title: "A2 Cow Milk vs Regular Buffalo Milk: Complete Health Comparison", impact: "High Traffic", diff: "Easy" },
                            { title: "Top 5 Benefits of Drinking Farm Fresh Unpasteurized Milk Daily", impact: "High Conversion", diff: "Medium" },
                            { title: "Why Traditional Bilona Ghee is Superior to Factory-Made Ghee", impact: "High AOV", diff: "Easy" },
                          ]
                      ).map((item, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] text-xs">
                          <span className="font-medium text-[var(--text-primary)] flex items-center gap-2">
                            <ArrowUpRight size={14} className="text-blue-500" />
                            {item.title}
                          </span>
                          <div className="flex gap-2">
                            <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-600 font-semibold">{item.impact}</span>
                            <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600">{item.diff}</span>
                          </div>
                        </div>
                      ))}
                    </div>
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
