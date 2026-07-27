"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Globe, ArrowRight, CheckCircle2, Search, Zap, Shield, Sparkles, Building2, MapPin, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const industries = [
  "E-commerce & Retail", "SaaS & Technology", "Agency & Marketing",
  "Food & Beverage / Dairy", "Healthcare & Medical", "Real Estate",
  "Legal & Finance", "Local Business / Services", "Other"
];

export default function RegisterPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [gscConnected, setGscConnected] = useState(false);
  const [gaConnected, setGaConnected] = useState(false);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const router = useRouter();

  const handleNext = () => {
    if (step === 3) {
      setStep(4);
      // Simulate automated crawler
      let p = 0;
      const interval = setInterval(() => {
        p += 20;
        setCrawlProgress(p);
        if (p >= 100) {
          clearInterval(interval);
        }
      }, 600);
    } else {
      setStep(step + 1);
    }
  };

  const handleConnectGsc = () => {
    setLoading(true);
    setTimeout(() => {
      setGscConnected(true);
      setLoading(false);
    }, 1200);
  };

  const handleConnectGa = () => {
    setLoading(true);
    setTimeout(() => {
      setGaConnected(true);
      setLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #07070f 0%, #120824 40%, #07140f 100%)" }}>
      {/* Background glowing orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #6366f1, transparent)" }} />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #8b5cf6, transparent)" }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" as const }}
        className="w-full max-w-xl"
      >
        {/* Glass card */}
        <div className="glass-strong rounded-3xl p-8 md:p-10 border border-white/15 shadow-2xl">
          {/* Logo & Step indicator */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl gradient-bg-brand flex items-center justify-center shadow-glow-brand">
                <Globe size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-white tracking-tight">GrowthX AI SEO</span>
            </div>

            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span>Step {step} of 4</span>
              <div className="flex gap-1 ml-2">
                {[1, 2, 3, 4].map(s => (
                  <div key={s} className={cn("w-6 h-1.5 rounded-full transition-all duration-300", s === step ? "gradient-bg-brand w-8" : s < step ? "bg-emerald-500" : "bg-white/20")} />
                ))}
              </div>
            </div>
          </div>

          <AnimatePresence mode="wait">
            {/* Step 1: Account Creation */}
            {step === 1 && (
              <motion.div key="step-1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-5">
                <div>
                  <h2 className="text-h2 text-white">Create your account</h2>
                  <p className="text-sm text-slate-400 mt-1">Start your 14-day free trial on the Growth plan. No credit card required.</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">First Name</label>
                    <input type="text" defaultValue="Sudarshan" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-base" />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Company Name</label>
                    <input type="text" defaultValue="GrowthX Agency" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-base" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Work Email</label>
                  <input type="email" defaultValue="sudarshan@growthx.in" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-base" />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Password</label>
                  <input type="password" defaultValue="••••••••••••" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-base" />
                </div>

                <Button variant="primary" size="lg" className="w-full mt-2" onClick={handleNext} iconRight={<ArrowRight size={16} />}>
                  Continue to Workspace Setup
                </Button>

                <p className="text-center text-xs text-slate-500 mt-4">
                  Already have an account? <Link href="/login" className="text-indigo-400 hover:underline">Sign in here</Link>
                </p>
              </motion.div>
            )}

            {/* Step 2: Workspace Setup */}
            {step === 2 && (
              <motion.div key="step-2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-5">
                <div>
                  <h2 className="text-h2 text-white">Set up your workspace</h2>
                  <p className="text-sm text-slate-400 mt-1">Tell us about your target website so our AI can configure your rank tracking and audit profiles.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Primary Website Domain</label>
                  <div className="relative">
                    <Globe size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input type="text" defaultValue="milquu.com" className="w-full bg-white/10 border border-white/20 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 text-sm font-mono focus:outline-none focus:border-indigo-400 transition-base" />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Industry / Niche</label>
                  <select defaultValue="Food & Beverage / Dairy" className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-indigo-400 transition-base">
                    {industries.map(ind => <option key={ind} value={ind} className="bg-slate-900 text-white">{ind}</option>)}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wide block mb-1.5">Primary Target Location</label>
                  <div className="relative">
                    <MapPin size={16} className="absolute left-4 top-3.5 text-slate-400" />
                    <input type="text" defaultValue="Navi Mumbai, Maharashtra, India" className="w-full bg-white/10 border border-white/20 rounded-xl pl-11 pr-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-indigo-400 transition-base" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="secondary" size="lg" className="w-1/3 bg-white/10 border-white/20 text-white" onClick={() => setStep(1)}>Back</Button>
                  <Button variant="primary" size="lg" className="w-2/3" onClick={handleNext} iconRight={<ArrowRight size={16} />}>
                    Connect Integrations
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 3: Connect Integrations */}
            {step === 3 && (
              <motion.div key="step-3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.25 }} className="space-y-6">
                <div>
                  <h2 className="text-h2 text-white">Connect data sources</h2>
                  <p className="text-sm text-slate-400 mt-1">Connect Google Search Console and GA4 to unlock AI keyword recommendations and traffic insights.</p>
                </div>

                <div className="space-y-4">
                  {/* GSC Card */}
                  <div className={cn("p-5 rounded-2xl border transition-base flex items-center justify-between", gscConnected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/15")}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                        <Search size={22} />
                      </div>
                      <div>
                        <div className="text-base font-bold text-white flex items-center gap-2">
                          Google Search Console
                          {gscConnected && <CheckCircle2 size={15} className="text-emerald-400" />}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">Required for keyword rank tracking & indexing checks</div>
                      </div>
                    </div>
                    <Button
                      variant={gscConnected ? "secondary" : "primary"}
                      size="sm"
                      onClick={handleConnectGsc}
                      loading={loading}
                      disabled={gscConnected}
                    >
                      {gscConnected ? "Connected ✓" : "Connect GSC"}
                    </Button>
                  </div>

                  {/* GA4 Card */}
                  <div className={cn("p-5 rounded-2xl border transition-base flex items-center justify-between", gaConnected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/5 border-white/15")}>
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center text-amber-400 font-bold shrink-0">
                        <BarChart3 size={22} />
                      </div>
                      <div>
                        <div className="text-base font-bold text-white flex items-center gap-2">
                          Google Analytics 4
                          {gaConnected && <CheckCircle2 size={15} className="text-emerald-400" />}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">Required for session funnels & conversion tracking</div>
                      </div>
                    </div>
                    <Button
                      variant={gaConnected ? "secondary" : "primary"}
                      size="sm"
                      onClick={handleConnectGa}
                      loading={loading}
                      disabled={gaConnected}
                    >
                      {gaConnected ? "Connected ✓" : "Connect GA4"}
                    </Button>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button variant="secondary" size="lg" className="w-1/3 bg-white/10 border-white/20 text-white" onClick={() => setStep(2)}>Back</Button>
                  <Button variant="primary" size="lg" className="w-2/3" onClick={handleNext} iconRight={<Sparkles size={16} />}>
                    {gscConnected ? "Start AI Site Audit" : "Skip & Continue"}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: AI Audit & Initialization */}
            {step === 4 && (
              <motion.div key="step-4" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3 }} className="text-center py-6 space-y-6">
                <div className="w-20 h-20 rounded-3xl gradient-bg-brand mx-auto flex items-center justify-center shadow-glow-brand relative">
                  <Sparkles size={36} className="text-white animate-pulse" />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-white border-2 border-slate-900">
                    <CheckCircle2 size={16} />
                  </div>
                </div>

                <div>
                  <h2 className="text-h2 text-white">Configuring GrowthX AI for milquu.com</h2>
                  <p className="text-sm text-slate-400 mt-2 max-w-md mx-auto">
                    Our AI is crawling sitemaps, extracting top keywords, and generating your baseline 78/100 SEO health scorecard.
                  </p>
                </div>

                {/* Progress bar */}
                <div className="max-w-sm mx-auto space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span>{crawlProgress < 100 ? "Analyzing sitemaps & SERPs..." : "Audit Complete!"}</span>
                    <span>{crawlProgress}%</span>
                  </div>
                  <div className="h-3 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/20">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${crawlProgress}%` }}
                      transition={{ duration: 0.5 }}
                      className="h-full gradient-bg-brand rounded-full"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <Button
                    variant="primary"
                    size="lg"
                    className="w-full max-w-sm mx-auto font-bold shadow-glow-brand"
                    disabled={crawlProgress < 100}
                    onClick={() => router.push("/dashboard")}
                    iconRight={<ArrowRight size={18} />}
                  >
                    {crawlProgress < 100 ? "Please Wait..." : "Launch Dashboard 🚀"}
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <p className="text-center text-xs text-slate-500 mt-6">
          SOC2-Ready · 256-bit SSL Encryption · GDPR & CCPA Compliant
        </p>
      </motion.div>
    </div>
  );
}
