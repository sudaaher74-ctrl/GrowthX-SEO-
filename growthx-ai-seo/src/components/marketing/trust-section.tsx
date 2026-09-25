import Link from "next/link";
import { TrendingUp, AlertTriangle, EyeOff, Bot } from "lucide-react";

const PAIN_CARDS = [
  {
    icon: AlertTriangle,
    title: "Reports, not results",
    line: "You get a 200-row audit. Nobody has time to fix it.",
    badgeColor: "text-warning-400 bg-warning-500/10 border-warning-500/20",
  },
  {
    icon: EyeOff,
    title: "Competitors move silently",
    line: "A rival adds 20 pages and a new city page, and you find out months later.",
    badgeColor: "text-error-400 bg-error-500/10 border-error-500/20",
  },
  {
    icon: Bot,
    title: "AI search skips you",
    line: "People ask AI assistants for suppliers. Your name doesn't come up.",
    badgeColor: "text-series-400 bg-series-6/10 border-series-6/20",
  },
];

export function TrustSection() {
  return (
    <section className="py-20 sm:py-24 bg-brand-950 border-t border-brand-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">
          {/* LEFT: Problem & Pain Cards */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-series-6 mb-3">
              The Problem
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-white leading-tight tracking-tight mb-4">
              SEO got harder.<br />
              <span className="text-series-6">Your tools didn&apos;t get smarter.</span>
            </h2>
            <p className="text-base sm:text-lg text-brand-400 leading-relaxed mb-8 max-w-2xl">
              Most businesses pay for three or four tools and still don&apos;t know what to do on Monday morning. Reports pile up. Competitors quietly add pages. ChatGPT and Google&apos;s AI answers recommend someone else. Nobody fixes anything.
            </p>

            {/* Three Pain Cards */}
            <div className="grid sm:grid-cols-3 gap-3.5 mb-6">
              {PAIN_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="bg-brand-900/60 rounded-xl border border-brand-800 p-4 space-y-2.5 shadow-2xs hover:border-brand-700 hover:bg-brand-900/80 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-brand-950 border border-brand-800 flex items-center justify-center">
                        <Icon size={16} className="text-brand-300" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white mb-1">{card.title}</h4>
                      <p className="text-xs text-brand-400 leading-relaxed">{card.line}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bridge line */}
            <div className="bg-brand-900/30 border border-brand-800/80 rounded-xl px-4 py-3 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-series-6 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold text-brand-300">
                GrowthX is built to close the gap between knowing and doing.
              </p>
            </div>
          </div>

          {/* RIGHT: Call to action sticky box */}
          <div className="sticky top-24">
            <div className="bg-gradient-to-br from-brand-900 via-brand-900/90 to-brand-950 rounded-2xl border border-brand-800 p-6 shadow-xl relative overflow-hidden">
              <div className="absolute -top-16 -right-16 w-32 h-32 rounded-full bg-series-6/10 blur-2xl pointer-events-none" />
              <p className="text-[10px] font-bold uppercase tracking-widest text-series-6 mb-4">
                See it on your own site
              </p>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className="text-success-400" />
                <p className="text-lg font-extrabold text-white">Full audit of your website</p>
              </div>
              <p className="text-[13px] text-brand-300 mb-5 leading-relaxed">
                Log in to crawl your pages, track rivals and AI search, and let GrowthX write and ship the fixes.
              </p>
              <Link
                href="/dashboard"
                className="w-full block text-center text-[12.5px] font-bold text-white bg-series-6 hover:bg-series-6/90 rounded-xl py-2.5 transition-colors shadow-sm"
              >
                Go to Dashboard →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
