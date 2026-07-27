"use client";
import { motion } from "framer-motion";
import Link from "next/link";
import { Globe, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #1f182c 0%, #2d1e42 40%, #1f2e26 100%)" }}>
      {/* Background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-20 blur-3xl" style={{ background: "radial-gradient(circle, #7c3aed, transparent)" }}/>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 rounded-full opacity-15 blur-3xl" style={{ background: "radial-gradient(circle, #a855f7, transparent)" }}/>
        <div className="absolute top-3/4 left-1/2 w-64 h-64 rounded-full opacity-10 blur-3xl" style={{ background: "radial-gradient(circle, #10b981, transparent)" }}/>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        {/* Glass card */}
        <div className="glass-strong rounded-2xl p-8">
          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl gradient-bg-brand flex items-center justify-center mb-4 shadow-glow-brand">
              <Globe size={26} className="text-white"/>
            </div>
            <h1 className="text-h2 text-white text-center">Welcome to GrowthX AI SEO</h1>
            <p className="text-sm text-slate-400 text-center mt-1">AI-powered SEO automation for modern businesses</p>
          </div>

          {/* OAuth buttons */}
          <div className="space-y-3 mb-6">
            <Link href="/dashboard">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-base">
                <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#8b5cf6" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                Continue with Google
              </motion.button>
            </Link>
            <Link href="/dashboard">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-white/20 bg-white/10 text-white font-semibold text-sm hover:bg-white/15 transition-base mt-3">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
                Continue with GitHub
              </motion.button>
            </Link>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-white/15"/>
            <span className="text-xs text-slate-500">or continue with email</span>
            <div className="flex-1 h-px bg-white/15"/>
          </div>

          {/* Email form */}
          <div className="space-y-3">
            <input type="email" placeholder="Email address" defaultValue="sudarshan@growthx.in"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-400 transition-base"/>
            <input type="password" placeholder="Password" defaultValue="••••••••"
              className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-sm focus:outline-none focus:border-purple-400 transition-base"/>
            <Link href="/dashboard" className="block">
              <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl gradient-bg-brand text-white font-bold text-sm shadow-glow-brand hover:brightness-110 transition-base">
                Sign In to GrowthX
              </motion.button>
            </Link>
          </div>

          <p className="text-center text-sm text-slate-500 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-purple-400 cursor-pointer hover:text-purple-300 font-medium">Start free trial</Link>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-slate-600 mt-4">
          Trusted by 500+ agencies & businesses · SOC2-ready · GDPR compliant
        </p>
      </motion.div>
    </div>
  );
}
