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
    <div className="min-h-screen bg-brand-950 text-brand-50 flex flex-col relative overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-series-6/10 blur-[130px] rounded-full pointer-events-none" />

      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-brand-800 bg-brand-950/80 backdrop-blur-md relative z-10">
        <Link href="/" className="text-xl font-extrabold tracking-tight text-white">
          Growth<span className="text-series-6">X</span>
        </Link>
        {/* Progress indicator */}
        <div className="flex items-center gap-2">
          {[
            { num: "01", label: "Website", active: true },
            { num: "02", label: "Analyze", active: false },
            { num: "03", label: "Results", active: false },
          ].map((step, i) => (
            <div key={step.num} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-brand-800" />}
              <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${step.active ? "text-series-6" : "text-brand-500"}`}>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step.active ? "bg-series-6 text-white" : "bg-brand-900 border border-brand-800 text-brand-500"}`}>
                  {step.num}
                </span>
                <span className="hidden sm:block">{step.label}</span>
              </div>
            </div>
          ))}
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-16 relative z-10">
        <div className="w-full max-w-xl">
          {/* Icon */}
          <div className="w-14 h-14 rounded-2xl bg-series-6 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-series-6/20">
            <Globe size={24} className="text-white" />
          </div>

          {/* Headline */}
          <h1 className="text-4xl font-extrabold text-white text-center tracking-tight leading-tight mb-3">
            Let&apos;s analyze your website
          </h1>
          <p className="text-base text-brand-400 text-center leading-relaxed mb-8">
            Enter your website and GrowthX will analyze your SEO, competitors and AI visibility.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="relative">
              <Globe size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-500 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={(e) => { setUrl(e.target.value); setError(""); }}
                placeholder="https://yourwebsite.com"
                className={`w-full pl-11 pr-4 py-4 text-base border ${error ? "border-error-500 bg-brand-900" : "border-brand-800 bg-brand-900/90"} rounded-2xl shadow-sm focus:outline-none focus:ring-2 focus:ring-series-6/50 focus:border-series-6 transition-all text-white placeholder:text-brand-500`}
                autoFocus
                autoComplete="url"
                disabled={loading}
              />
              {url && isValidUrl(url) && !error && (
                <CheckCircle size={16} className="absolute right-4 top-1/2 -translate-y-1/2 text-success-400" />
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 text-error-400 text-sm">
                <AlertCircle size={14} />
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-series-6 hover:bg-series-6/90 active:bg-series-6 disabled:opacity-70 text-white font-bold text-base py-4 rounded-2xl transition-all shadow-md hover:shadow-series-6/25 hover:shadow-lg cursor-pointer"
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
                <div key={item.label} className="flex items-center gap-1.5 text-[13px] text-brand-400">
                  <Icon size={13} className="text-success-400" />
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
