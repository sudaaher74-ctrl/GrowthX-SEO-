"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-6 sm:py-8 bg-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6">
        <div className="bg-gradient-to-r from-violet-700 via-indigo-700 to-blue-700 rounded-2xl p-6 sm:p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
            <div className="max-w-lg">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-violet-200 bg-violet-600/50 px-2.5 py-1 rounded-full border border-violet-400/30">
                Instant Automated Scan
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight mt-2 mb-1">
                Ready to turn insights into autonomous execution?
              </h2>
              <p className="text-xs sm:text-sm text-violet-100">
                Enter your website URL to get your personalized SEO audit, competitor comparison, and 30-day fix plan in 60 seconds.
              </p>
            </div>

            <div className="flex flex-col items-start sm:items-end gap-2.5 shrink-0">
              <Link
                href="/analyze"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold text-violet-900 bg-white hover:bg-violet-50 active:scale-[0.98] shadow-md transition-all cursor-pointer"
              >
                <span>Analyze Your Website</span>
                <ArrowRight size={15} />
              </Link>
              <div className="flex items-center gap-3 text-[11px] text-violet-200">
                <span className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-violet-300" />
                  Free audit
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <CheckCircle size={12} className="text-violet-300" />
                  No credit card
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
