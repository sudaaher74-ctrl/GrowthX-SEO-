"use client";
import { motion } from "framer-motion";
import { mockCompetitors } from "@/lib/mock-data";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Plus, Search, Globe, Sparkles, ArrowRight, TrendingUp, TrendingDown } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis
} from "recharts";

const radarData = [
  { metric: "Traffic", milquu: 68, competitor: 82 },
  { metric: "Keywords", milquu: 55, competitor: 78 },
  { metric: "Backlinks", milquu: 45, competitor: 72 },
  { metric: "Domain Auth.", milquu: 42, competitor: 65 },
  { metric: "Page Speed", milquu: 88, competitor: 70 },
  { metric: "Content", milquu: 60, competitor: 55 },
];

const gapKeywords = [
  { keyword: "best milk brand india", milquuPos: null, compPos: 8, volume: 12000, opportunity: "high" },
  { keyword: "A2 milk health benefits", milquuPos: 18, compPos: 4, volume: 9400, opportunity: "high" },
  { keyword: "buffalo milk vs cow milk", milquuPos: 24, compPos: 7, volume: 6400, opportunity: "medium" },
  { keyword: "organic dairy india", milquuPos: null, compPos: 12, volume: 4800, opportunity: "medium" },
  { keyword: "fresh milk delivery mumbai", milquuPos: 9, compPos: 3, volume: 7200, opportunity: "high" },
];

export default function CompetitorsPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Competitor Analysis</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">Monitor competitors and discover strategic opportunities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" icon={<Sparkles size={13}/>}>AI Strategy</Button>
          <Button variant="secondary" size="sm" icon={<Plus size={13}/>}>Add Competitor</Button>
        </div>
      </motion.div>

      {/* Competitor Cards */}
      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
        {mockCompetitors.map((comp, i) => (
          <motion.div key={comp.domain} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
            className="card p-4 hover:shadow-card-hover cursor-pointer">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                <Globe size={14} className="text-slate-500"/>
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-[var(--text-primary)] truncate">{comp.domain}</div>
                <TrendBadge value={comp.change}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: "Traffic", value: formatNumber(comp.traffic) },
                { label: "Keywords", value: formatNumber(comp.keywords) },
                { label: "Backlinks", value: formatNumber(comp.backlinks) },
                { label: "DA", value: comp.da.toString() },
              ].map(({ label, value }) => (
                <div key={label} className="bg-[var(--surface-2)] rounded-lg p-2 text-center">
                  <div className="text-sm font-bold text-[var(--text-primary)]">{value}</div>
                  <div className="text-[10px] text-[var(--text-muted)]">{label}</div>
                </div>
              ))}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Comparison Chart + Radar */}
      <div className="grid xl:grid-cols-2 gap-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Traffic Comparison</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={[
                { name: "milquu.com", traffic: 18420, fill: "#6366f1" },
                ...mockCompetitors.map(c => ({ name: c.domain.replace(".com","").replace(".in",""), traffic: c.traffic, fill: "#e2e8f0" }))
              ]} margin={{ left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)"/>
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}/>
                <YAxis tickFormatter={formatNumber} tick={{ fontSize: 10, fill: "var(--text-muted)" }} tickLine={false} axisLine={false}/>
                <Tooltip contentStyle={{ background: "var(--card-bg)", border: "1px solid var(--border-color)", borderRadius: "8px", fontSize: "12px" }}/>
                <Bar dataKey="traffic" name="Monthly Traffic" radius={[4,4,0,0]}
                  fill="#6366f1"
                  className="[&:not(:first-child)]:fill-slate-200 dark:[&:not(:first-child)]:fill-slate-700"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="card p-5">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">Competitive Radar vs milkwala.in</h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={radarData}>
                <PolarGrid stroke="var(--border-color)"/>
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10, fill: "var(--text-muted)" }}/>
                <Radar name="milquu.com" dataKey="milquu" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2}/>
                <Radar name="milkwala.in" dataKey="competitor" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.15} strokeWidth={2}/>
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      </div>

      {/* Keyword Gap */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="card overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">Keyword Gap Analysis</h3>
          <Badge variant="error">5 missed opportunities</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="data-table">
            <thead>
              <tr>
                <th>Keyword</th>
                <th className="text-right">Your Position</th>
                <th className="text-right">Competitor Pos.</th>
                <th className="text-right">Volume</th>
                <th>Opportunity</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {gapKeywords.map(kw => (
                <tr key={kw.keyword}>
                  <td className="font-medium text-sm text-[var(--text-primary)]">{kw.keyword}</td>
                  <td className="text-right">
                    {kw.milquuPos ? <span className="text-sm font-bold text-amber-500">#{kw.milquuPos}</span> : <Badge variant="error">Not ranking</Badge>}
                  </td>
                  <td className="text-right"><span className="text-sm font-bold text-emerald-500">#{kw.compPos}</span></td>
                  <td className="text-right text-sm">{formatNumber(kw.volume)}</td>
                  <td><Badge variant={kw.opportunity === "high" ? "error" : "warning"}>{kw.opportunity}</Badge></td>
                  <td><Button variant="primary" size="sm" iconRight={<ArrowRight size={12}/>}>Target</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  );
}
