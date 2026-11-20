"use client";

import { CheckCircle } from "lucide-react";
import { DomainAuditForm } from "@/components/marketing/domain-audit-form";

export function FinalCTA() {
  return (
    <section className="py-14 sm:py-24 border-t border-brand-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface-1 rounded-2xl sm:rounded-3xl px-4 sm:px-12 lg:px-16 py-10 sm:py-16 relative overflow-hidden border border-brand-200 shadow-card">
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-10">
            {/* Left */}
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-2 sm:mb-3">
                Ready to See It Yourself?
              </p>
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight">
                Your competitors are already optimising.<br />
                <span className="text-signal-400">Find out what to fix first.</span>
              </h2>
              <p className="mt-3 sm:mt-4 text-sm sm:text-lg text-brand-500 leading-relaxed">
                Get your free audit in minutes. Founder early access is ₹0 through December 31, 2026 — no card needed.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-start lg:items-end gap-3 sm:gap-4 shrink-0 w-full lg:w-auto">
              <DomainAuditForm
                className="w-full sm:w-[420px]"
                inputContainerClassName="bg-surface-2 border border-brand-200 focus-within:border-brand-400 shadow-sm"
              />

              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-500">
                {["Free account", "No card needed", "Ready in minutes"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-success-500 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
