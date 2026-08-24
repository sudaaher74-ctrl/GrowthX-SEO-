"use client";
import { motion } from "framer-motion";
import { StatusDot } from "@/components/ui/badge";
import { formatRelativeTime } from "@/lib/utils";
import { useActivity, useWorkspace } from "@/hooks/use-growthx";
import { QueryState } from "@/components/ui/query-state";

export default function ActivityPage() {
  const { projectId } = useWorkspace();
  const activity = useActivity(projectId);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Activity Log</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Crawls, automation runs, strategy reports and shipped content for this client</p>
      </motion.div>
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card overflow-hidden">
        <QueryState
          isLoading={activity.isLoading}
          error={activity.error}
          isEmpty={!activity.data?.length}
          emptyTitle="No activity yet"
          emptyBody="Run an audit or generate a strategy for this client to start building a history."
        >
          <div className="divide-y divide-[var(--border-color)]">
            {activity.data?.map((item) => (
              <div key={item.id} className="flex items-start gap-3 px-5 py-3 hover:bg-[var(--surface-2)] transition-base">
                <StatusDot status={item.status === "success" ? "success" : item.status === "pending" ? "pending" : item.status === "warning" ? "warning" : "error"} className="mt-0.5"/>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--text-primary)] leading-relaxed">{item.message}</p>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">{formatRelativeTime(item.time)}</p>
                </div>
              </div>
            ))}
          </div>
        </QueryState>
      </motion.div>
    </div>
  );
}
