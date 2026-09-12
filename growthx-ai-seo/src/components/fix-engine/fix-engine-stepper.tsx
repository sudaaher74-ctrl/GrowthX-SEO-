"use client";

import React from "react";
import {
  FileText,
  Clock,
  Target,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  Check,
  Gauge,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";

export interface FixEngineStepperProps {
  currentStep?: 1 | 2 | 3 | 4 | 5;
  className?: string;
}

export function FixEngineStepper({
  currentStep = 2,
  className,
}: FixEngineStepperProps) {
  const steps = [
    {
      step: 1,
      title: "1. Plan Created",
      description: "AI generated 30-day fix plan",
      icon: <FileText size={15} />,
    },
    {
      step: 2,
      title: "2. Awaiting Approval",
      description: "Review & approve to begin",
      icon: <Gauge size={15} />,
    },
    {
      step: 3,
      title: "3. Fixes in Progress",
      description: "Automated code remediation",
      icon: <Target size={15} />,
    },
    {
      step: 4,
      title: "4. Verification",
      description: "Live crawl & health check",
      icon: <ShieldCheck size={15} />,
    },
    {
      step: 5,
      title: "5. Plan Complete",
      description: "Optimized for search & AI",
      icon: <Sparkles size={15} />,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-3.5 shadow-xs overflow-x-auto",
        className
      )}
    >
      <div className="flex items-center justify-between min-w-[760px] gap-2">
        {steps.map((item, idx) => {
          const isDone = item.step < currentStep;
          const isActive = item.step === currentStep;

          return (
            <React.Fragment key={item.step}>
              <div className="flex items-center gap-3 flex-1 min-w-[130px]">
                {/* Step Icon Badge */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-all",
                    isDone
                      ? "bg-purple-600 text-white shadow-xs shadow-purple-600/25"
                      : isActive
                      ? "border-2 border-purple-600 bg-purple-50 text-purple-700 ring-4 ring-purple-100/60"
                      : "border border-slate-200 bg-slate-50 text-slate-400"
                  )}
                >
                  {isDone ? <Check size={15} strokeWidth={3} /> : item.icon}
                </div>

                {/* Step Copy */}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h4
                      className={cn(
                        "text-[12px] leading-tight truncate",
                        isActive
                          ? "font-extrabold text-slate-900"
                          : isDone
                          ? "font-bold text-slate-800"
                          : "font-medium text-slate-500"
                      )}
                    >
                      {item.title}
                    </h4>
                    {isActive && (
                      <span className="inline-flex items-center h-1.5 w-1.5 rounded-full bg-purple-600 animate-pulse" />
                    )}
                  </div>
                  <p className="mt-0.5 text-[11px] leading-tight text-slate-400 truncate">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Connecting arrow if not last */}
              {idx < steps.length - 1 && (
                <div className="shrink-0 px-2 text-slate-300 flex items-center justify-center">
                  <ArrowRight size={13} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
