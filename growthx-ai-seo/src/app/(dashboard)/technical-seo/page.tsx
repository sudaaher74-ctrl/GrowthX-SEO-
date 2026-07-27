"use client";

import { motion } from "framer-motion";
import { Download, RefreshCw, Sparkles, Play, Calendar } from "lucide-react";
import { seoHealthStats, kpiMetrics } from "@/lib/mock-seo-data";

import { SeoHealthWidget } from "./components/SeoHealthWidget";
import { KpiCard } from "./components/KpiCard";
import { VisualAnalytics } from "./components/VisualAnalytics";
import { AiAnalysisPanel } from "./components/AiAnalysisPanel";
import { IssuesDataTable } from "./components/IssuesDataTable";
import { PagePerformanceWidget } from "./components/PagePerformanceWidget";

export default function TechnicalSeoPage() {
  return (
    <div className="max-w-[1600px] mx-auto pb-20">
      {/* Sticky Header Section */}
      <div className="sticky top-0 z-30 bg-[var(--bg-overlay)] backdrop-blur-xl border-b border-[var(--border-color)] pb-4 pt-6 px-2 mb-8 -mx-2">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
            <h1 className="text-3xl font-bold text-[var(--text-primary)] mb-1">Technical SEO Audit</h1>
            <div className="flex items-center gap-3 text-sm text-[var(--text-muted)]">
              <span className="font-semibold text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)]">milquu.com</span>
              <span>•</span>
              <span className="flex items-center gap-1"><Calendar size={14}/> Last Crawl: 2 hours ago</span>
              <span>•</span>
              <span>v2.4.0 Engine</span>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3">
            <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
              <Download size={16} /> Export
            </button>
            <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
              <RefreshCw size={16} /> Schedule
            </button>
            <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-3)] transition-colors flex items-center gap-2">
              <Play size={16} /> Start Crawl
            </button>
            <button className="px-5 py-2 bg-gradient-brand text-white rounded-lg text-sm font-semibold shadow-glow-brand hover:opacity-90 transition-opacity flex items-center gap-2 animate-pulse-glow">
              <Sparkles size={16} /> AI Auto Fix
            </button>
          </motion.div>
        </div>
      </div>

      <div className="space-y-8 px-2">
        {/* Top Section: Health & AI Summary */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-1">
            <SeoHealthWidget {...seoHealthStats} />
          </div>
          <div className="xl:col-span-2">
            <AiAnalysisPanel />
          </div>
        </div>

        {/* KPI Cards Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-8 gap-4 mt-8">
          {kpiMetrics.map((kpi, index) => (
            <KpiCard key={kpi.id} {...kpi} index={index} />
          ))}
        </div>

        {/* Visual Analytics Charts */}
        <VisualAnalytics />

        {/* Core Web Vitals */}
        <PagePerformanceWidget />

        {/* Advanced Data Table */}
        <IssuesDataTable />
      </div>
    </div>
  );
}
