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
      description: "AI analyzed your website & created a 30-day fix plan.",
      icon: <FileText size={15} />,
    },
    {
      step: 2,
      title: "2. Awaiting Approval",
      description: "Review the plan and approve to start fixes.",
      icon: <Gauge size={15} />,
    },
    {
      step: 3,
      title: "3. Fixes in Progress",
      description: "AI is implementing all approved changes automatically.",
      icon: <Target size={15} />,
    },
    {
      step: 4,
      title: "4. Verification",
      description: "We validate the improvements and ensure everything is working.",
      icon: <ShieldCheck size={15} />,
    },
    {
      step: 5,
      title: "5. Plan Complete",
      description: "Your website is optimized and ready for better visibility.",
      icon: <Sparkles size={15} />,
    },
  ];

  return (
    <div
      className={cn(
        "rounded-2xl border border-slate-200/80 bg-white p-4 shadow-xs overflow-x-auto",
        className
      )}
    >
      <div className="flex items-center justify-between min-w-[760px] gap-2">
        {steps.map((item, idx) => {
          const isDone = item.step < currentStep;
          const isActive = item.step === currentStep;

          return (
            <React.Fragment key={item.step}>
              <div className="flex items-start gap-2.5 flex-1 min-w-[130px]">
                {/* Step Icon Badge */}
                <div
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors",
                    isDone
                      ? "bg-purple-600 text-white shadow-2xs"
                      : isActive
                      ? "border-2 border-blue-500 bg-blue-50 text-blue-600 ring-4 ring-blue-50"
                      : "border border-slate-200 bg-slate-50 text-slate-400"
                  )}
                >
                  {isDone ? <Check size={16} strokeWidth={3} /> : item.icon}
                </div>

                {/* Step Copy */}
                <div>
                  <h4
                    className={cn(
                      "text-[12px] leading-tight",
                      isActive
                        ? "font-bold text-slate-900"
                        : isDone
                        ? "font-bold text-slate-800"
                        : "font-medium text-slate-500"
                    )}
                  >
                    {item.title}
                  </h4>
                  <p className="mt-0.5 text-[10.5px] leading-snug text-slate-400 max-w-[150px]">
                    {item.description}
                  </p>
                </div>
              </div>

              {/* Connecting arrow if not last */}
              {idx < steps.length - 1 && (
                <div className="shrink-0 px-1 text-slate-300">
                  <ArrowRight size={14} />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
