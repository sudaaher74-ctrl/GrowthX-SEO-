"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Globe, Sparkles, CheckCircle, AlertCircle } from "lucide-react";

function isValidUrl(value: string) {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.includes(".");
  } catch {
    return false;
  }
}

function normalizeUrl(value: string) {
  if (!value.startsWith("http")) return `https://${value}`;
  return value;
}

export default function AnalyzePage() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter your website URL.");
      return;
    }
    if (!isValidUrl(trimmed)) {
      setError("Please enter a valid website URL (e.g. yoursite.com).");
      return;
    }
    setLoading(true);
    const normalized = encodeURIComponent(normalizeUrl(trimmed));
    router.push(`/analyze/progress?url=${normalized}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30 flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-slate-900">
          Growth<span className="text-violet-600">X</span>
        </Link>
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: "01", label: "Website", active: true },
            { num: "02", label: "Analyze", active: false },
            { num: "03", label: "Results", active: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-slate-200" />}
              <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${step.active ? "text-violet-600" : "text-slate-400"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step.active ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-400"}`}>
                  {step.num}
                </span>
                <span className="hidden sm:block">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
        <div className="w-full max-w-xl">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-violet-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-violet-200">
            <Globe size={24} className="text-white" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold text-slate-900 text-center tracking-tight leading-tight mb-3">
            Let&apos;s analyze your website
          </h1>
          <p className="text-base text-slate-500 text-center leading-relaxed mb-8">
            Enter your website and GrowthX will analyze your SEO, competitors and AI visibility.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Globe size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="https://yourwebsite.com"
                className={`w-full pl-11 pr-4 py-4 text-base border ${error ? "border-red-400 bg-red-50" : "border-slate-200 bg-white"} rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-400 transition-all text-slate-900 placeholder:text-slate-400`}
                autoFocus
                autoComplete="url"
                disabled={loading}
              />
              {url && isValidUrl(url) && !error && (
                <CheckCircle size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500" />
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-red-600 text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-700 active:bg-violet-800 disabled:opacity-70 text-white font-bold text-base py-4 rounded-2xl transition-all shadow-md hover:shadow-violet-300 hover:shadow-lg"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Starting analysis...
                </>
              ) : (
                <>
                  Analyze Website <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Trust signals */}
          <div className="flex flex-wrap justify-center items-center gap-5 mt-6">
            {[
              { icon: CheckCircle, label: "Free analysis" },
              { icon: CheckCircle, label: "No credit card required" },
              { icon: Sparkles, label: "AI-powered insights" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-1.5 text-[13px] text-slate-500">
                  <Icon size={13} className="text-emerald-500" />
                  {item.label}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
