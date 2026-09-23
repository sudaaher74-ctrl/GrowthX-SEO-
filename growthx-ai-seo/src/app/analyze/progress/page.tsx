"use client";

import { Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Globe, Search, Users, MapPin, ListChecks, Loader2, ArrowRight, CheckCircle2 } from "lucide-react";

interface Check {
  id: string;
  title: string;
  desc: string;
  icon: typeof Globe;
}

/**
 * What the audit covers once the account exists.
 *
 * This page used to play a scripted "analysis" on a timer — a progress bar, a
 * "Live Scan" badge and log lines such as "Discovered sitemap.xml with 38
 * canonical URLs" — before anything had been fetched. Nothing is crawled until
 * the site is verified after sign-up, so the page now says what will be checked
 * instead of reporting findings that were never made.
 */
const CHECKS: Check[] = [
  {
    id: "crawl",
    title: "Crawl your website",
    desc: "Every reachable page: titles, meta tags, headings, canonicals, structured data and speed.",
    icon: Globe,
  },
  {
    id: "audit",
    title: "Technical & on-page audit",
    desc: "Indexability, broken pages, duplicate and missing tags, thin content — grouped and prioritised.",
    icon: Search,
  },
  {
    id: "competitors",
    title: "Competitor intelligence",
    desc: "The businesses that rank for your customers' searches, and where their pages beat yours.",
    icon: Users,
  },
  {
    id: "gbp",
    title: "Google Business Profile",
    desc: "Connect your listing to audit it, track local rankings and reply to reviews.",
    icon: MapPin,
  },
  {
    id: "plan",
    title: "Action plan",
    desc: "The problems found, in the order worth fixing, each with the pages it affects.",
    icon: ListChecks,
  },
];

function ProgressInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawUrl = searchParams.get("url")?.trim() ?? "";

  let hostname = "";
  if (rawUrl) {
    try {
      hostname = new URL(rawUrl.startsWith("http") ? rawUrl : `https://${rawUrl}`).hostname;
    } catch {
      hostname = rawUrl;
    }
  }

  const registerHref = hostname ? `/register?domain=${encodeURIComponent(hostname)}` : "/register";

  return (
    <div className="min-h-screen bg-brand-950 text-brand-50 flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-series-6/10 blur-[140px] rounded-full pointer-events-none" />

      <header className="flex items-center justify-between px-6 py-4 border-b border-brand-800 bg-brand-950/80 backdrop-blur-md relative z-10">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-white">
          Growth<span className="text-series-6">X</span>
        </Link>
        <div className="flex items-center gap-2">
          {[
            { num: "01", label: "Website", completed: Boolean(hostname), active: !hostname },
            { num: "02", label: "Create account", active: Boolean(hostname), completed: false },
            { num: "03", label: "Audit", active: false, completed: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-brand-800" />}
              <div
                className={`flex items-center gap-1.5 text-[12px] font-semibold ${
                  step.active ? "text-series-6" : step.completed ? "text-success-400" : "text-brand-500"
                }`}
              >
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    step.completed
                      ? "bg-success-600 text-white"
                      : step.active
                      ? "bg-series-6 text-white"
                      : "bg-brand-900 border border-brand-800 text-brand-500"
                  }`}
                >
                  {step.completed ? "✓" : step.num}
                </span>
                <span className="hidden sm:block">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="w-full max-w-2xl">
          {hostname && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-brand-900 text-brand-300 border border-brand-800">
                <Globe size={12} className="text-series-6" />
                {hostname}
              </span>
            </div>
          )}

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white text-center tracking-tight mb-2">
            {hostname ? "Your audit is ready to run" : "Which website should we audit?"}
          </h1>
          <p className="text-sm sm:text-base text-brand-400 text-center mb-8">
            {hostname
              ? "Create a free account and verify the site, and GrowthX will run these checks on your real pages."
              : "Enter your website to see what the audit covers."}
          </p>

          <div className="bg-brand-900/40 rounded-2xl border border-brand-800 p-5 shadow-xl space-y-3 mb-8">
            {CHECKS.map((check) => {
              const Icon = check.icon;
              return (
                <div key={check.id} className="flex items-start gap-3.5 p-3 rounded-xl bg-brand-950/50">
                  <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-brand-800 text-series-6">
                    <Icon size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white">{check.title}</p>
                    <p className="text-xs text-brand-400 mt-0.5">{check.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-3">
            <button
              onClick={() => router.push(hostname ? registerHref : "/analyze")}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-xl text-base font-semibold text-white bg-series-6 hover:bg-series-6/90 shadow-lg shadow-series-6/20 transition-all hover:scale-[1.02] cursor-pointer"
            >
              <span>{hostname ? "Create account & run audit" : "Enter your website"}</span>
              <ArrowRight size={18} />
            </button>
            <p className="flex items-center gap-1.5 text-xs text-brand-400">
              <CheckCircle2 size={13} className="text-success-400" />
              No credit card required
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

export default function AnalysisProgressPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-brand-950">
          <Loader2 size={18} className="animate-spin text-series-6" />
        </div>
      }
    >
      <ProgressInner />
    </Suspense>
  );
}
