"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export function FinalCTA() {
  const [url, setUrl] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = url.trim() ? encodeURIComponent(url.trim()) : "";
    window.location.href = clean ? `/login?url=${clean}` : "/login";
  };

  return (
    <section className="py-24 bg-brand-950 border-t border-brand-900 relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-900 via-brand-900 to-brand-950 rounded-3xl px-8 sm:px-16 py-16 relative overflow-hidden border border-brand-800 shadow-2xl">
          {/* Soft blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-series-6/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-accent-500/10 blur-3xl" />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            {/* Left */}
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
                Ready to See It Yourself?
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Your competitors are already optimising.<br />
                <span className="text-series-6">Let&apos;s catch up by Monday.</span>
              </h2>
              <p className="mt-4 text-base sm:text-lg text-brand-300 leading-relaxed">
                Get your free audit in about a minute. No card needed.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-start lg:items-end gap-4 shrink-0 w-full lg:w-auto">
              <form
                onSubmit={handleSubmit}
                className="flex flex-col sm:flex-row items-stretch gap-2 bg-brand-950/80 border border-brand-700/80 p-1.5 rounded-2xl shadow-xl w-full sm:w-[420px]"
              >
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  className="flex-1 bg-transparent px-4 py-2.5 text-sm text-white placeholder-brand-500 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex items-center justify-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all shadow-md shrink-0 cursor-pointer"
                >
                  <span>Run free audit</span>
                  <ArrowRight size={14} />
                </button>
              </form>

              <div className="flex flex-wrap items-center gap-4 text-xs text-brand-400">
                {["Free", "No card needed", "Results in ~60s"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5">
                    <CheckCircle size={13} className="text-series-6 shrink-0" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <p
                className="text-series-6/80 font-bold text-sm hidden lg:block"
                style={{ fontFamily: "cursive", transform: "rotate(-2deg)" }}
              >
                Find it. Fix it. Prove it. ↗
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
