"use client";
import { motion } from "framer-motion";
import { mockRecentActivity } from "@/lib/mock-data";
import { StatusDot } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";

export default function ActivityPage() {
  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Activity Log</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Real-time log of all SEO actions and automation events</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card overflow-hidden">
        <div className="divide-y divide-[var(--border-color)]">
          {Array.from({ length: 3 }, () => mockRecentActivity).flat().map((item, i) => (
            <div key={`${item.id}-${i}`} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] cursor-pointer transition-base">
              <StatusDot status={item.status === "success" ? "success" : item.status === "pending" ? "pending" : item.status === "warning" ? "warning" : "error"} className="mt-0.5"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-[var(--text-primary)] leading-relaxed">{item.message}</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatRelativeTime(item.time)}</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
