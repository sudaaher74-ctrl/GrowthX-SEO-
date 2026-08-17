"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Brain, Sparkles, TrendingUp, Eye, Zap, ChevronRight,
  BarChart3, Target, Users, Calendar, Crosshair, Layers,
  ArrowUpRight, Play, RefreshCw, Settings
} from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { useWorkspace } from "@/hooks/use-growthx";
import { PageHeader } from "@/components/ui/console";

const PILLAR_COLORS: Record<string, string> = {
  PRODUCT: "#6366f1",
  EDUCATIONAL: "#0ea5e9",
  LIFESTYLE: "#8b5cf6",
  CREATOR: "#f59e0b",
  PROMOTIONAL: "#ef4444",
  BEHIND_SCENES: "#10b981",
  default: "#71717a",
};

const GAP_TYPE_LABELS: Record<string, { label: string; tone: string }> = {
  MARKET_GAP: { label: "Market Gap", tone: "#10b981" },
  COMPETITOR_WINNING: { label: "Competitor Winning", tone: "#ef4444" },
  CUSTOMER_MISSING: { label: "You're Missing This", tone: "#f59e0b" },
  DIFFERENTIATION: { label: "Differentiation Opp.", tone: "#6366f1" },
  EMERGING: { label: "Emerging Trend", tone: "#0ea5e9" },
  SATURATED: { label: "Saturated", tone: "#71717a" },
};

export default function ContentIntelligencePage() {
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  const dashboard = useQuery({
    queryKey: ["ci-dashboard", projectId],
    queryFn: () => api.getCIDashboard(projectId!),
    enabled: !!projectId,
  });

  const classifyMut = useMutation({
    mutationFn: () => api.classifyContent(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-dashboard"] }),
  });
  const patternMut = useMutation({
    mutationFn: () => api.detectPatterns(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-dashboard"] }),
  });
  const gapMut = useMutation({
    mutationFn: () => api.analyzeGaps(projectId!),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ci-dashboard"] }),
  });

  const stats = dashboard.data?.stats;

  const statCards = [
    { label: "Competitors Tracked", value: stats?.competitorsTracked ?? 0, icon: Crosshair, href: "/content-intelligence/competitors", color: "#6366f1" },
    { label: "Content Analyzed", value: stats?.contentAnalyzed ?? 0, icon: Eye, href: "/content-intelligence/competitors", color: "#0ea5e9" },
    { label: "Creative Patterns", value: stats?.creativePatterns ?? 0, icon: Layers, href: "/content-intelligence/patterns", color: "#8b5cf6" },
    { label: "Open Gaps", value: stats?.contentGaps ?? 0, icon: Target, href: "/content-intelligence/gaps", color: "#f59e0b" },
    { label: "Campaigns", value: stats?.campaigns ?? 0, icon: Zap, href: "/content-intelligence/campaigns", color: "#10b981" },
  ];

  if (!projectId) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-[#71717a]">Select a project to get started.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Hero header */}
      <div className="border-b bg-white px-6 py-5" style={{ borderColor: "#f4f4f5" }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] shadow-sm">
              <Brain size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[15px] font-semibold text-[#09090b]">Content Intelligence</h1>
              <p className="text-[12px] text-[#71717a]">Understand the market. Discover what works. Create what is next.</p>
            </div>
          </div>
          <Link href="/content-intelligence/strategy">
            <button className="flex items-center gap-1.5 rounded-lg bg-[#09090b] px-3 py-1.5 text-[12px] font-medium text-white transition hover:bg-[#18181b]">
              <Sparkles size={12} />
              Generate Strategy
            </button>
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {statCards.map((card, i) => (
            <motion.div
              key={card.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link href={card.href}>
                <div className="group rounded-xl border bg-white p-4 transition hover:shadow-md" style={{ borderColor: "#f4f4f5" }}>
                  <div className="mb-3 flex items-center justify-between">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${card.color}18` }}>
                      <card.icon size={15} style={{ color: card.color }} />
                    </div>
                    <ArrowUpRight size={13} className="text-[#d4d4d8] transition group-hover:text-[#09090b]" />
                  </div>
                  <div className="text-[22px] font-bold text-[#09090b]">{dashboard.isLoading ? "—" : card.value}</div>
                  <div className="mt-0.5 text-[11px] text-[#71717a]">{card.label}</div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* Intelligence Pipeline */}
        <div className="rounded-xl border bg-white p-5" style={{ borderColor: "#f4f4f5" }}>
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[13px] font-semibold text-[#09090b]">Intelligence Pipeline</h2>
              <p className="text-[11.5px] text-[#71717a]">Run each step to build the intelligence layer</p>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              {
                step: "1", title: "Classify Content", desc: `${stats?.classified ?? 0} / ${stats?.contentAnalyzed ?? 0} classified`,
                action: "Run Classification", mut: classifyMut, color: "#0ea5e9",
              },
              {
                step: "2", title: "Detect Patterns", desc: `${stats?.creativePatterns ?? 0} patterns found`,
                action: "Detect Patterns", mut: patternMut, color: "#8b5cf6",
              },
              {
                step: "3", title: "Analyze Gaps", desc: `${stats?.contentGaps ?? 0} gaps identified`,
                action: "Analyze Gaps", mut: gapMut, color: "#f59e0b",
              },
            ].map((s) => (
              <div key={s.step} className="rounded-lg border p-4" style={{ borderColor: "#f4f4f5" }}>
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: s.color }}>
                    {s.step}
                  </span>
                  <span className="text-[12.5px] font-semibold text-[#09090b]">{s.title}</span>
                </div>
                <p className="mb-3 text-[11px] text-[#71717a]">{s.desc}</p>
                <button
                  onClick={() => s.mut.mutate()}
                  disabled={s.mut.isPending}
                  className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium text-white transition hover:opacity-90 disabled:opacity-60"
                  style={{ background: s.color }}
                >
                  {s.mut.isPending ? <RefreshCw size={11} className="animate-spin" /> : <Play size={11} />}
                  {s.mut.isPending ? "Running…" : s.action}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Top opportunities */}
          <div className="rounded-xl border bg-white" style={{ borderColor: "#f4f4f5" }}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#f4f4f5" }}>
              <h2 className="text-[13px] font-semibold text-[#09090b]">Top Opportunities</h2>
              <Link href="/content-intelligence/gaps" className="flex items-center gap-1 text-[11px] text-[#6366f1] hover:underline">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "#f4f4f5" }}>
              {dashboard.isLoading ? (
                <div className="px-5 py-8 text-center text-[12px] text-[#71717a]">Loading…</div>
              ) : !dashboard.data?.topOpportunities.length ? (
                <div className="px-5 py-8 text-center">
                  <Target size={24} className="mx-auto mb-2 text-[#d4d4d8]" />
                  <p className="text-[12px] text-[#71717a]">No gaps yet. Add competitors and run the pipeline.</p>
                </div>
              ) : (
                dashboard.data.topOpportunities.map((gap) => {
                  const tone = GAP_TYPE_LABELS[gap.gapType]?.tone ?? "#71717a";
                  const label = GAP_TYPE_LABELS[gap.gapType]?.label ?? gap.gapType;
                  return (
                    <div key={gap.id} className="flex items-start gap-3 px-5 py-3.5">
                      <div className="mt-0.5 flex h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[12px] font-medium text-[#09090b] truncate">{gap.title}</span>
                          <span className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold" style={{ color: tone, background: `${tone}18` }}>
                            {label}
                          </span>
                        </div>
                        <p className="mt-0.5 text-[11px] text-[#71717a] line-clamp-1">{gap.description}</p>
                      </div>
                      <span className="shrink-0 text-[12px] font-bold" style={{ color: tone }}>
                        {gap.opportunityScore}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Top patterns */}
          <div className="rounded-xl border bg-white" style={{ borderColor: "#f4f4f5" }}>
            <div className="flex items-center justify-between border-b px-5 py-4" style={{ borderColor: "#f4f4f5" }}>
              <h2 className="text-[13px] font-semibold text-[#09090b]">Creative Pattern Library</h2>
              <Link href="/content-intelligence/patterns" className="flex items-center gap-1 text-[11px] text-[#6366f1] hover:underline">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y" style={{ borderColor: "#f4f4f5" }}>
              {dashboard.isLoading ? (
                <div className="px-5 py-8 text-center text-[12px] text-[#71717a]">Loading…</div>
              ) : !dashboard.data?.topPatterns.length ? (
                <div className="px-5 py-8 text-center">
                  <Layers size={24} className="mx-auto mb-2 text-[#d4d4d8]" />
                  <p className="text-[12px] text-[#71717a]">No patterns detected yet.</p>
                </div>
              ) : (
                dashboard.data.topPatterns.map((pattern) => (
                  <div key={pattern.id} className="px-5 py-3.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] font-medium text-[#09090b]">{pattern.name}</span>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <div className="text-[9px] text-[#a1a1aa]">Saturation</div>
                          <div className="text-[11px] font-semibold text-[#ef4444]">{pattern.marketSaturation}%</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[9px] text-[#a1a1aa]">Opportunity</div>
                          <div className="text-[11px] font-semibold text-[#10b981]">{pattern.opportunityScore}</div>
                        </div>
                      </div>
                    </div>
                    <p className="mt-1 text-[11px] text-[#71717a] line-clamp-1">{pattern.description}</p>
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {pattern.keyVisualElements.slice(0, 4).map((el) => (
                        <span key={el} className="rounded-full bg-[#f4f4f5] px-1.5 py-0.5 text-[9px] font-medium text-[#52525b]">{el}</span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Competitor Workspace", href: "/content-intelligence/competitors", icon: Crosshair, desc: "Add & monitor competitor accounts" },
            { label: "Content Strategy", href: "/content-intelligence/strategy", icon: Sparkles, desc: "AI-generated differentiated strategy" },
            { label: "Content Calendar", href: "/content-intelligence/calendar", icon: Calendar, desc: "Plan & schedule content" },
            { label: "Creator CRM", href: "/content-intelligence/creators", icon: Users, desc: "Discover & manage creators" },
          ].map((link, i) => (
            <motion.div key={link.href} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 + i * 0.06 }}>
              <Link href={link.href}>
                <div className="group flex h-full flex-col rounded-xl border bg-white p-4 transition hover:shadow-md" style={{ borderColor: "#f4f4f5" }}>
                  <link.icon size={16} className="mb-2 text-[#6366f1]" />
                  <div className="text-[12.5px] font-semibold text-[#09090b]">{link.label}</div>
                  <p className="mt-1 text-[11px] text-[#71717a]">{link.desc}</p>
                  <div className="mt-auto pt-3 flex items-center gap-1 text-[10.5px] font-medium text-[#6366f1]">
                    Go <ChevronRight size={11} />
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
