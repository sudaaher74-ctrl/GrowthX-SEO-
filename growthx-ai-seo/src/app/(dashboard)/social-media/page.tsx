"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Share2,
  Video,
  Sparkles,
  TrendingUp,
  Calendar,
  Flame,
  Copy,
  Check,
  Zap,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/ui/console";
import { useWorkspace, usePortfolio, useStrategies, useStrategy, useGenerateStrategy } from "@/hooks/use-growthx";
import { api } from "@/lib/api-client";

interface SocialChannel {
  platform: string;
  name: string;
  iconColor: string;
  handle: string | null;
  status: "connected" | "detected" | "not_connected";
  followers?: string;
  postsPerWeek?: number;
}

export default function SocialMediaPage() {
  const { projectId, orgId, projects } = useWorkspace();
  const portfolio = usePortfolio(orgId);
  const selectedProject = projects.find((p) => p.id === projectId) ?? projects[0] ?? null;
  const clientRow = portfolio.data?.clients.find((c) => c.projectId === selectedProject?.id) ?? null;
  const businessName = selectedProject?.name || "Your Brand";
  const domain = clientRow?.domain || "yourdomain.com";

  const [activeTab, setActiveTab] = useState<"strategy" | "competitors" | "calendar">("strategy");
  const [copiedHookId, setCopiedHookId] = useState<string | null>(null);

  // Strategy Queries & Mutations
  const strategies = useStrategies(projectId);
  const activeStrategyId = strategies.data?.[0]?.id ?? null;
  const strategyReport = useStrategy(projectId, activeStrategyId);
  const generateStrategyMutation = useGenerateStrategy(projectId);

  // Competitor Query
  const competitorsQuery = useQuery({
    queryKey: ["tracked-competitors", projectId],
    queryFn: () => (projectId ? api.listCompetitors(projectId) : Promise.resolve([])),
    enabled: Boolean(projectId),
    retry: false,
  });

  const channels: SocialChannel[] = [
    {
      platform: "Instagram",
      name: "Instagram",
      iconColor: "bg-pink-500",
      handle: `@${domain.split(".")[0]}`,
      status: "connected",
      followers: "12.4K",
      postsPerWeek: 4,
    },
    {
      platform: "YouTube",
      name: "YouTube Shorts / Video",
      iconColor: "bg-red-500",
      handle: `${businessName} Official`,
      status: "connected",
      followers: "5.8K",
      postsPerWeek: 2,
    },
    {
      platform: "LinkedIn",
      name: "LinkedIn Company",
      iconColor: "bg-blue-600",
      handle: businessName,
      status: "detected",
      followers: "2.1K",
      postsPerWeek: 3,
    },
    {
      platform: "TikTok",
      name: "TikTok",
      iconColor: "bg-slate-900",
      handle: `@${domain.split(".")[0]}`,
      status: "detected",
      followers: "18.9K",
      postsPerWeek: 5,
    },
    {
      platform: "X",
      name: "X (Twitter)",
      iconColor: "bg-slate-800",
      handle: `@${domain.split(".")[0]}`,
      status: "not_connected",
      postsPerWeek: 0,
    },
  ];

  const curatedViralHooks = [
    {
      id: "hook-1",
      platform: "Instagram & TikTok",
      category: "Pattern Interrupt",
      hookText: `Stop buying generic products until you see what happens behind the scenes at ${businessName}.`,
      framework: "Curiosity Gap + Secret Exposure",
      projectedCtr: "High Velocity",
    },
    {
      id: "hook-2",
      platform: "YouTube Shorts",
      category: "Transformation",
      hookText: `Here is the #1 mistake 90% of customers make when choosing quality — and how we solved it.`,
      framework: "Loss Aversion + Direct Solution",
      projectedCtr: "Strong Retention",
    },
    {
      id: "hook-3",
      platform: "LinkedIn & X",
      category: "Industry Transparency",
      hookText: `Why the standard industry supply chain is broken and why building direct-to-consumer changes everything:`,
      framework: "Contrarian Insight + Authority",
      projectedCtr: "Viral Engagement",
    },
    {
      id: "hook-4",
      platform: "Reels / Shorts",
      category: "Proof of Quality",
      hookText: `We put our top product against the market leader. The lab results were completely unexpected...`,
      framework: "Competitive Challenge + Proof",
      projectedCtr: "Ultra-High Shareability",
    },
  ];

  const handleCopyHook = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHookId(id);
    setTimeout(() => setCopiedHookId(null), 2000);
  };

  const competitors = competitorsQuery.data || [];
  const socialStrategyData = strategyReport.data?.content?.socialStrategy || [];

  return (
    <div className="space-y-6 pb-12">
      {/* Top Header */}
      <PageHeader
        title="Social Media Intelligence"
        subtitle={`Multi-channel social strategy, viral hooks, and competitor presence for ${businessName}.`}
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => generateStrategyMutation.mutate()}
              disabled={generateStrategyMutation.isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-950 px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-brand-900 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Sparkles size={13} className={generateStrategyMutation.isPending ? "animate-spin" : "text-amber-400"} />
              <span>{generateStrategyMutation.isPending ? "Generating Strategy..." : "Regenerate AI Social Strategy"}</span>
            </button>
          </div>
        }
      />

      {/* Connected Channel Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
        {channels.map((ch) => (
          <div
            key={ch.platform}
            className="rounded-xl border border-brand-200 bg-white p-3 shadow-2xs hover:border-brand-300 transition"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-950 flex items-center gap-1.5">
                <span className={`h-2 w-2 rounded-full ${ch.iconColor}`} />
                {ch.name}
              </span>
              <span
                className={`text-[9.5px] font-semibold px-1.5 py-0.2 rounded ${
                  ch.status === "connected"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : ch.status === "detected"
                    ? "bg-blue-50 text-blue-700 border border-blue-200"
                    : "bg-brand-50 text-brand-500 border border-brand-200"
                }`}
              >
                {ch.status === "connected" ? "Connected" : ch.status === "detected" ? "Detected" : "Unlinked"}
              </span>
            </div>

            <div className="mt-2 text-[12px] font-mono font-bold text-brand-800 truncate">
              {ch.handle || "—"}
            </div>

            <div className="mt-1 flex items-center justify-between text-[10.5px] text-brand-500">
              <span>{ch.followers ? `${ch.followers} followers` : "No public stats"}</span>
              {ch.postsPerWeek ? (
                <span className="text-brand-700 font-semibold">{ch.postsPerWeek}/wk target</span>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {/* Nav Tabs */}
      <div className="flex items-center gap-2 border-b border-brand-200 pb-2">
        <button
          type="button"
          onClick={() => setActiveTab("strategy")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
            activeTab === "strategy"
              ? "bg-brand-950 text-white shadow-2xs"
              : "text-brand-600 hover:text-brand-950 hover:bg-brand-100"
          }`}
        >
          <Sparkles size={13} />
          <span>Viral Hooks & Content Strategy</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("competitors")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
            activeTab === "competitors"
              ? "bg-brand-950 text-white shadow-2xs"
              : "text-brand-600 hover:text-brand-950 hover:bg-brand-100"
          }`}
        >
          <Video size={13} />
          <span>Competitor Social Footprint</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("calendar")}
          className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-semibold transition cursor-pointer ${
            activeTab === "calendar"
              ? "bg-brand-950 text-white shadow-2xs"
              : "text-brand-600 hover:text-brand-950 hover:bg-brand-100"
          }`}
        >
          <Calendar size={13} />
          <span>Publishing Cadence & Schedule</span>
        </button>
      </div>

      {/* ── TAB 1: Viral Hooks & Social Strategy ────────────────────────── */}
      {activeTab === "strategy" && (
        <div className="space-y-5">
          {/* AI Tailored Platform Strategy */}
          {socialStrategyData.length > 0 && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-4 space-y-3">
              <div className="flex items-center gap-2 text-brand-950 font-bold text-[13px]">
                <CheckCircle2 size={15} className="text-indigo-600" />
                <span>AI Social Growth Strategy for {businessName}</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {socialStrategyData.map((item, idx) => (
                  <div key={idx} className="rounded-lg border border-indigo-100 bg-white p-3 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between font-bold text-[12px] text-brand-950">
                      <span>{item.platform}</span>
                      <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded border border-indigo-200">
                        {item.cadence}
                      </span>
                    </div>
                    <p className="text-[11px] text-brand-600 leading-snug">{item.why}</p>
                    <div className="pt-1 flex flex-wrap gap-1">
                      {item.contentThemes?.map((theme, tIdx) => (
                        <span key={tIdx} className="text-[9.5px] bg-brand-50 text-brand-700 px-1.5 py-0.5 rounded border border-brand-100 font-medium">
                          {theme}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Viral Hook Bank */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[14px] text-brand-950 flex items-center gap-1.5">
                  <Flame size={15} className="text-amber-500" />
                  <span>High-Converting Viral Hook Bank</span>
                </h3>
                <p className="text-[11.5px] text-brand-500">
                  Ready-to-use opening lines tested across short-form videos to capture viewer attention in the first 3 seconds.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {curatedViralHooks.map((h) => (
                <div
                  key={h.id}
                  className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-3 flex flex-col justify-between hover:border-brand-300 transition"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-500 bg-brand-50 px-2 py-0.5 rounded border border-brand-200">
                        {h.category}
                      </span>
                      <span className="text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                        {h.projectedCtr}
                      </span>
                    </div>

                    <div className="text-[12.5px] font-medium text-brand-950 leading-relaxed">
                      &ldquo;{h.hookText}&rdquo;
                    </div>

                    <div className="text-[10.5px] text-brand-500 font-mono">
                      Formula: {h.framework} · {h.platform}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-brand-100 flex items-center justify-between">
                    <span className="text-[10.5px] text-brand-400">Click to copy text</span>
                    <button
                      type="button"
                      onClick={() => handleCopyHook(h.id, h.hookText)}
                      className="inline-flex items-center gap-1 rounded-md bg-brand-50 hover:bg-brand-100 px-2 py-1 text-[11px] font-semibold text-brand-800 transition cursor-pointer"
                    >
                      {copiedHookId === h.id ? (
                        <>
                          <Check size={11} className="text-emerald-600" />
                          <span className="text-emerald-700">Copied!</span>
                        </>
                      ) : (
                        <>
                          <Copy size={11} />
                          <span>Copy Hook</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Content Pillar Framework */}
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-3">
            <h4 className="font-bold text-[13px] text-brand-950 flex items-center gap-1.5">
              <Zap size={14} className="text-brand-700" />
              <span>Recommended E-Commerce Social Content Mix (70 / 20 / 10 Rule)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">70% Value & Education</span>
                <h5 className="font-bold text-[12px] text-brand-900">Problem Solving & Tips</h5>
                <p className="text-[11px] text-brand-600 leading-snug">
                  Educate buyers on purity, freshness, nutrition, or craft before pitching any products.
                </p>
              </div>

              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">20% Social Proof</span>
                <h5 className="font-bold text-[12px] text-brand-900">Unboxings & Testimonials</h5>
                <p className="text-[11px] text-brand-600 leading-snug">
                  Real customer reactions, doorstep deliveries, and unboxing textures that validate authenticity.
                </p>
              </div>

              <div className="rounded-lg border border-brand-100 bg-brand-50/40 p-3 space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">10% Direct Offer</span>
                <h5 className="font-bold text-[12px] text-brand-900">Special Promos & Bundles</h5>
                <p className="text-[11px] text-brand-600 leading-snug">
                  Limited time bundle deals, trial kits, or seasonal subscription offers.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: Competitor Social Footprint ─────────────────────────── */}
      {activeTab === "competitors" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[14px] text-brand-950 flex items-center gap-1.5">
                  <Video size={15} className="text-brand-900" />
                  <span>Competitor Social Benchmarks</span>
                </h3>
                <p className="text-[11.5px] text-brand-500">
                  Compare how rivals are positioning their social channels against {businessName}.
                </p>
              </div>
            </div>

            {competitors.length === 0 ? (
              <div className="py-8 text-center rounded-lg border border-dashed border-brand-200 bg-brand-50/30 p-6 space-y-2">
                <Video size={28} className="mx-auto text-brand-400" />
                <h4 className="font-bold text-[13px] text-brand-900">No competitors tracked yet</h4>
                <p className="text-[11.5px] text-brand-500 max-w-md mx-auto">
                  Add competitors in Competitor Intelligence to automatically track their linked social accounts and multi-channel footprint.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {competitors.map((comp) => (
                  <div key={comp.id} className="rounded-lg border border-brand-200 bg-white p-3 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-bold text-brand-950">
                      <span>{comp.name || comp.domain}</span>
                      <span className="text-[10px] text-brand-500 font-mono">{comp.domain}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                        Crawl Monitored
                      </span>
                      {comp.label && (
                        <span className="text-[10px] text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded border border-brand-200">
                          {comp.label}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── TAB 3: Publishing Cadence & Schedule ───────────────────────── */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-200 bg-white p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-[14px] text-brand-950 flex items-center gap-1.5">
                  <Calendar size={15} className="text-brand-900" />
                  <span>Weekly Social Publishing Schedule</span>
                </h3>
                <p className="text-[11.5px] text-brand-500">
                  Optimal posting schedule to maximize organic reach and algorithm favorability.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-7 gap-2 text-center">
              {[
                { day: "Mon", type: "Short / Reel", topic: "Product Highlight", time: "11:00 AM" },
                { day: "Tue", type: "Carousel", topic: "Educational Tip", time: "04:30 PM" },
                { day: "Wed", type: "Short / Reel", topic: "Customer Reaction", time: "12:00 PM" },
                { day: "Thu", type: "Single Image / Post", topic: "Behind the Scenes", time: "05:00 PM" },
                { day: "Fri", type: "Short / Reel", topic: "Weekly Recipe / Use Case", time: "02:00 PM" },
                { day: "Sat", type: "Offer / Story", topic: "Weekend Delivery Reminder", time: "10:00 AM" },
                { day: "Sun", type: "Rest / Community", topic: "Poll / Q&A", time: "07:00 PM" },
              ].map((slot) => (
                <div key={slot.day} className="rounded-lg border border-brand-200 bg-brand-50/40 p-2.5 space-y-1 text-left">
                  <div className="flex items-center justify-between font-bold text-[11px] text-brand-900">
                    <span>{slot.day}</span>
                    <span className="text-[9px] text-brand-500 font-mono">{slot.time}</span>
                  </div>
                  <div className="text-[10px] font-semibold text-brand-700 bg-white px-1.5 py-0.5 rounded border border-brand-200 truncate">
                    {slot.type}
                  </div>
                  <div className="text-[10px] text-brand-600 line-clamp-2">{slot.topic}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
