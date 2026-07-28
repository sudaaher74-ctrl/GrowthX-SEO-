"use client";
import { useSearchParams } from "next/navigation";

import { motion } from "framer-motion";
import { Download, RefreshCw, Sparkles, Play, Calendar } from "lucide-react";
import { seoHealthStats, kpiMetrics } from "@/lib/mock-seo-data";

import { SeoHealthWidget } from "./components/SeoHealthWidget";
import { KpiCard } from "./components/KpiCard";
import { VisualAnalytics } from "./components/VisualAnalytics";
import { AiAnalysisPanel } from "./components/AiAnalysisPanel";
import { IssuesDataTable } from "./components/IssuesDataTable";
import { PagePerformanceWidget } from "./components/PagePerformanceWidget";

import { useState, useEffect, Suspense } from "react";
import { useCrawlSocket } from "@/hooks/useCrawlSocket";
import { api } from "@/lib/api-client";

import { motion, AnimatePresence } from "framer-motion";
import { Download, RefreshCw, Sparkles, Play, Calendar, Settings, ChevronRight, MessageSquare, Menu } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useCrawlSocket } from "@/hooks/useCrawlSocket";
import { api } from "@/lib/api-client";

// Core UI Components (To be built)
import { AiExecutiveDashboard } from "./components/AiExecutiveDashboard";
import { AiExecutiveSummary } from "./components/AiExecutiveSummary";
import { BusinessImpactCharts } from "./components/BusinessImpactCharts";
import { AdvancedIssuesTable } from "./components/AdvancedIssuesTable";
import { LiveCrawlerConsole } from "./components/LiveCrawlerConsole";
import { GoogleIndexStatus } from "./components/GoogleIndexStatus";
import { CoreWebVitalsGrid } from "./components/CoreWebVitalsGrid";
import { VisualSitemap } from "./components/VisualSitemap";
import { InternalLinkGraph } from "./components/InternalLinkGraph";
import { AiContentQuality } from "./components/AiContentQuality";
import { CompetitorComparison } from "./components/CompetitorComparison";
import { AiOpportunityCentre } from "./components/AiOpportunityCentre";
import { AiAutoFixPipeline } from "./components/AiAutoFixPipeline";
import { FloatingAiAssistant } from "./components/FloatingAiAssistant";

const NAV_ITEMS = [
  { id: "overview", label: "Executive Overview" },
  { id: "issues", label: "Issue Pipeline" },
  { id: "crawler", label: "Live Crawler" },
  { id: "performance", label: "Web Vitals & Index" },
  { id: "architecture", label: "Site Architecture" },
  { id: "opportunities", label: "AI Opportunities" }
];

function TechnicalSeoContent() {
  const searchParams = useSearchParams();
  const domain = searchParams.get("domain") || "milquu.com";

  const [jobId, setJobId] = useState<string | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const { progress, isCompleted } = useCrawlSocket(jobId);
  const [activeTab, setActiveTab] = useState("overview");

  // Data states
  const [issues, setIssues] = useState<any[]>([]);
  const [crawlData, setCrawlData] = useState<any>(null);
  const [isAiFixing, setIsAiFixing] = useState(false);

  useEffect(() => {
    const fetchLatestCrawl = async () => {
      try {
        const latestJob = await api.getLatestCrawl(domain);
        if (latestJob) {
          setCrawlData(latestJob);
          const issuesRes = await api.getCrawlIssues(latestJob.id);
          setIssues(issuesRes.data || []);
        }
      } catch (e) {
        console.error("Failed to fetch latest crawl", e);
      }
    };
    fetchLatestCrawl();
  }, [domain]);

  useEffect(() => {
    if (isCompleted && jobId) {
      setIsCrawling(false);
      const fetchCompletedResults = async () => {
        try {
          const completedJob = await api.getCrawlJob(jobId);
          setCrawlData(completedJob);
          const issuesRes = await api.getCrawlIssues(jobId);
          setIssues(issuesRes.data || []);
        } catch (e) {
          console.error("Failed to fetch completed crawl results", e);
        }
      };
      fetchCompletedResults();
      setJobId(null);
    }
  }, [isCompleted, jobId]);

  const handleStartCrawl = async () => {
    setIsCrawling(true);
    try {
      const res = await api.runTechnicalAudit(domain);
      if (res.jobId) setJobId(res.jobId);
    } catch (e) {
      console.error(e);
      setIsCrawling(false);
    }
  };

  const scrollToSection = (id: string) => {
    setActiveTab(id);
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div className="max-w-[1600px] mx-auto pb-32">
      {/* Premium Header */}
      <div className="sticky top-0 z-40 bg-[var(--bg-overlay)]/90 backdrop-blur-xl border-b border-[var(--border-color)] px-4 py-4 mb-8 -mx-4">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-4">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-[var(--text-muted)] uppercase mb-2">
              <span>Audits</span>
              <ChevronRight size={12} />
              <span className="text-[var(--text-primary)]">Technical SEO</span>
            </div>
            <h1 className="text-3xl font-extrabold text-[var(--text-primary)] tracking-tight mb-2 flex items-center gap-3">
              Technical SEO Audit
              <span className="px-2 py-0.5 rounded-full bg-[var(--color-brand-500)]/10 text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)] text-xs font-bold border border-[var(--color-brand-500)]/20">
                AI Engine v3.0
              </span>
            </h1>
            <div className="flex items-center gap-4 text-sm text-[var(--text-secondary)]">
              <span className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" />
                {domain}
              </span>
              <span className="text-[var(--border-strong)]">|</span>
              <span className="flex items-center gap-1.5"><Calendar size={14}/> {isCrawling ? "Crawling now..." : (crawlData ? new Date(crawlData.createdAt).toLocaleString() : "Never")}</span>
            </div>
          </motion.div>
          
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex flex-wrap items-center gap-3">
            <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2 shadow-sm">
              <Settings size={16} /> Config
            </button>
            <button className="px-4 py-2 bg-[var(--surface-1)] border border-[var(--border-color)] rounded-lg text-sm font-medium hover:bg-[var(--surface-2)] transition-colors flex items-center gap-2 shadow-sm">
              <Download size={16} /> Generate Report
            </button>
            <button onClick={handleStartCrawl} disabled={isCrawling} className={`px-5 py-2 ${isCrawling ? 'bg-[var(--surface-3)] cursor-wait' : 'bg-black dark:bg-white text-white dark:text-black hover:opacity-90'} rounded-lg text-sm font-semibold transition-colors flex items-center gap-2 shadow-sm`}>
              <Play size={16} className={isCrawling ? "animate-pulse" : ""} fill="currentColor" /> {isCrawling ? "Crawling..." : "Start Crawl"}
            </button>
            <button onClick={() => setIsAiFixing(true)} className="px-5 py-2 bg-gradient-brand text-white rounded-lg text-sm font-bold shadow-glow-brand hover:opacity-90 transition-all transform hover:scale-105 flex items-center gap-2">
              <Sparkles size={16} fill="currentColor" /> Run AI Pipeline
            </button>
          </motion.div>
        </div>

        {/* Sticky Anchor Navigation */}
        <div className="flex items-center gap-6 mt-6 overflow-x-auto no-scrollbar border-t border-[var(--border-color)] pt-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => scrollToSection(item.id)}
              className={`pb-3 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
                activeTab === item.id 
                  ? "border-[var(--color-brand-500)] text-[var(--color-brand-600)] dark:text-[var(--color-brand-400)]" 
                  : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)]"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-24 px-4 scroll-smooth">
        
        {/* --- SECTION 1: OVERVIEW --- */}
        <div id="overview" className="scroll-mt-48 space-y-8">
          <AiExecutiveDashboard crawlData={crawlData} issues={issues} progress={progress} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AiExecutiveSummary issues={issues} />
            <BusinessImpactCharts issues={issues} />
          </div>
        </div>

        {/* --- SECTION 2: ISSUES PIPELINE --- */}
        <div id="issues" className="scroll-mt-48">
          <AdvancedIssuesTable issues={issues} />
        </div>

        {/* --- SECTION 3: LIVE CRAWLER --- */}
        <div id="crawler" className="scroll-mt-48">
          <LiveCrawlerConsole progress={progress} isCrawling={isCrawling} />
        </div>

        {/* --- SECTION 4: WEB VITALS & INDEX --- */}
        <div id="performance" className="scroll-mt-48 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CoreWebVitalsGrid />
          <GoogleIndexStatus />
        </div>

        {/* --- SECTION 5: SITE ARCHITECTURE --- */}
        <div id="architecture" className="scroll-mt-48 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 h-[600px]">
            <VisualSitemap domain={domain} />
            <InternalLinkGraph jobId={crawlData?.id} />
          </div>
          <AiContentQuality />
        </div>

        {/* --- SECTION 6: OPPORTUNITIES --- */}
        <div id="opportunities" className="scroll-mt-48 grid grid-cols-1 xl:grid-cols-2 gap-6">
          <AiOpportunityCentre />
          <CompetitorComparison />
        </div>

      </div>

      <AnimatePresence>
        {isAiFixing && <AiAutoFixPipeline onClose={() => setIsAiFixing(false)} issues={issues} />}
      </AnimatePresence>
      
      <FloatingAiAssistant />
    </div>
  );
}

export default function TechnicalSeoPage() {
  return (
    <Suspense fallback={<div className="p-12 text-center text-[var(--text-muted)] flex flex-col items-center justify-center animate-pulse"><Sparkles size={32} className="mb-4 text-[var(--color-brand-500)]" /> Initializing AI Engine...</div>}>
      <TechnicalSeoContent />
    </Suspense>
  );
}
