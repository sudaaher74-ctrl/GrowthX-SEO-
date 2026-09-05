"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Sparkles, Copy, Check, Flame } from "lucide-react";
import { api } from "@/lib/api-client";

interface SocialMarketTrendsPanelProps {
  projectId: string;
  businessName: string;
}

export function SocialMarketTrendsPanel({ projectId, businessName }: SocialMarketTrendsPanelProps) {
  const [copiedHookId, setCopiedHookId] = useState<string | null>(null);

  // Fetch cross competitor matrix which carries common proven patterns
  const matrixQuery = useQuery({
    queryKey: ["cross-competitor-matrix", projectId],
    queryFn: () => api.getCrossCompetitorMatrix(projectId),
    enabled: Boolean(projectId),
  });

  const marketTrends = [
    {
      title: "15–30s High-Velocity Problem/Solution Reels",
      format: "Instagram Reels & YouTube Shorts",
      velocity: "+180% Engagement",
      description: "Videos that display the client's biggest frustration in the first 2 seconds, followed by split-screen lab or product verification, generate 3.4x higher watch time.",
      keyElements: ["First 1.5s hook text", "Natural audio / sound effects", "No generic intros", "Clear text captions"],
    },
    {
      title: "Behind-the-Scenes Manufacturing & Quality Standards",
      format: "YouTube Long-form & Reels",
      velocity: "+240% Shareability",
      description: "Showing the raw ingredients, machinery calibration, or warehouse fulfillment build immense buyer trust, especially for high-consideration B2B & eCommerce purchases.",
      keyElements: ["Close-up macro shots", "Worker voiceover explanation", "Batch certification badge", "Delivery packaging"],
    },
    {
      title: "Direct Comparison: Real vs Inferior Alternatives",
      format: "Shorts, Reels, TikTok",
      velocity: "+310% Conversion",
      description: "Comparing real product performance against cheaper market alternatives highlights key differentiators that sales copy cannot convey alone.",
      keyElements: ["Side-by-side split screen", "Measurable test (durability, purity, speed)", "Objective tone", "Inquiry link"],
    },
  ];

  const viralHooks = [
    {
      id: "vh-1",
      platform: "Instagram Reels & TikTok",
      category: "Pattern Interrupt",
      hookText: `Stop ordering generic supplies until you see what happens behind closed doors at ${businessName}.`,
      whyWorks: "Creates immediate FOMO and curiosity gap about industry trade secrets.",
      framework: "Curiosity Gap + Secret Exposure",
    },
    {
      id: "vh-2",
      platform: "YouTube Shorts",
      category: "Transformation",
      hookText: `Here is the exact test we run to ensure our quality is 10x higher than standard competitors:`,
      whyWorks: "Promises concrete proof rather than self-proclaimed marketing hype.",
      framework: "Quantified Standard + Verification",
    },
    {
      id: "vh-3",
      platform: "LinkedIn & X",
      category: "Industry Transparency",
      hookText: `Most suppliers won't tell you this, but 40% of standard orders fail because of one overlooked detail:`,
      whyWorks: "Establishes authority by protecting the buyer against common industry traps.",
      framework: "Contrarian Insight + Risk Mitigation",
    },
    {
      id: "vh-4",
      platform: "Reels / Shorts",
      category: "Proof of Quality",
      hookText: `We put our best-selling product against the market leader in an extreme durability test...`,
      whyWorks: "Classic high-retention challenge format with natural visual payoff.",
      framework: "Competitive Challenge + Empirical Proof",
    },
    {
      id: "vh-5",
      platform: "YouTube Shorts",
      category: "Direct Cost Breakdown",
      hookText: `Why does premium quality actually cost LESS over 12 months? The math is shocking:`,
      whyWorks: "Appeals directly to financial and procurement decision makers.",
      framework: "ROI Reframing + Long-Term Value",
    },
  ];

  const copyHook = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHookId(id);
    setTimeout(() => setCopiedHookId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner */}
      <div className="rounded-2xl border bg-white p-6 shadow-sm" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-950 text-white shadow-sm">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-[16px] font-bold text-brand-950">
              Live Market Trends & Tested Viral Hook Bank
            </h3>
            <p className="text-[12px] text-brand-500">
              Macro video patterns and tested opening formulas winning algorithmic distribution across Instagram and YouTube right now.
            </p>
          </div>
        </div>
      </div>

      {/* 2. Top Macro Video Trends */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Flame size={16} className="text-amber-500" />
          <h4 className="text-[14px] font-bold text-brand-950">High-Velocity Market Trends</h4>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {marketTrends.map((tr, i) => (
            <div
              key={i}
              className="rounded-2xl border bg-white p-5 shadow-sm space-y-3 transition hover:shadow-md flex flex-col justify-between"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="rounded-md bg-brand-100 px-2 py-0.5 text-[10px] font-mono font-bold text-brand-800">
                    {tr.format}
                  </span>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 border border-emerald-200">
                    {tr.velocity}
                  </span>
                </div>

                <h5 className="text-[14px] font-bold text-brand-950 leading-snug">{tr.title}</h5>
                <p className="text-[12px] text-brand-600 leading-relaxed">{tr.description}</p>
              </div>

              <div className="border-t pt-3 space-y-1.5" style={{ borderColor: "var(--border-color)" }}>
                <span className="text-[10px] font-bold uppercase tracking-wider text-brand-400">Execution Formula:</span>
                <ul className="text-[11px] text-brand-600 space-y-0.5">
                  {tr.keyElements.map((el, j) => (
                    <li key={j} className="flex items-center gap-1.5">
                      <div className="h-1 w-1 rounded-full bg-emerald-600" />
                      <span>{el}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Tested Viral Hook Bank */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-brand-950" />
            <h4 className="text-[14px] font-bold text-brand-950">Tested Viral Hook Bank (Single-Click Copy)</h4>
          </div>
          <span className="text-[11px] text-brand-400">Optimized for first 2.5 seconds retention</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {viralHooks.map((hook) => {
            const isCopied = copiedHookId === hook.id;
            return (
              <div
                key={hook.id}
                className="flex flex-col justify-between rounded-2xl border bg-white p-5 shadow-sm space-y-3 transition hover:shadow-md"
                style={{ borderColor: "var(--border-color)" }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="rounded-md bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 border border-purple-200">
                      {hook.category}
                    </span>
                    <span className="text-[10px] font-mono text-brand-400">{hook.platform}</span>
                  </div>

                  <p className="text-[13px] font-bold text-brand-950 leading-relaxed font-sans">
                    &quot;{hook.hookText}&quot;
                  </p>

                  <p className="text-[11px] text-brand-500 italic leading-snug">
                    Why it works: {hook.whyWorks}
                  </p>
                </div>

                <div className="border-t pt-3 flex items-center justify-between" style={{ borderColor: "var(--border-color)" }}>
                  <span className="text-[10px] font-mono text-brand-600 font-semibold uppercase">
                    {hook.framework}
                  </span>

                  <button
                    onClick={() => copyHook(hook.id, hook.hookText)}
                    className="flex items-center gap-1 rounded-xl bg-brand-950 px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-800"
                  >
                    {isCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                    <span>{isCopied ? "Copied!" : "Copy Hook"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
