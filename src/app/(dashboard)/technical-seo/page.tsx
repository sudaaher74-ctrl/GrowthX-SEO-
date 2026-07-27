"use client";
import { motion } from "framer-motion";
import { mockTechnicalIssues } from "@/lib/mock-data";
import { Badge, TrendBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Bug, CheckCircle2, RefreshCw, Download, ChevronRight, Link2, FileText, Image, AlertCircle, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";

const allIssues = [
  { id: 1, type: "Broken Links", severity: "high", count: 8, url: "/products/old-item-404", description: "Returns HTTP 404", fix: "Update or remove the link", category: "Links" },
  { id: 2, type: "Missing Meta Description", severity: "medium", count: 14, url: "/blog/category/news", description: "No meta description found", fix: "Add a compelling 150-160 char description", category: "Meta" },
  { id: 3, type: "Duplicate Title Tags", severity: "high", count: 3, url: "/products?sort=price", description: "Same title across multiple URLs", fix: "Add unique title or canonicalize", category: "Meta" },
  { id: 4, type: "Missing H1 Tag", severity: "high", count: 5, url: "/checkout", description: "Page has no H1 heading", fix: "Add a descriptive H1", category: "Content" },
  { id: 5, type: "Large Images (>200KB)", severity: "medium", count: 18, url: "/home", description: "Unoptimized images slow page load", fix: "Convert to WebP and compress", category: "Images" },
  { id: 6, type: "Missing Alt Text", severity: "medium", count: 22, url: "/products", description: "Images lack descriptive alt text", fix: "AI can generate alt text automatically", category: "Images" },
  { id: 7, type: "Slow Page Speed (>3s LCP)", severity: "high", count: 6, url: "/landing", description: "LCP exceeds 3 seconds", fix: "Optimize critical render path", category: "Performance" },
  { id: 8, type: "Canonical Issues", severity: "critical", count: 2, url: "/products?color=red", description: "Self-referencing canonical missing", fix: "Add canonical pointing to main URL", category: "Technical" },
  { id: 9, type: "404 Errors", severity: "critical", count: 4, url: "/old-location-page", description: "Page not found — returns 404", fix: "Redirect to relevant page", category: "Technical" },
  { id: 10, type: "Redirect Chains (>2 hops)", severity: "medium", count: 3, url: "/old-blog →/blog →/news", description: "Multiple redirects in sequence", fix: "Collapse to single redirect", category: "Technical" },
  { id: 11, type: "Thin Content (<300 words)", severity: "medium", count: 9, url: "/category/buffalo", description: "Very little textual content", fix: "Add descriptive content or noindex", category: "Content" },
  { id: 12, type: "Multiple H1 Tags", severity: "medium", count: 4, url: "/home", description: "More than one H1 per page", fix: "Keep only one H1", category: "Content" },
  { id: 13, type: "Noindex on Important Pages", severity: "critical", count: 2, url: "/product/a2-cow-milk", description: "Meta robots has noindex", fix: "Remove noindex directive", category: "Technical" },
  { id: 14, type: "Missing Sitemap", severity: "high", count: 1, url: "/sitemap.xml", description: "Sitemap not submitted to GSC", fix: "Generate & submit sitemap", category: "Technical" },
];

const severityConfig = {
  critical: { color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10", badge: "error" as const },
  high: { color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10", badge: "warning" as const },
  medium: { color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/10", badge: "default" as const },
  low: { color: "text-slate-400", bg: "bg-slate-50 dark:bg-slate-800/20", badge: "default" as const },
};

export default function TechnicalSeoPage() {
  const criticalCount = allIssues.filter(i => i.severity === "critical").length;
  const highCount = allIssues.filter(i => i.severity === "high").length;

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-h1 text-[var(--text-primary)]">Technical SEO Audit</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">milquu.com · Crawl completed July 27, 2026</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="sm" icon={<Download size={13}/>}>Export CSV</Button>
          <Button variant="primary" size="sm" icon={<RefreshCw size={13}/>}>Re-crawl Site</Button>
        </div>
      </motion.div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Critical", count: mockTechnicalIssues.critical, color: "text-red-500", bg: "bg-red-50 dark:bg-red-900/10", icon: <AlertCircle size={18}/> },
          { label: "High", count: mockTechnicalIssues.high, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-900/10", icon: <AlertTriangle size={18}/> },
          { label: "Medium", count: mockTechnicalIssues.medium, color: "text-yellow-500", bg: "bg-yellow-50 dark:bg-yellow-900/10", icon: <Bug size={18}/> },
          { label: "Low", count: mockTechnicalIssues.low, color: "text-slate-400", bg: "bg-slate-100 dark:bg-slate-800", icon: <CheckCircle2 size={18}/> },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            className={cn("card p-4 flex items-center gap-3", s.bg)}>
            <div className={s.color}>{s.icon}</div>
            <div>
              <div className={cn("text-3xl font-bold", s.color)}>{s.count}</div>
              <div className="text-xs text-[var(--text-muted)]">{s.label} issues</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Issues Table */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)]">All Issues ({allIssues.length})</h3>
          <div className="flex items-center gap-2">
            {["All", "Critical", "High", "Medium"].map((f) => (
              <button key={f} className={cn("px-2.5 py-1 text-xs rounded-md font-medium transition-base",
                f === "All" ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "text-[var(--text-muted)] hover:bg-[var(--surface-3)]"
              )}>{f}</button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-[var(--border-color)]">
          {allIssues.map((issue, i) => {
            const sc = severityConfig[issue.severity as keyof typeof severityConfig];
            return (
              <motion.div key={issue.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 * i }}
                className="px-5 py-3 hover:bg-[var(--surface-2)] cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <AlertTriangle size={14} className={cn("shrink-0 mt-0.5", sc.color)}/>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{issue.type}</span>
                        <Badge variant={sc.badge}>{issue.severity}</Badge>
                        <Badge variant="default">{issue.category}</Badge>
                      </div>
                      <code className="text-xs text-purple-400 font-mono mt-0.5 block">{issue.url}</code>
                      <p className="text-xs text-[var(--text-muted)] mt-0.5">{issue.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className={cn("text-xl font-bold", sc.color)}>{issue.count}</div>
                      <div className="text-[10px] text-[var(--text-muted)]">instances</div>
                    </div>
                    <Button variant="secondary" size="sm" iconRight={<ChevronRight size={12}/>}>AI Fix</Button>
                  </div>
                </div>
                <div className={cn("mt-2 px-3 py-2 rounded-lg text-xs text-[var(--text-secondary)] flex items-start gap-1.5", sc.bg)}>
                  <CheckCircle2 size={12} className="shrink-0 mt-0.5 text-emerald-500"/>
                  <span><strong>Suggested fix:</strong> {issue.fix}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
}
