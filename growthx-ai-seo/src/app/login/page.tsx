"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Zap,
  Users,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  Globe,
  ShieldCheck,
  Loader2,
  Quote,
  Sun,
  Moon,
} from "lucide-react";
import { api, auth, getApiBase } from "@/lib/api-client";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlParam = (searchParams.get("url") || "").trim();
  const planParam = searchParams.get("plan");
  const cycleParam = searchParams.get("cycle");
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error") || null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (urlParam) {
      try {
        localStorage.setItem("growthx_pending_domain", urlParam);
      } catch {}
    }
    if (planParam) {
      try {
        sessionStorage.setItem("growthx_pending_plan", planParam);
      } catch {}
    }
    if (cycleParam) {
      try {
        sessionStorage.setItem("growthx_pending_cycle", cycleParam);
      } catch {}
    }
  }, [urlParam, planParam, cycleParam]);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.email || !form.password) {
      setError("Please enter both email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      await api.login(form.email, form.password);

      // Pick up the caller's first organization so the dashboard has a workspace
      const orgs = await api.listOrganizations();
      const firstOrgId = orgs?.[0]?.id ?? null;
      if (firstOrgId) auth.setOrgId(firstOrgId);

      let pendingDomain = urlParam;
      if (!pendingDomain) {
        try {
          pendingDomain = (localStorage.getItem("growthx_pending_domain") || "").trim();
        } catch {}
      }

      if (pendingDomain) {
        router.push(`/analyze?url=${encodeURIComponent(pendingDomain)}`);
        return;
      }

      const existingProjects = firstOrgId ? await api.listProjects(firstOrgId).catch(() => []) : [];
      if (!existingProjects || existingProjects.length === 0) {
        router.push("/analyze");
        return;
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
      {/* Pending Website Audit Pill */}
      {urlParam && (
        <div className="mb-5 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2 text-xs font-semibold text-brand-950 shadow-2xs">
          <Globe size={14} className="text-brand-700 shrink-0" />
          <span>
            Auditing <strong className="font-mono text-brand-950">{urlParam}</strong> right after sign-in
          </span>
        </div>
      )}

      {/* Heading */}
      <h2 className="text-3xl font-black text-brand-950 tracking-tight mb-1">
        Welcome back
      </h2>
      <p className="text-sm text-brand-500 mb-8">
        {urlParam ? `Sign in to start crawling ${urlParam}` : "Log in to your Reigel account"}
      </p>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Email */}
        <div>
          <label className="block text-xs font-bold text-brand-700 mb-1.5">
            Email address
          </label>
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={set("email")}
              placeholder="you@company.com"
              className="w-full pl-10 pr-4 py-3 text-sm rounded-xl border border-brand-200 bg-surface-1 placeholder:text-brand-400 text-brand-950 focus:outline-none focus:border-brand-400 transition-all"
            />
          </div>
        </div>

        {/* Password */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-bold text-brand-700">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none" />
            <input
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              value={form.password}
              onChange={set("password")}
              placeholder="Enter your password"
              className="w-full pl-10 pr-10 py-3 text-sm rounded-xl border border-brand-200 bg-surface-1 placeholder:text-brand-400 text-brand-950 focus:outline-none focus:border-brand-400 transition-all"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-500 hover:text-brand-950 cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>

        {/* Error Notification */}
        {error && (
          <div
            role="alert"
            className="rounded-xl border border-error-500/40 bg-error-50 px-3.5 py-2.5 text-xs text-error-600 font-medium"
          >
            {error}
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={busy}
          className="w-full inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-extrabold text-signal-ink bg-signal-400 hover:bg-signal-500 active:scale-[0.99] shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Log in</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>
      </form>

      {/* Divider */}
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-brand-200" />
        </div>
        <div className="relative flex justify-center text-[10px] uppercase font-bold tracking-wider">
          <span className="px-3 text-brand-400" style={{ background: "var(--color-canvas)" }}>
            Or continue with
          </span>
        </div>
      </div>

      {/* Social Logins */}
      <div className="space-y-2.5">
        <a
          href={`${getApiBase()}/auth/google`}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-full border border-brand-200 bg-surface-1 hover:bg-surface-2 text-xs sm:text-sm font-semibold text-brand-900 shadow-2xs transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          <span>Continue with Google</span>
        </a>
      </div>

      {/* Security Note */}
      <div className="mt-8 flex items-center justify-center gap-1.5 text-xs text-brand-500">
        <ShieldCheck size={14} className="text-success-500" />
        <span>Your data is secure with enterprise-grade encryption.</span>
      </div>
    </div>
  );
}

const PARTNER_LOGOS = [
  "Milquu Fresh",
  "Aiva Enterprises",
  "OS Interior",
  "Dron Archery Academy",
  "Brand Kettle",
  "Immunity Group",
];

export default function LoginPage() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const referrer = typeof document !== "undefined" ? document.referrer : "";
    if (/(^|\.)(google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|search\.brave\.)/i.test(referrer)) {
      router.replace("/");
    }
  }, [router]);

  return (
    <div
      className={cn(
        isDark ? "dash-dark dark" : "dash-light",
        "min-h-screen flex flex-col lg:flex-row text-brand-950 transition-colors duration-200",
      )}
      style={{ background: "var(--color-canvas)" }}
    >
      {/* LEFT SIDE: Brand & Value Showcase */}
      <div className="relative bg-surface-1 p-8 sm:p-12 lg:p-14 flex flex-col justify-between border-r border-brand-200 w-full lg:w-[48%] xl:w-[45%]">
        {/* Brand Header */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-signal-400 font-mono text-xs font-extrabold text-signal-ink shadow-xs">
              R
            </span>
            <span className="text-2xl font-black tracking-tight text-brand-950">
              Reigel
            </span>
            <span className="rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-brand-500">
              AI SEO
            </span>
          </Link>
        </div>

        {/* Main Content */}
        <div className="relative z-10 my-8 sm:my-10 space-y-6">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-brand-950 tracking-tight leading-tight">
              Sign in and <br />
              keep{" "}
              <span className="text-signal-400">
                growing.
              </span>
            </h1>
            <p className="text-sm text-brand-500 mt-2.5 max-w-md leading-relaxed">
              Access your dashboard, track progress and let Reigel do the heavy lifting.
            </p>
          </div>

          {/* 3 Value Pillars */}
          <div className="space-y-4 pt-1">
            {/* 1 */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-surface-2 text-brand-900 flex items-center justify-center shrink-0 border border-brand-200">
                <BarChart3 size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-950 leading-snug">
                  Your growth in one place
                </h4>
                <p className="text-xs text-brand-500 mt-0.5 leading-relaxed">
                  See SEO, AI visibility and competitor insights at a glance.
                </p>
              </div>
            </div>

            {/* 2 */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-surface-2 text-signal-400 flex items-center justify-center shrink-0 border border-brand-200">
                <Zap size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-950 leading-snug">
                  Execution that saves time
                </h4>
                <p className="text-xs text-brand-500 mt-0.5 leading-relaxed">
                  Approve your plan and let Reigel implement the improvements.
                </p>
              </div>
            </div>

            {/* 3 */}
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-2xl bg-surface-2 text-success-500 flex items-center justify-center shrink-0 border border-brand-200">
                <Users size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-950 leading-snug">
                  Built for businesses
                </h4>
                <p className="text-xs text-brand-500 mt-0.5 leading-relaxed">
                  Join growing teams that trust Reigel to drive results.
                </p>
              </div>
            </div>
          </div>

          {/* Founder Testimonial Card */}
          <div className="bg-surface-2 rounded-2xl p-4 sm:p-5 border border-brand-200 shadow-2xs relative mt-6">
            <div className="w-7 h-7 rounded-xl bg-surface-1 border border-brand-200 text-brand-700 flex items-center justify-center mb-2.5">
              <Quote size={15} />
            </div>
            <p className="text-xs text-brand-700 leading-relaxed italic mb-3">
              &ldquo;Reigel completely changed how we approach SEO and AI search. The automated execution saves weeks of engineering time every month.&rdquo;
            </p>
            <div className="flex items-center gap-2.5 pt-2 border-t border-brand-200">
              <div className="w-8 h-8 rounded-full bg-signal-400 text-signal-ink font-black text-xs flex items-center justify-center shadow-2xs">
                SA
              </div>
              <div>
                <h5 className="text-xs font-bold text-brand-950 leading-tight">
                  Sudarshan Aher
                </h5>
                <p className="text-[10px] text-brand-500 font-medium">
                  Founder &amp; CEO, Reigel
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Brand Badges */}
        <div className="relative z-10 pt-4">
          <p className="text-[10px] font-bold uppercase tracking-wider text-brand-400 mb-2.5">
            Trusted by growing businesses
          </p>
          <div className="flex flex-wrap items-center gap-5 text-xs font-bold text-brand-500">
            {PARTNER_LOGOS.map((brand) => (
              <span key={brand} className="hover:text-brand-950 transition-colors">
                {brand}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Authentication Form */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-10 lg:p-12">
        {/* Top bar with Back to website + Day/Night toggle + View plans */}
        <div className="flex items-center justify-between gap-2 text-xs text-brand-500">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-brand-200 bg-surface-1 text-brand-800 font-semibold hover:text-brand-950 hover:bg-surface-2 transition-all cursor-pointer"
          >
            <ArrowLeft size={13} />
            <span>Back to website</span>
          </Link>

          <div className="flex items-center gap-2.5">
            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              title={isDark ? "Switch to Day mode" : "Switch to Night mode"}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-brand-200 bg-surface-1 text-brand-600 transition-colors hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
            >
              {isDark ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            <Link
              href="/pricing"
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-brand-200 bg-surface-1 text-brand-950 font-bold hover:bg-surface-2 transition-all cursor-pointer"
            >
              <span>View plans</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Form Container */}
        <Suspense
          fallback={
            <div className="w-full max-w-md mx-auto my-auto py-8 space-y-4 animate-pulse">
              <div className="h-8 bg-surface-1 rounded-lg w-1/2" />
              <div className="h-4 bg-surface-1 rounded-lg w-3/4" />
              <div className="h-12 bg-surface-1 rounded-xl" />
              <div className="h-12 bg-surface-1 rounded-xl" />
              <div className="h-12 bg-surface-2 rounded-xl" />
            </div>
          }
        >
          <LoginFormInner />
        </Suspense>

        {/* Empty bottom spacer for symmetry */}
        <div className="h-4" />
      </div>
    </div>
  );
}
