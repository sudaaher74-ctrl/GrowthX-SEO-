import Link from "next/link";
import { TrendingUp, AlertTriangle, EyeOff, Bot } from "lucide-react";

const PAIN_CARDS = [
  {
    icon: AlertTriangle,
    title: "Reports, not results",
    line: "You get a 200-row audit. Nobody has time to fix it.",
  },
  {
    icon: EyeOff,
    title: "Competitors move silently",
    line: "A rival adds 20 pages and a new city page, and you find out months later.",
  },
  {
    icon: Bot,
    title: "AI search skips you",
    line: "People ask AI assistants for suppliers. Your name doesn't come up.",
  },
];

export function TrustSection() {
  return (
    <section className="py-20 sm:py-24 border-t border-brand-200 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_400px] gap-12 lg:gap-16 items-start">
          {/* LEFT: Problem & Pain Cards */}
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">
              The Problem
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight mb-4">
              SEO got harder.<br />
              <span className="text-signal-400">Your tools didn&apos;t get smarter.</span>
            </h2>
            <p className="text-base sm:text-lg text-brand-500 leading-relaxed mb-8 max-w-2xl">
              Most businesses pay for three or four tools and still don&apos;t know what to do on Monday morning. Reports pile up. Competitors quietly add pages. ChatGPT and Google&apos;s AI answers recommend someone else. Nobody fixes anything.
            </p>

            {/* Three Pain Cards */}
            <div className="grid sm:grid-cols-3 gap-3.5 mb-6">
              {PAIN_CARDS.map((card) => {
                const Icon = card.icon;
                return (
                  <div
                    key={card.title}
                    className="bg-surface-1 rounded-2xl border border-brand-200 p-4 space-y-2.5 shadow-2xs hover:border-brand-300 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="w-8 h-8 rounded-lg bg-surface-2 border border-brand-200 flex items-center justify-center">
                        <Icon size={16} className="text-brand-700" />
                      </div>
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-brand-950 mb-1">{card.title}</h4>
                      <p className="text-xs text-brand-500 leading-relaxed">{card.line}</p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Bridge line */}
            <div className="bg-surface-1 border border-brand-200 rounded-xl px-4 py-3 flex items-center gap-2.5">
              <span className="w-2 h-2 rounded-full bg-signal-400 shrink-0" />
              <p className="text-xs sm:text-sm font-semibold text-brand-800">
                Most tools stop at the report. Reigel starts there.
              </p>
            </div>
          </div>

          {/* RIGHT: Call to action sticky box */}
          <div className="sticky top-24">
            <div className="bg-surface-1 rounded-2xl border border-brand-200 p-6 shadow-card relative overflow-hidden">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-500 mb-3">
                See it on your own site
              </p>
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp size={18} className="text-success-500" />
                <p className="text-lg font-extrabold text-brand-950">Full audit of your website</p>
              </div>
              <p className="text-[13px] text-brand-500 mb-5 leading-relaxed">
                Create a free account, paste your URL, and get a ranked fix list. Fixes arrive as pull requests you approve.
              </p>
              <Link
                href="/login"
                className="w-full block text-center text-[13px] font-extrabold text-signal-ink bg-signal-400 hover:bg-signal-500 rounded-full py-2.5 transition-colors shadow-xs"
              >
                Start free audit →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
