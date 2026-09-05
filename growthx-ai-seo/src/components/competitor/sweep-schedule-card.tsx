"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, CheckCircle2, RefreshCw, Zap } from "lucide-react";
import { useRunSweep } from "@/hooks/use-growthx";

interface SweepScheduleCardProps {
  projectId: string;
}

type ScheduleFrequency = "OFF" | "DAILY" | "WEEKLY";

export function SweepScheduleCard({ projectId }: SweepScheduleCardProps) {
  const runSweep = useRunSweep(projectId);
  const storageKey = `growthx_sweep_schedule_${projectId}`;

  const [frequency, setFrequency] = useState<ScheduleFrequency>("WEEKLY");
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.frequency) setFrequency(parsed.frequency);
        if (parsed.lastRunAt) setLastRunAt(parsed.lastRunAt);
      } catch {
        // ignore parse error
      }
    }
  }, [storageKey]);

  const handleFrequencyChange = (next: ScheduleFrequency) => {
    setFrequency(next);
    if (typeof window !== "undefined") {
      localStorage.setItem(
        storageKey,
        JSON.stringify({ frequency: next, lastRunAt: lastRunAt ?? new Date().toISOString() }),
      );
    }
  };

  const getNextScheduledText = () => {
    if (frequency === "OFF") return "Scheduled probes disabled";
    if (frequency === "DAILY") return "Runs daily at 02:00 UTC";
    return "Runs weekly every Monday at 02:00 UTC";
  };

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white border border-brand-200 shadow-2xs text-brand-700">
          <Clock size={16} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-semibold text-brand-950">Automated Visibility Sweeps</h4>
            <span
              className={`rounded-full px-2 py-0.5 text-[9.5px] font-semibold ${
                frequency !== "OFF"
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-brand-200 text-brand-600"
              }`}
            >
              {frequency !== "OFF" ? "Active" : "Paused"}
            </span>
          </div>
          <p className="text-[11px] text-brand-500 mt-0.5">{getNextScheduledText()}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
        <div className="inline-flex rounded-lg border border-brand-200 bg-white p-0.5 shadow-2xs">
          {(["OFF", "DAILY", "WEEKLY"] as const).map((freq) => (
            <button
              key={freq}
              onClick={() => handleFrequencyChange(freq)}
              className={`rounded-md px-2.5 py-1 text-[11px] font-medium transition ${
                frequency === freq
                  ? "bg-brand-950 text-white font-semibold"
                  : "text-brand-600 hover:text-brand-950"
              }`}
            >
              {freq === "OFF" ? "Off" : freq === "DAILY" ? "Daily" : "Weekly"}
            </button>
          ))}
        </div>

        <button
          onClick={() => {
            runSweep.mutate(undefined, {
              onSuccess: () => {
                const now = new Date().toISOString();
                setLastRunAt(now);
                if (typeof window !== "undefined") {
                  localStorage.setItem(
                    storageKey,
                    JSON.stringify({ frequency, lastRunAt: now }),
                  );
                }
              },
            });
          }}
          disabled={runSweep.isPending}
          className="flex items-center gap-1 rounded-lg border border-brand-200 bg-white px-2.5 py-1 text-[11px] font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50 transition shadow-2xs"
          title="Trigger immediate sweep"
        >
          <RefreshCw size={11} className={runSweep.isPending ? "animate-spin" : ""} />
          <span>{runSweep.isPending ? "Probing…" : "Run Now"}</span>
        </button>
      </div>
    </div>
  );
}
