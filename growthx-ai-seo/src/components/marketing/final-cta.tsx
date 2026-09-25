"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Globe } from "lucide-react";
import { auth } from "@/lib/api-client";

export function FinalCTA() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    setLoading(true);
    const destination = auth.isAuthenticated() ? "/dashboard" : "/register";
    if (trimmed) {
      const clean = trimmed.replace(/^https?:\/\//i, "");
      router.push(`${destination}?url=${encodeURIComponent(clean)}`);
    } else {
      router.push(destination);
    }
  };

  return (
    <section className="py-24 bg-brand-950 border-t border-brand-900 relative overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-br from-brand-900 via-brand-900 to-brand-950 rounded-3xl p-8 sm:p-14 lg:p-16 relative overflow-hidden border border-brand-800 shadow-2xl">
          {/* Ambient Lighting */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full bg-series-6/20 blur-3xl" />
            <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-accent-500/10 blur-3xl" />
          </div>

          <div className="relative max-w-3xl mx-auto text-center space-y-6">
            <p className="text-xs font-bold uppercase tracking-widest text-series-6">
              Start Winning Your Market
            </p>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white leading-tight tracking-tight">
              Your competitors are already optimising.{" "}
              <span className="bg-gradient-to-r from-series-6 to-accent-400 bg-clip-text text-transparent">
                Let&apos;s catch up by Monday.
              </span>
            </h2>
            <p className="text-base sm:text-lg text-brand-300 leading-relaxed max-w-xl mx-auto">
              Get your free audit in about a minute. No card needed.
            </p>

            {/* URL Audit Box */}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col sm:flex-row items-stretch gap-2 bg-brand-950/90 border border-brand-800 rounded-2xl p-2 shadow-2xl focus-within:border-series-6 transition-colors max-w-xl mx-auto"
            >
              <div className="flex items-center gap-2.5 px-3 py-2 flex-1">
                <Globe size={18} className="text-brand-400 shrink-0" />
                <input
                  type="text"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="yourwebsite.com"
                  className="bg-transparent text-white placeholder-brand-500 text-sm font-medium w-full focus:outline-none"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center justify-center gap-2 bg-series-6 hover:bg-series-6/90 active:scale-[0.98] text-white font-bold text-sm px-6 py-3.5 rounded-xl transition-all shadow-lg shrink-0 cursor-pointer disabled:opacity-50"
              >
                {loading ? (
                  <span>Opening…</span>
                ) : (
                  <>
                    <span>Run free audit</span>
                    <ArrowRight size={15} />
                  </>
                )}
              </button>
            </form>

            <p className="text-xs text-brand-500 font-medium pt-1">
              Free &bull; No credit card required &bull; Results in about 60 seconds
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
