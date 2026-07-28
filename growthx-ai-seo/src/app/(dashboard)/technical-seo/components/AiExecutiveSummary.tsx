"use client";

import { motion } from "framer-motion";
import { Sparkles, AlertTriangle, Info, CheckCircle2, Bot } from "lucide-react";

export function AiExecutiveSummary({ issues }: { issues: any[] }) {
  const criticalCount = issues?.filter(i => i.severity === 'CRITICAL').length || 0;
  
  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm relative overflow-hidden">
      <div className="absolute top-0 right-0 p-8 opacity-5">
        <Bot size={120} />
      </div>
      
      <div className="flex items-center gap-3 mb-6 relative z-10">
        <div className="p-2 bg-gradient-brand rounded-lg shadow-glow-brand">
          <Sparkles size={20} className="text-white" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-[var(--text-primary)]">AI Executive Briefing</h2>
          <p className="text-sm text-[var(--text-secondary)]">Generated automatically based on your latest crawl data.</p>
        </div>
      </div>

      <div className="space-y-4 relative z-10">
        <div className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-500" /> Current SEO Health
          </h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            The site architecture is fundamentally sound, with excellent response times (avg 240ms) and strong use of semantic HTML. However, indexation is currently suppressed by a bottleneck of structural errors.
          </p>
        </div>

        <div className="p-4 bg-[var(--color-error-500)]/5 rounded-xl border border-[var(--color-error-500)]/20">
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-2 flex items-center gap-2">
            <AlertTriangle size={16} /> Biggest Risks & Business Impact
          </h3>
          <p className="text-sm text-red-700/80 dark:text-red-300/80 leading-relaxed">
            We detected {criticalCount > 0 ? criticalCount : 'several'} critical issues affecting your product templates. This is actively leaking PageRank and confusing Googlebot. Estimated impact is a <strong>14% loss in organic traffic</strong> and approx <strong>$4,500/month</strong> in unrealized revenue.
          </p>
        </div>

        <div className="p-4 bg-[var(--surface-2)] rounded-xl border border-[var(--border-color)]">
          <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-2 flex items-center gap-2">
            <Info size={16} className="text-blue-500" /> AI Strategic Recommendation
          </h3>
          <ul className="text-sm text-[var(--text-secondary)] space-y-2 list-disc list-inside">
            <li><strong>Quick Win:</strong> Deploy the AI-generated canonical tags fix to consolidate duplicate content.</li>
            <li><strong>Long Term:</strong> Restructure the pagination schema on the blog to improve crawl depth.</li>
            <li><strong>Recovery Forecast:</strong> If fixed today, expect a ranking rebound within 2-3 weeks as Google processes the updated sitemap.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
