"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export function FinalCTA() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-violet-600 via-violet-700 to-blue-700 rounded-3xl px-8 sm:px-16 py-16 relative overflow-hidden">
          {/* Soft blobs */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-blue-400/20 blur-3xl" />
          </div>

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:justify-between gap-10">
            {/* Left */}
            <div className="max-w-xl">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-200 mb-3">
                Ready to See It Yourself?
              </p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Analyze your website<br />
                <span className="text-violet-200">today.</span>
              </h2>
              <p className="mt-4 text-lg text-violet-100 leading-relaxed">
                Get a free AI-powered analysis in just a few minutes. No credit card required.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-start lg:items-end gap-5 shrink-0">
              <Link
                href="/analyze"
                className="flex items-center gap-2 bg-white hover:bg-slate-50 active:bg-slate-100 text-violet-700 font-bold text-base px-7 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl"
              >
                Analyze Your Website
                <ArrowRight size={16} />
              </Link>
              <div className="flex flex-wrap items-center gap-5">
                {["Free analysis", "No credit card required", "Setup in minutes"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-[12.5px] text-violet-200">
                    <CheckCircle size={13} className="text-violet-300" />
                    {item}
                  </div>
                ))}
              </div>
              <p
                className="text-violet-200 font-bold text-base hidden lg:block"
                style={{ fontFamily: "cursive", transform: "rotate(-2deg)" }}
              >
                Your growth starts here. ↗
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
