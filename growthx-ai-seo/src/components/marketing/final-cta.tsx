"use client";

import { useState } from "react";
import { ArrowRight, CheckCircle } from "lucide-react";

export function FinalCTA() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) {
      try {
        localStorage.setItem("growthx_pending_domain", trimmed);
      } catch {}
    }
    const clean = trimmed ? encodeURIComponent(trimmed) : "";
    window.location.href = clean ? `/login?url=${clean}` : "/login";
  };

  return (
    <section className="py-24 border-t border-brand-200 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-surface-1 rounded-3xl px-8 sm:px-16 py-16 relative overflow-hidden border border-brand-200 shadow-card">
          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            {/* Left */}
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">
                Ready to See It Yourself?
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight">
                Your competitors are already optimising.<br />
                <span className="text-signal-400">Find out what to fix first.</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg text-brand-500 leading-relaxed">
                Get your free audit in minutes. Free account, no card needed.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-start lg:items-end gap-4 shrink-0 w-full lg:w-auto">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-stretch gap-2 bg-surface-2 border border-brand-200 focus-within:border-brand-400 p-1.5 rounded-2xl shadow-sm w-full sm:w-[420px]"
              >
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm font-medium text-brand-950 placeholder-brand-400 focus:outline-none"
                  style={{ outline: "none", boxShadow: "none" }}
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-6 py-2.5 rounded-xl transition-all shadow-xs shrink-0 cursor-pointer"
                >
                  <span>Run free audit</span>
                  <ArrowRight size={14} />
                </button>
              </form>

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
