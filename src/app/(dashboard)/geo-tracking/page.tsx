"use client";
import { motion } from "framer-motion";
import { mockGeoVisibility } from "@/lib/mock-data";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, Globe, TrendingUp, Plus, Info } from "lucide-react";
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip
} from "recharts";

const radarData = mockGeoVisibility.platforms.map(p => ({
  platform: p.name.replace(" AI Overviews", "").replace("Google", "Google AI"),
  score: p.score,
}));

const tipsData = [
  { tip: "Provide clear, structured answers to common questions in your content", impact: "High", platforms: ["ChatGPT", "Perplexity"] },
  { tip: "Add FAQ schema markup to all key pages", impact: "High", platforms: ["Google AI Overviews"] },
  { tip: "Get cited by authoritative health and food blogs", impact: "Medium", platforms: ["Gemini", "Claude"] },
  { tip: "Include statistics and data points with source citations", impact: "High", platforms: ["All"] },
  { tip: "Use conversational language matching how users ask AI questions", impact: "Medium", platforms: ["ChatGPT", "Claude"] },
  { tip: "Publish comprehensive long-form guides (2,000+ words)", impact: "Medium", platforms: ["Google AI Overviews", "Perplexity"] },
];

export default function GeoTrackingPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">GEO / AI Search Visibility</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Track your brand's visibility across AI-powered search platforms</p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus size={13}/>}>Add Prompt</Button>
      </motion.div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "AI Platforms", value: "5", color: "text-purple-500" },
          { label: "Total Mentions", value: mockGeoVisibility.totalMentions, color: "text-violet-500" },
          { label: "Avg Visibility Score", value: `${mockGeoVisibility.averageScore}`, suffix: "/100", color: "text-emerald-500" },
          { label: "Mentions Growth", value: `+${mockGeoVisibility.mentionsTrend}`, suffix: "%", color: "text-amber-500" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="card p-4 text-center">
            <div className={cn("text-3xl font-bold", s.color)}>{s.value}<span className="text-xl">{s.suffix}</span></div>
            <div className="text-xs text-[var(--text-muted)] mt-0.5">{s.label}</div>
          </motion.div>
        ))}
      </div>

      {/* Platform cards + Radar */}
      <div className="grid xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start">
          {mockGeoVisibility.platforms.map((platform, i) => (
            <motion.div key={platform.name} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="card p-4 hover:shadow-card-hover cursor-pointer">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${platform.color}20` }}>
                    <Globe size={15} style={{ color: platform.color }}/>
                  </div>
                  <span className="text-xs font-semibold text-[var(--text-secondary)] leading-tight">{platform.name}</span>
                </div>
              </div>
              <div className="text-3xl font-bold mb-1" style={{ color: platform.color }}>{platform.score}</div>
              <div className="text-xs text-[var(--text-muted)] mb-2">Visibility Score</div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">{platform.mentions} mentions</span>
                <TrendBadge value={platform.trend}/>
              </div>
              {/* Score bar */}
              <div className="mt-3 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                <motion.div initial={{ width: 0 }} animate={{ width: `${platform.score}%` }} transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                  className="h-full rounded-full" style={{ background: platform.color }}/>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Radar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Visibility Radar</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-color)"/>
                <PolarAngleAxis dataKey="platform" tick={{ fontSize: 9, fill: "var(--text-muted)" }}/>
                <Radar name="Score" dataKey="score" stroke="#7c3aed" fill="#7c3aed" fillOpacity={0.2} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Improvement Tips */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-color)]">
          <Sparkles size={15} className="text-purple-500"/>
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">AI Recommendations to Improve GEO Visibility</h3>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {tipsData.map((tip, i) => (
            <div key={i} className="flex items-start gap-4 px-5 py-3 hover:bg-[var(--surface-2)] cursor-pointer">
              <div className="w-6 h-6 rounded-full gradient-bg-brand flex items-center justify-center shrink-0 mt-0.5 text-white text-xs font-bold">{i + 1}</div>
              <div className="flex-1">
                <p className="text-sm text-[var(--text-primary)]">{tip.tip}</p>
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant={tip.impact === "High" ? "success" : "warning"}>Impact: {tip.impact}</Badge>
                  {tip.platforms.map(p => <Badge key={p} variant="default">{p}</Badge>)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
