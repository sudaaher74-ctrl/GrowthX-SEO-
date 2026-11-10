"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  TrendingUp,
  ArrowUpRight,
  ShieldCheck,
  Sparkles,
  ExternalLink,
  Loader2,
  Calendar,
  CheckCircle2,
} from "lucide-react";
import { api, type Ga4RangeKey } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface AiReferralsCardProps {
  projectId: string;
  range?: Ga4RangeKey;
  compact?: boolean;
}

const ENGINE_ICONS: Record<string, string> = {
  chatgpt: "🤖",
  perplexity: "🔍",
  gemini: "✨",
  claude: "🧠",
  copilot: "💻",
  you: "🌐",
  poe: "💬",
};

export function AiReferralsCard({
  projectId,
  range = "28d",
  compact = false,
}: AiReferralsCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ["ai-referrals", projectId, range],
    queryFn: () => api.aiReferrals(projectId, range),
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="rounded-xl border border-line bg-surface-1 p-5 shadow-card">
        <div className="flex items-center gap-2 text-xs text-brand-500">
          <Loader2 size={15} className="animate-spin text-signal-400" />
          <span>Measuring AI referral traffic from GA4...</span>
        </div>
      </div>
    );
  }

  if (!data || !data.connected) {
    return (
      <div className="rounded-xl border border-line bg-surface-1 p-5 shadow-card">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-brand-600">
              <Bot size={18} />
            </div>
            <div>
              <h4 className="text-xs font-bold text-brand-950">
                AI Referral Traffic
              </h4>
              <p className="mt-0.5 text-xs text-brand-500 leading-relaxed">
                Connect Google Analytics 4 to track sessions and conversions from ChatGPT, Perplexity, Gemini, Claude, and Copilot.
              </p>
            </div>
          </div>
          <Link
            href="/settings?tab=integrations"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-3 py-1.5 text-xs font-medium text-brand-800 hover:bg-surface-3 transition"
          >
            <span>Connect GA4</span>
            <ArrowUpRight size={13} />
          </Link>
        </div>
      </div>
    );
  }

  const {
    totalAiSessions = 0,
    totalAiUsers = 0,
    totalAiConversions = 0,
    aiShareOfTotalTrafficPct = 0,
    byEngine = [],
    impactTimeline,
  } = data;

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface-1 shadow-card space-y-0">
      {/* Header */}
      <div className="flex flex-col justify-between gap-3 border-b border-line px-5 py-3.5 sm:flex-row sm:items-center">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-line bg-surface-2 text-brand-700">
            <Bot size={16} className="text-signal-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold text-brand-950">AI Referrals</h3>
              <span className="rounded-full bg-signal-400/10 px-2 py-0.5 text-[10px] font-bold text-signal-700">
                {totalAiSessions > 0 ? `${aiShareOfTotalTrafficPct}% of site traffic` : "GA4 Tracking"}
              </span>
            </div>
            <p className="text-[11px] text-brand-500">
              Visits and conversions from generative search engines in the last {range}
            </p>
          </div>
        </div>

        <Link
          href="/traffic"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-600 hover:text-brand-950 transition"
        >
          <span>View Traffic</span>
          <ArrowUpRight size={12} />
        </Link>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-3 divide-x divide-line border-b border-line bg-surface-1">
        <div className="p-4">
          <div className="text-[10.5px] font-medium text-brand-500 uppercase tracking-wider">
            AI Sessions
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-brand-950">
            {totalAiSessions.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10.5px] text-brand-400">
            {totalAiUsers.toLocaleString()} unique users
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10.5px] font-medium text-brand-500 uppercase tracking-wider">
            Conversions
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-brand-950">
            {totalAiConversions.toLocaleString()}
          </div>
          <div className="mt-0.5 text-[10.5px] text-brand-400">
            {totalAiSessions > 0
              ? `${((totalAiConversions / totalAiSessions) * 100).toFixed(1)}% conversion rate`
              : "0% rate"}
          </div>
        </div>

        <div className="p-4">
          <div className="text-[10.5px] font-medium text-brand-500 uppercase tracking-wider">
            Traffic Share
          </div>
          <div className="mt-1 font-mono text-2xl font-extrabold text-brand-950">
            {aiShareOfTotalTrafficPct}%
          </div>
          <div className="mt-0.5 text-[10.5px] text-brand-400">
            of total GA4 sessions
          </div>
        </div>
      </div>

      {/* Breakdown by AI Engine */}
      <div className="border-b border-line bg-surface-1 p-4">
        <div className="mb-2 text-[10.5px] font-bold uppercase tracking-wider text-brand-500">
          Referrals by Assistant Engine
        </div>

        {byEngine.length === 0 ? (
          <div className="py-3 text-center text-xs text-brand-400 italic">
            No referral sessions recorded from AI assistants in this window yet.
          </div>
        ) : (
          <div className="space-y-2">
            {byEngine.map((eng) => (
              <div
                key={eng.key}
                className="flex items-center justify-between rounded-lg border border-line bg-surface-2/40 px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{ENGINE_ICONS[eng.key] || "🤖"}</span>
                  <div>
                    <span className="font-semibold text-brand-950">{eng.name}</span>
                    <span className="ml-2 font-mono text-[10px] text-brand-400">
                      ({eng.users} users)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-right">
                  <div>
                    <div className="font-mono font-bold text-brand-950">
                      {eng.sessions} sessions
                    </div>
                    {eng.conversions > 0 && (
                      <div className="font-mono text-[10px] text-success-600 font-semibold">
                        {eng.conversions} key events ({eng.conversionRatePct}%)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Before / After Impact Ledger View */}
      <div className="bg-surface-2/30 p-4">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck size={14} className="text-signal-500" />
          <span className="text-xs font-bold text-brand-950">
            Impact Ledger Correlation (Before vs. After Fix)
          </span>
        </div>

        {impactTimeline.hasFixes && impactTimeline.comparison ? (
          <div className="rounded-xl border border-line bg-surface-1 p-3.5 space-y-3">
            <div className="flex flex-col justify-between gap-1 sm:flex-row sm:items-center text-xs">
              <div>
                <span className="font-semibold text-brand-950">
                  {impactTimeline.fixEvent?.title}
                </span>
                <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] font-mono text-brand-600 border border-line">
                  Shipped {new Date(impactTimeline.fixEvent!.shippedAt).toLocaleDateString()}
                </span>
              </div>
              {impactTimeline.fixEvent?.affectedUrl && (
                <span className="text-[11px] font-mono text-brand-400 truncate max-w-xs">
                  {impactTimeline.fixEvent.affectedUrl}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1 border-t border-line text-xs">
              <div className="rounded-lg bg-surface-2/50 p-2.5">
                <div className="text-[10.5px] text-brand-500">Before Fix Window</div>
                <div className="mt-0.5 font-mono text-lg font-bold text-brand-950">
                  {impactTimeline.comparison.beforeSessions} sessions
                </div>
                <div className="text-[10px] text-brand-400">
                  {impactTimeline.comparison.beforeConversions} conversions
                </div>
              </div>

              <div className="rounded-lg bg-surface-2/50 p-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] text-brand-500">After Fix Window</span>
                  {impactTimeline.comparison.sessionsDeltaPct != null && (
                    <span
                      className={cn(
                        "font-mono text-[10px] font-bold px-1.5 py-0.5 rounded",
                        impactTimeline.comparison.sessionsDeltaPct >= 0
                          ? "bg-success-500/10 text-success-700"
                          : "bg-error-500/10 text-error-700"
                      )}
                    >
                      {impactTimeline.comparison.sessionsDeltaPct >= 0 ? "+" : ""}
                      {impactTimeline.comparison.sessionsDeltaPct}%
                    </span>
                  )}
                </div>
                <div className="mt-0.5 font-mono text-lg font-bold text-brand-950">
                  {impactTimeline.comparison.afterSessions} sessions
                </div>
                <div className="text-[10px] text-brand-400">
                  {impactTimeline.comparison.afterConversions} conversions
                </div>
              </div>
            </div>

            <p className="text-[10.5px] text-brand-500 italic">
              {impactTimeline.message}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-line bg-surface-1 p-3.5 text-xs text-brand-500">
            {impactTimeline.message}
          </div>
        )}
      </div>
    </div>
  );
}

