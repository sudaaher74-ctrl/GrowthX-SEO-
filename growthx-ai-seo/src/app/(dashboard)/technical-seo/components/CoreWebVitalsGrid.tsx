"use client";

import { motion } from "framer-motion";
import { Gauge, Zap, LayoutDashboard, MousePointerClick, TrendingUp } from "lucide-react";

export function CoreWebVitalsGrid() {
  const vitals = [
    {
      id: "lcp",
      name: "Largest Contentful Paint",
      abbr: "LCP",
      value: "1.2s",
      status: "good",
      icon: <LayoutDashboard size={20} />,
      benchmark: "< 2.5s"
    },
    {
      id: "inp",
      name: "Interaction to Next Paint",
      abbr: "INP",
      value: "95ms",
      status: "good",
      icon: <MousePointerClick size={20} />,
      benchmark: "< 200ms"
    },
    {
      id: "cls",
      name: "Cumulative Layout Shift",
      abbr: "CLS",
      value: "0.02",
      status: "good",
      icon: <TrendingUp size={20} />,
      benchmark: "< 0.1"
    },
    {
      id: "fcp",
      name: "First Contentful Paint",
      abbr: "FCP",
      value: "0.8s",
      status: "good",
      icon: <Zap size={20} />,
      benchmark: "< 1.8s"
    }
  ];

  return (
    <div className="bg-[var(--surface-1)] border border-[var(--border-color)] rounded-2xl p-6 shadow-sm flex flex-col h-full">
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Gauge className="text-orange-500" size={20} />
            Core Web Vitals
          </h3>
          <p className="text-sm text-[var(--text-secondary)] mt-1">Real user experience metrics (CrUX)</p>
        </div>
        <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-500/20">
          PASSED
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 flex-1">
        {vitals.map((vital, i) => (
          <motion.div 
            key={vital.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-4 rounded-xl border border-[var(--border-color)] bg-[var(--surface-2)]/50 flex flex-col hover:border-[var(--color-brand-500)]/50 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                {vital.icon}
                <span className="font-bold text-sm">{vital.abbr}</span>
              </div>
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
            </div>
            
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-2xl font-black text-[var(--text-primary)]">{vital.value}</span>
            </div>
            
            <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-muted)] flex items-center justify-between mt-auto">
              <span>{vital.name}</span>
              <span>{vital.benchmark}</span>
            </div>
            
            {/* Tiny bar graph */}
            <div className="w-full h-1.5 bg-[var(--surface-3)] rounded-full mt-3 overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
