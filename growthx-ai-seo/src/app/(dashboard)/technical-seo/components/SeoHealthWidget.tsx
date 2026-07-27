"use client";

import { motion } from "framer-motion";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface SeoHealthWidgetProps {
  score: number;
  label: string;
  lastCrawl: string;
  pagesCrawled: number;
  estimatedOrganicImpact: string;
  potentialTrafficGain: string;
  estimatedRevenueImpact: string;
}

export function SeoHealthWidget({
  score,
  label,
  lastCrawl,
  pagesCrawled,
  estimatedOrganicImpact,
  potentialTrafficGain,
  estimatedRevenueImpact
}: SeoHealthWidgetProps) {
  const color = score >= 90 ? "#22c55e" : score >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-[var(--card-bg)] rounded-[var(--radius-xl)] border border-[var(--border-color)] shadow-card p-6 flex flex-col sm:flex-row items-center gap-8"
    >
      {/* Circular Ring */}
      <div className="w-40 h-40 relative flex-shrink-0">
        <CircularProgressbar
          value={score}
          text={`${score}%`}
          strokeWidth={8}
          styles={buildStyles({
            pathColor: color,
            textColor: "var(--text-primary)",
            trailColor: "var(--border-color)",
            textSize: '22px',
            pathTransitionDuration: 1.5,
          })}
        />
        <div className="absolute top-[70%] left-1/2 -translate-x-1/2 text-sm font-medium text-[var(--text-secondary)]">
          {label}
        </div>
      </div>

      {/* Stats */}
      <div className="flex-1 grid grid-cols-2 lg:grid-cols-4 gap-6 w-full">
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1">Last Crawl</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">{lastCrawl}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">{pagesCrawled.toLocaleString()} pages</p>
        </div>
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1">Organic Impact</p>
          <p className="text-lg font-semibold text-[var(--color-success-500)]">{estimatedOrganicImpact}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Est. uplift</p>
        </div>
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1">Traffic Gain</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">+{potentialTrafficGain}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Visits per month</p>
        </div>
        <div>
          <p className="text-sm text-[var(--text-muted)] mb-1">Revenue Impact</p>
          <p className="text-lg font-semibold text-[var(--text-primary)]">+{estimatedRevenueImpact}</p>
          <p className="text-xs text-[var(--text-muted)] mt-1">Annual recurring</p>
        </div>
      </div>
    </motion.div>
  );
}
