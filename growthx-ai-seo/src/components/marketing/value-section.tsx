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
    tone: "text-success-500 bg-surface-1 border-brand-200",
  },
  {
    icon: Hand,
    title: "Visible to visitors, so you review it",
    examples: "Headings, broken links, redirects, robots rules, page structure",
    how: "Shown as a before/after diff. Nothing changes until you decide.",
    tone: "text-warning-500 bg-surface-1 border-brand-200",
  },
  {
    icon: PenLine,
    title: "Needs your judgement",
    examples: "Thin content, server errors, HTTPS, pages that should be gone",
    how: "We explain the problem and draft the next step. You decide.",
    tone: "text-brand-800 bg-surface-1 border-brand-200",
  },
];

function FixRules() {
  return (
    <div className="bg-surface-1 border border-brand-200 rounded-3xl p-5 sm:p-6 shadow-card">
      <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-500 mb-1">
        Safety rules
      </p>
      <h3 className="text-xl sm:text-2xl font-black text-brand-950 leading-tight tracking-tight mb-1">
        It changes your site only when you say so.
      </h3>
      <p className="text-sm text-brand-500 leading-relaxed mb-5">
        Fixes are sorted by what they touch, not by which tool found them. Reigel never merges anything for you.
      </p>
      <div className="space-y-3">
        {FIX_RULES.map((rule) => {
          const Icon = rule.icon;
          return (
            <div key={rule.title} className="bg-surface-2 border border-brand-200 rounded-2xl p-4 flex gap-3">
              <div className={`w-9 h-9 rounded-xl border flex items-center justify-center shrink-0 ${rule.tone}`}>
                <Icon size={16} />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-brand-950 leading-tight">{rule.title}</h4>
                <p className="text-xs text-brand-700 mt-1 leading-snug">{rule.examples}</p>
                <p className="text-xs text-brand-500 mt-1.5 leading-snug">{rule.how}</p>
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
    <section id="who-its-for" className="py-20 border-t border-brand-200 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-start">
          {/* LEFT COLUMN */}
          <div className="space-y-6">
            <div>
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-brand-500 mb-2">
                FOR AGENCIES AND BUSINESS OWNERS
              </p>
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-brand-950 leading-tight tracking-tight">
                Real crawls. Real data.<br />
                <span className="text-signal-400">No guesswork.</span>
              </h2>
            </div>
            <p className="text-base text-brand-500 leading-relaxed">
              The crawler renders every page the way Google does, reads your structured data, and keeps a timestamped before and after for every fix, so you can show a client what changed.
            </p>

            {/* Who it's for: agencies first */}
            <div className="space-y-3">
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-brand-700">
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
                  <div key={item.who} className="bg-surface-1 border border-brand-200 rounded-xl p-3.5 space-y-1 shadow-2xs">
                    <span className="text-[10px] font-black text-brand-600 uppercase tracking-wider block">
                      {item.who}
                    </span>
                    <h4 className="text-xs font-bold text-brand-950 leading-tight">{item.headline}</h4>
                    <p className="text-[11px] text-brand-500 leading-snug">{item.line}</p>
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
                <div key={card.title} className="bg-surface-1 border border-brand-200 rounded-xl p-3.5 space-y-0.5 shadow-2xs">
                  <h4 className="text-xs sm:text-sm font-bold text-brand-950">{card.title}</h4>
                  <p className="text-xs text-brand-500 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-6 py-3 rounded-full transition-all shadow-xs cursor-pointer"
              >
                <span>Start free audit</span>
                <ArrowRight size={15} />
              </Link>
              <Link href="/pricing" className="text-sm font-bold text-brand-900 hover:text-brand-950 underline decoration-signal-400 underline-offset-4 transition-colors">
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
