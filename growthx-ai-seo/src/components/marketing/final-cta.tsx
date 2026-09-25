"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";

export function FinalCTA() {
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
              <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight">
                Take control of your SEO<br />
                <span className="text-series-6">today.</span>
              </h2>
              <p className="mt-4 text-lg text-brand-300 leading-relaxed">
                Log in to your dashboard to crawl your website, audit technical SEO, and track rankings.
              </p>
            </div>

            {/* Right */}
            <div className="flex flex-col items-start lg:items-end gap-5 shrink-0">
              <Link
                href="/dashboard"
                className="flex items-center gap-2 bg-white hover:bg-brand-100 text-brand-950 font-bold text-base px-7 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02]"
              >
                Go to Dashboard
                <ArrowRight size={16} />
              </Link>
              <div className="flex flex-wrap items-center gap-5">
                {["Automated site crawl", "No credit card required", "Setup in minutes"].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-[12.5px] text-brand-300">
                    <CheckCircle size={13} className="text-series-6" />
                    {item}
                  </div>
                ))}
              </div>
              <p
                className="text-series-6/80 font-bold text-base hidden lg:block"
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
