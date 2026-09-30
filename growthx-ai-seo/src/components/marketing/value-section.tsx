import Link from "next/link";
import { ArrowRight, Eye, Hand, PenLine } from "lucide-react";

/**
 * The three fix classes, as the Fix Engine really routes them
 * (growthx-ai-crawler/src/modules/issues/fix-class.ts). Keep the examples in
 * step with that table.
 */
const FIX_RULES = [
  {
    icon: Eye,
    title: "Low risk, invisible to visitors",
    examples: "Titles, meta descriptions, alt text, canonicals, structured data, sitemap",
    how: "Prepared for you in a pull request, ready to merge.",
    tone: "text-success-400 bg-success-500/10 border-success-500/20",
  },
  {
    icon: Hand,
    title: "Visible to visitors, so you review it",
    examples: "Headings, broken links, redirects, robots rules, page structure",
    how: "Shown as a before/after diff. Nothing changes until you decide.",
    tone: "text-warning-400 bg-warning-500/10 border-warning-500/20",
  },
  {
    icon: PenLine,
    title: "Needs your judgement",
    examples: "Thin content, server errors, HTTPS, pages that should be gone",
    how: "We explain the problem and draft the next step. You decide.",
    tone: "text-series-400 bg-series-6/10 border-series-6/20",
  },
];

function FixRules() {
  return (
    <div className="bg-brand-900/60 border border-brand-800 rounded-3xl p-5 sm:p-6 shadow-2xl">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-series-6 mb-1">
        Safety rules
      </p>
      <h3 className="text-xl sm:text-2xl font-black text-white leading-tight tracking-tight mb-1">
        It changes your site only when you say so.
      </h3>
      <p className="text-sm text-brand-400 leading-relaxed mb-5">
        Fixes are sorted by what they touch, not by which tool found them. GrowthX never merges anything for you.
      </p>
      <div className="space-y-3">
        {FIX_RULES.map((rule) => {
          const Icon = rule.icon;
          return (
            <div key={rule.title} className="bg-brand-950/70 border border-brand-800 rounded-2xl p-4 flex gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${rule.tone}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-white leading-tight">{rule.title}</h4>
                <p className="text-xs text-brand-300 mt-1 leading-snug">{rule.examples}</p>
                <p className="text-xs text-brand-400 mt-1.5 leading-snug">{rule.how}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function ValueSection() {
  return (
    <section id="who-its-for" className="py-20 bg-brand-950 border-t border-brand-900 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-series-6 mb-2">
                FOR AGENCIES AND BUSINESS OWNERS
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white leading-tight tracking-tight">
                Real crawls. Real data.<br />
                <span className="text-series-6">No guesswork.</span>
              </h2>
            </div>
            <p className="text-base text-brand-400 leading-relaxed">
              The crawler renders every page the way Google does, reads your structured data, and keeps a timestamped before and after for every fix, so you can show a client what changed.
            </p>

            {/* Who it's for: agencies first */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-300">
                Who it&apos;s built for
              </h3>
              <div className="grid sm:grid-cols-3 gap-2.5">
                {[
                  {
                    who: "Agencies",
                    headline: "Run more clients with the same team.",
                    line: "One workspace for every client site, a ranked fix list for each, and reports you can hand over.",
                  },
                  {
                    who: "Business owners",
                    headline: "Know what to fix on Monday.",
                    line: "Paste your URL. Get a plain-language list, your rivals side by side, and how AI assistants describe you.",
                  },
                  {
                    who: "Multi-location brands",
                    headline: "Own the map in every city.",
                    line: "Map-grid rankings, Business Profile audits and review reply drafts for each location.",
                  },
                ].map((item) => (
                  <div key={item.who} className="bg-brand-900/60 border border-brand-800/80 rounded-xl p-3.5 space-y-1">
                    <span className="text-[10px] font-black text-series-6 uppercase tracking-wider block">
                      {item.who}
                    </span>
                    <h4 className="text-xs font-bold text-white leading-tight">{item.headline}</h4>
                    <p className="text-[11px] text-brand-400 leading-snug">{item.line}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical cards */}
            <div className="space-y-3">
              {[
                {
                  title: "Headless crawler",
                  desc: "Renders JavaScript, so Next.js and React sites are audited correctly.",
                },
                {
                  title: "Schema inspection",
                  desc: "Parses your JSON-LD and flags exactly which field is missing or broken.",
                },
                {
                  title: "Measured through each vendor's own API",
                  desc: "A ChatGPT answer is asked of ChatGPT, never guessed from another model. When something cannot be measured, we say so.",
                },
                {
                  title: "Your data stays yours",
                  desc: "Credentials are encrypted and every workspace is isolated from the others.",
                },
              ].map((card) => (
                <div key={card.title} className="bg-brand-900/40 border border-brand-800 rounded-xl p-3.5 space-y-0.5">
                  <h4 className="text-xs sm:text-sm font-bold text-white">{card.title}</h4>
                  <p className="text-xs text-brand-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-5 py-3 rounded-xl transition-all shadow-md cursor-pointer"
              >
                <span>Start free audit</span>
                <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="text-sm font-semibold text-series-400 hover:text-series-300 transition-colors">
                See pricing &rarr;
              </Link>
            </div>
          </div>

          {/* RIGHT COLUMN */}
          <div className="lg:sticky lg:top-24">
            <FixRules />
          </div>
        </div>
      </div>
    </section>
  );
}
