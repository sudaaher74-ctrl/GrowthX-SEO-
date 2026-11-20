import Link from "next/link";
import { CheckCircle2, RefreshCw, RotateCcw, Lock, FileText } from "lucide-react";

const PROOF_POINTS = [
  {
    icon: RefreshCw,
    title: "Re-crawled & Regression Guarded",
    line: "After every PR merge or CMS publish, Reigel re-crawls to confirm the defect is gone — and automatically re-opens it with Slack, Discord, or REST webhook alerts if it ever returns.",
  },
  {
    icon: RotateCcw,
    title: "BEFORE snapshots & 1-Click Safe Rollback",
    line: "Every direct WordPress, Shopify, and Webflow change stores the exact previous page state so you can undo safely in one click.",
  },
  {
    icon: Lock,
    title: "Frozen monthly snapshots & zero-login client portals",
    line: "Lock month-end reports into immutable snapshots and share a white-labeled portal link with clients — no login required.",
  },
  {
    icon: FileText,
    title: "Server A4 PDF & 1-Click CSV exports",
    line: "Download agency-branded executive summaries, Fix Impact Ledgers, backlink recovery logs, and keyword reports in seconds.",
  },
];

export function ProofLedger() {
  return (
    <section id="proof" className="py-20 border-t border-brand-200 scroll-mt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-[1fr_1fr] gap-10 lg:gap-16 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-brand-500 mb-3">Prove it</p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-brand-950 leading-tight tracking-tight">
              Most tools tell you a number went up.
              <br />
              <span className="text-signal-400">We show you what changed.</span>
            </h2>
            <p className="mt-4 text-base sm:text-lg text-brand-500 leading-relaxed max-w-xl">
              Every fix is checked after it ships. Rankings and AI citations take weeks to move, so we track those separately and only claim a fix helped when the evidence supports it.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 bg-signal-400 hover:bg-signal-500 active:scale-[0.98] text-signal-ink font-extrabold text-sm px-6 py-3 rounded-full transition-all shadow-xs"
              >
                Start free audit →
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {PROOF_POINTS.map((p) => {
              const Icon = p.icon;
              return (
                <div key={p.title} className="bg-surface-1 border border-brand-200 rounded-2xl p-4 sm:p-5 flex gap-4 shadow-2xs">
                  <div className="w-10 h-10 rounded-xl bg-surface-2 border border-brand-200 flex items-center justify-center shrink-0 text-success-500">
                    <Icon size={18} />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-brand-950 flex items-center gap-1.5">
                      {p.title}
                      <CheckCircle2 size={13} className="text-success-500" />
                    </h3>
                    <p className="text-xs sm:text-sm text-brand-500 mt-1 leading-relaxed">{p.line}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
