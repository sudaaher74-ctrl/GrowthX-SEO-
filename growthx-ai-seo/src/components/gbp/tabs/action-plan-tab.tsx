"use client";

import React, { useState } from "react";
import {
  ListTodo,
  CheckCircle2,
  Circle,
  ArrowRight,
  Sparkles,
  Rocket,
  ShieldCheck,
  Award,
} from "lucide-react";
import type { LocalSeoData } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface ActionPlanTabProps {
  localSeo: LocalSeoData | null | undefined;
}

interface ActionTask {
  id: string;
  title: string;
  impact: "High" | "Medium" | "Critical";
  done: boolean;
  timeEstimate: string;
}

interface ActionPhase {
  phase: number;
  title: string;
  description: string;
  tasks: ActionTask[];
}

export function ActionPlanTab({ localSeo }: ActionPlanTabProps) {
  const [phases, setPhases] = useState<ActionPhase[]>([
    {
      phase: 1,
      title: "Foundational Listing Hygiene (100% Completeness)",
      description: "Ensure zero missing fields and exact Name, Address, and Phone (NAP) synchronization.",
      tasks: [
        { id: "t1", title: "Complete primary & 3+ secondary categories", impact: "Critical", done: true, timeEstimate: "5 mins" },
        { id: "t2", title: "Write keyword-optimized 750-character business description", impact: "High", done: true, timeEstimate: "10 mins" },
        { id: "t3", title: "Verify opening hours and holiday exceptions", impact: "Medium", done: true, timeEstimate: "5 mins" },
        { id: "t4", title: "Add amenities and attributes (wheelchair accessible, Wi-Fi, etc.)", impact: "Medium", done: false, timeEstimate: "5 mins" },
      ],
    },
    {
      phase: 2,
      title: "Review Velocity & Social Proof Acceleration",
      description: "Scale authentic 5-star Google reviews and achieve 100% response rate within 24 hours.",
      tasks: [
        { id: "t5", title: "Respond to all unanswered Google reviews using AI drafts", impact: "High", done: true, timeEstimate: "10 mins" },
        { id: "t6", title: "Set up automated review request SMS/email workflow for happy clients", impact: "Critical", done: false, timeEstimate: "15 mins" },
        { id: "t7", title: "Target milestone of 50+ total reviews to outrank local rivals", impact: "High", done: false, timeEstimate: "Ongoing" },
      ],
    },
    {
      phase: 3,
      title: "Visual & Media Dominance",
      description: "Outpace local competitors in Google Maps photo count and upload diversity.",
      tasks: [
        { id: "t8", title: "Upload 5 high-resolution exterior storefront photos", impact: "High", done: false, timeEstimate: "15 mins" },
        { id: "t9", title: "Add 10 interior facility photos showcasing clean premises", impact: "Medium", done: true, timeEstimate: "20 mins" },
        { id: "t10", title: "Upload friendly team and doctor headshots", impact: "Medium", done: false, timeEstimate: "10 mins" },
        { id: "t11", title: "Publish 30-second video walkthrough of the clinic", impact: "High", done: false, timeEstimate: "30 mins" },
      ],
    },
    {
      phase: 4,
      title: "Local Content & Geo-Signal Saturation",
      description: "Signal active weekly presence to Google's ranking crawler through updates and citations.",
      tasks: [
        { id: "t12", title: "Publish weekly 'What's New' update with booking CTA", impact: "High", done: true, timeEstimate: "10 mins" },
        { id: "t13", title: "Launch seasonal promotional offer post with expiry date", impact: "Medium", done: false, timeEstimate: "10 mins" },
        { id: "t14", title: "Audit local citations across major web directories for NAP consistency", impact: "Critical", done: false, timeEstimate: "25 mins" },
      ],
    },
  ]);

  const toggleTask = (phaseIdx: number, taskId: string) => {
    setPhases((prev) =>
      prev.map((p, pIdx) => {
        if (pIdx !== phaseIdx) return p;
        return {
          ...p,
          tasks: p.tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t)),
        };
      })
    );
  };

  const allTasks = phases.flatMap((p) => p.tasks);
  const doneTasks = allTasks.filter((t) => t.done).length;
  const progressPct = Math.round((doneTasks / allTasks.length) * 100);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-xs" style={{ borderColor: "var(--border-color)" }}>
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-950 text-white flex items-center justify-center shadow-sm shrink-0">
            <Rocket size={20} />
          </div>
          <div>
            <h2 className="text-sm font-bold text-brand-950">Local Maps Dominance Action Plan</h2>
            <p className="text-xs text-brand-500 mt-0.5">
              A structured 4-phase playbook engineered to take you to the top of Google Maps 3-Pack.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-xs font-bold text-brand-950">
              {doneTasks} of {allTasks.length} Tasks Complete
            </p>
            <div className="w-36 bg-brand-100 h-2 rounded-full mt-1.5 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
          <span className="font-mono text-sm font-bold text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-200">
            {progressPct}%
          </span>
        </div>
      </div>

      {/* Action Phases */}
      <div className="space-y-5">
        {phases.map((phase, pIdx) => {
          const phaseDone = phase.tasks.filter((t) => t.done).length;

          return (
            <div
              key={phase.phase}
              className="rounded-2xl border bg-white p-5 shadow-xs space-y-4"
              style={{ borderColor: "var(--border-color)" }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      Phase {phase.phase}
                    </span>
                    <h3 className="text-sm font-bold text-brand-950">{phase.title}</h3>
                  </div>
                  <p className="text-xs text-brand-500">{phase.description}</p>
                </div>

                <span className="font-mono text-xs font-semibold text-brand-600 bg-brand-50 px-2 py-1 rounded-md border border-brand-200">
                  {phaseDone}/{phase.tasks.length} Done
                </span>
              </div>

              <div className="space-y-2 pt-1">
                {phase.tasks.map((task) => (
                  <div
                    key={task.id}
                    onClick={() => toggleTask(pIdx, task.id)}
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between cursor-pointer transition select-none",
                      task.done
                        ? "bg-emerald-50/30 border-emerald-200"
                        : "bg-white border-brand-100 hover:bg-brand-50"
                    )}
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-3">
                      {task.done ? (
                        <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                      ) : (
                        <Circle size={16} className="text-brand-300 shrink-0" />
                      )}
                      <span
                        className={cn(
                          "text-xs font-medium truncate",
                          task.done ? "line-through text-brand-400" : "text-brand-950"
                        )}
                      >
                        {task.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-mono text-[10px] text-brand-400">{task.timeEstimate}</span>
                      <span
                        className={cn(
                          "text-[9.5px] font-bold px-1.5 py-0.2 rounded border",
                          task.impact === "Critical"
                            ? "bg-rose-50 text-rose-700 border-rose-200"
                            : task.impact === "High"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        )}
                      >
                        {task.impact}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
