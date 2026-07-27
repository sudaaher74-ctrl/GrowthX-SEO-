"use client";

import { motion } from "framer-motion";

interface GaugeProps {
  label: string;
  value: number | string;
  unit?: string;
  status: "good" | "needs-improvement" | "poor";
  description: string;
}

function PerformanceGauge({ label, value, unit, status, description }: GaugeProps) {
  const colorClass = 
    status === "good" ? "text-[var(--color-success-500)]" :
    status === "needs-improvement" ? "text-[var(--color-warning-500)]" :
    "text-[var(--color-error-500)]";

  const bgClass = 
    status === "good" ? "bg-green-50 dark:bg-green-900/10" :
    status === "needs-improvement" ? "bg-amber-50 dark:bg-amber-900/10" :
    "bg-red-50 dark:bg-red-900/10";

  const barColor = 
    status === "good" ? "bg-[var(--color-success-500)]" :
    status === "needs-improvement" ? "bg-[var(--color-warning-500)]" :
    "bg-[var(--color-error-500)]";

  const width = status === "good" ? "85%" : status === "needs-improvement" ? "50%" : "20%";

  return (
    <div className={`p-4 rounded-xl border border-[var(--border-color)] ${bgClass}`}>
      <div className="flex justify-between items-start mb-2">
        <h4 className="font-semibold text-[var(--text-primary)] text-sm">{label}</h4>
        <div className={`font-bold text-lg ${colorClass}`}>
          {value}{unit && <span className="text-sm font-medium opacity-80">{unit}</span>}
        </div>
      </div>
      <p className="text-xs text-[var(--text-secondary)] mb-3">{description}</p>
      <div className="h-2 w-full bg-[var(--surface-3)] rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          whileInView={{ width }}
          viewport={{ once: true }}
          transition={{ duration: 1, ease: "easeOut" }}
          className={`h-full rounded-full ${barColor}`}
        />
      </div>
    </div>
  );
}

export function PagePerformanceWidget() {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] p-6 shadow-sm mt-8"
    >
      <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-6">Core Web Vitals & Performance</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <PerformanceGauge 
          label="LCP" 
          value={1.2} 
          unit="s" 
          status="good" 
          description="Largest Contentful Paint" 
        />
        <PerformanceGauge 
          label="INP" 
          value={45} 
          unit="ms" 
          status="good" 
          description="Interaction to Next Paint" 
        />
        <PerformanceGauge 
          label="CLS" 
          value={0.02} 
          status="good" 
          description="Cumulative Layout Shift" 
        />
        <PerformanceGauge 
          label="FID" 
          value={12} 
          unit="ms" 
          status="good" 
          description="First Input Delay" 
        />
        <PerformanceGauge 
          label="TTFB" 
          value={0.8} 
          unit="s" 
          status="needs-improvement" 
          description="Time to First Byte" 
        />
      </div>
    </motion.div>
  );
}
