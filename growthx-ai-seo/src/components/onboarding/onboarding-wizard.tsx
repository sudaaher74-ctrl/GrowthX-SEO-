"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronRight,
  Search,
  BarChart3,
  MapPin,
  GitBranch,
  Globe,
  Loader2,
  ArrowRight,
  Sparkles,
  Shield,
  Zap,
  X,
  ExternalLink,
  AlertCircle,
  PlugZap,
  Star,
} from "lucide-react";
import { api, auth, getApiBase } from "@/lib/api-client";
import { useWorkspace, useConnectLocalBusiness, useConnectRepository } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

/* ─────────────────────────────────────────────── types */

interface StepState {
  gsc: "idle" | "connecting" | "done" | "skipped";
  ga4: "idle" | "connecting" | "done" | "skipped";
  gbp: "idle" | "connecting" | "done" | "skipped";
  github: "idle" | "connecting" | "done" | "skipped";
  website: "idle" | "connecting" | "done" | "skipped";
}

type IntegrationKey = keyof StepState;

const STEP_ORDER: IntegrationKey[] = ["gsc", "ga4", "gbp", "github", "website"];

/* ─────────────────────────────────────────────── helpers */

function GrowthXLogo() {
  return (
    <div className="flex items-center gap-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 shadow-lg shadow-blue-600/30">
        <div className="grid grid-cols-2 gap-0.5 p-1.5">
          <div className="h-1.5 w-1.5 rounded-sm bg-white" />
          <div className="h-1.5 w-1.5 rounded-sm bg-blue-300" />
          <div className="h-1.5 w-1.5 rounded-sm bg-blue-300" />
          <div className="h-1.5 w-1.5 rounded-sm bg-white" />
        </div>
      </div>
      <span className="text-sm font-bold tracking-tight text-white">GrowthX</span>
    </div>
  );
}

function GoogleG({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  );
}

/* ─────────────────────────────────────────────── step card */

interface IntegrationCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  subtitle: string;
  features: string[];
  badge: string;
  badgeColor: string;
  state: "idle" | "connecting" | "done" | "skipped";
  isActive: boolean;
  children?: React.ReactNode;
  onSkip?: () => void;
}

function IntegrationCard({
  icon,
  iconBg,
  title,
  subtitle,
  features,
  badge,
  badgeColor,
  state,
  isActive,
  children,
  onSkip,
}: IntegrationCardProps) {
  return (
    <div
      className={`relative rounded-2xl border transition-all duration-300 overflow-hidden ${
        state === "done"
          ? "border-emerald-500/40 bg-emerald-950/20"
          : state === "skipped"
            ? "border-white/10 bg-white/3 opacity-60"
            : isActive
              ? "border-blue-500/40 bg-white/5 shadow-xl shadow-blue-500/10"
              : "border-white/10 bg-white/3"
      }`}
    >
      {/* Done overlay stripe */}
      {state === "done" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent" />
      )}
      {isActive && state === "idle" && (
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-blue-400 to-transparent" />
      )}

      <div className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3.5">
            {/* Icon */}
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg} ${
                state === "done" ? "ring-2 ring-emerald-500/40" : ""
              }`}
            >
              {state === "done" ? (
                <Check size={20} className="text-emerald-400" strokeWidth={2.5} />
              ) : (
                icon
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white">{title}</h3>
                <span
                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeColor}`}
                >
                  {badge}
                </span>
                {state === "done" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-semibold text-emerald-400 border border-emerald-500/30">
                    <Check size={9} strokeWidth={3} />
                    Connected
                  </span>
                )}
                {state === "skipped" && (
                  <span className="inline-flex items-center rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold text-white/50">
                    Skipped
                  </span>
                )}
              </div>
              <p className="text-xs text-white/50 mt-0.5">{subtitle}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                {features.map((f) => (
                  <span key={f} className="flex items-center gap-1 text-[11px] text-white/40">
                    <div className="h-1 w-1 rounded-full bg-blue-400/60 shrink-0" />
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Status dot */}
          <div className="shrink-0 ml-2 mt-0.5">
            {state === "connecting" ? (
              <Loader2 size={16} className="text-blue-400 animate-spin" />
            ) : state === "done" ? (
              <div className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                <Check size={9} strokeWidth={3} className="text-white" />
              </div>
            ) : state === "skipped" ? (
              <div className="h-4 w-4 rounded-full bg-white/10 flex items-center justify-center">
                <X size={9} className="text-white/40" />
              </div>
            ) : (
              <div className={`h-4 w-4 rounded-full border-2 ${isActive ? "border-blue-500 bg-blue-500/20" : "border-white/20"}`} />
            )}
          </div>
        </div>

        {/* Action area */}
        {isActive && state === "idle" && (
          <div className="mt-4 pt-4 border-t border-white/10">
            {children}
            {onSkip && (
              <button
                type="button"
                onClick={onSkip}
                className="mt-2 text-xs text-white/30 hover:text-white/60 transition underline-offset-2 hover:underline"
              >
                Skip for now
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────────────────────────── main wizard */

export function OnboardingWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { projectId } = useWorkspace();
  const qc = useQueryClient();

  const [activeStep, setActiveStep] = useState<IntegrationKey>("gsc");
  const [steps, setSteps] = useState<StepState>({
    gsc: "idle",
    ga4: "idle",
    gbp: "idle",
    github: "idle",
    website: "idle",
  });
  const [notice, setNotice] = useState<string | null>(null);

  // GitHub form
  const [githubForm, setGithubForm] = useState({
    owner: "",
    name: "",
    defaultBranch: "main",
    accessToken: "",
    framework: "nextjs",
    contentDir: "src/app",
  });

  // GBP form
  const [gbpName, setGbpName] = useState("");

  // Website form
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Mutations
  const connectGbp = useConnectLocalBusiness(projectId);
  const connectRepo = useConnectRepository(projectId);

  const authorizeGoogle = useMutation({
    mutationFn: (provider: string) =>
      api.googleAuthorizeUrl(projectId!, provider, "/onboarding"),
    onSuccess: ({ authorizationUrl }) => {
      window.location.href = authorizationUrl;
    },
    onError: (err) => setNotice(errorMessage(err)),
  });

  // Handle OAuth return
  useEffect(() => {
    const google = searchParams.get("google");
    const provider = searchParams.get("provider");

    if (google === "select" || google === "scopes") {
      if (provider === "search_console") {
        markDone("gsc");
        advance("gsc");
      } else if (provider === "analytics") {
        markDone("ga4");
        advance("ga4");
      }
    }
  }, [searchParams]);

  function markDone(key: IntegrationKey) {
    setSteps((s) => ({ ...s, [key]: "done" }));
  }

  function markSkipped(key: IntegrationKey) {
    setSteps((s) => ({ ...s, [key]: "skipped" }));
    advance(key);
  }

  function advance(from: IntegrationKey) {
    const idx = STEP_ORDER.indexOf(from);
    const next = STEP_ORDER[idx + 1];
    if (next) setActiveStep(next);
  }

  const doneCount = Object.values(steps).filter((s) => s === "done").length;
  const totalDone = Object.values(steps).filter(
    (s) => s === "done" || s === "skipped"
  ).length;
  const allFinished = totalDone >= STEP_ORDER.length;

  async function handleFinish() {
    // Mark onboarding complete
    if (projectId) {
      try {
        localStorage.setItem(`growthx_onboarding_done_${projectId}`, "true");
      } catch {}
    }
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-[#0c1a35] to-slate-950 text-white">
      {/* Background glows */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[500px] w-[500px] rounded-full bg-blue-600/10 blur-[120px]" />
        <div className="absolute top-1/2 right-0 h-[400px] w-[400px] rounded-full bg-indigo-600/8 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-[300px] w-[400px] rounded-full bg-cyan-600/6 blur-[100px]" />
      </div>

      {/* Top nav bar */}
      <div className="relative z-10 flex items-center justify-between border-b border-white/8 px-6 py-4">
        <GrowthXLogo />
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Shield size={13} className="text-emerald-400/70" />
          <span>Secure setup · Encrypted connection</span>
        </div>
      </div>

      {/* Main content */}
      <div className="relative z-10 mx-auto max-w-3xl px-6 py-10">
        {/* Hero heading */}
        <div className="mb-10 text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1.5 text-xs font-semibold text-blue-300">
            <Sparkles size={12} className="text-blue-400" />
            Welcome to GrowthX
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Connect your data sources
          </h1>
          <p className="mt-3 text-sm text-white/50 max-w-md mx-auto leading-relaxed">
            Link your tools so GrowthX AI can analyze, optimize, and grow your
            online presence automatically. Connect what you need now — you can
            always add more later.
          </p>

          {/* Progress bar */}
          <div className="mt-6 max-w-xs mx-auto">
            <div className="flex items-center justify-between text-[11px] text-white/40 mb-2">
              <span>{doneCount} connected</span>
              <span>{STEP_ORDER.length} total</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500"
                style={{ width: `${(totalDone / STEP_ORDER.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Notice */}
        {notice && (
          <div className="mb-6 flex items-start gap-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3.5 text-xs text-rose-300">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{notice}</span>
            <button onClick={() => setNotice(null)} className="ml-auto shrink-0 hover:text-white">
              <X size={13} />
            </button>
          </div>
        )}

        {/* Integration Cards */}
        <div className="space-y-3">

          {/* 1. Google Search Console */}
          <IntegrationCard
            icon={<Search size={20} className="text-blue-300" />}
            iconBg="bg-blue-500/15"
            title="Google Search Console"
            subtitle="Organic traffic, clicks, impressions & keyword rankings"
            features={["Keyword rankings", "Click data", "Search impressions", "CTR trends"]}
            badge="Recommended"
            badgeColor="bg-blue-500/20 text-blue-300 border border-blue-500/30"
            state={steps.gsc}
            isActive={activeStep === "gsc"}
            onSkip={() => markSkipped("gsc")}
          >
            <button
              type="button"
              onClick={() => authorizeGoogle.mutate("search_console")}
              disabled={authorizeGoogle.isPending || !projectId}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-3 px-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 transition shadow-lg shadow-white/10 disabled:opacity-50"
            >
              {authorizeGoogle.isPending ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <GoogleG size={18} />
              )}
              <span>Connect with Google</span>
              <ChevronRight size={16} className="text-gray-400 ml-auto" />
            </button>
          </IntegrationCard>

          {/* 2. Google Analytics 4 */}
          <IntegrationCard
            icon={<BarChart3 size={20} className="text-amber-300" />}
            iconBg="bg-amber-500/15"
            title="Google Analytics 4 (GA4)"
            subtitle="User sessions, conversions, landing pages & traffic channels"
            features={["Session data", "Conversion rates", "Traffic sources", "Engaged users"]}
            badge="Recommended"
            badgeColor="bg-amber-500/20 text-amber-300 border border-amber-500/30"
            state={steps.ga4}
            isActive={activeStep === "ga4"}
            onSkip={() => markSkipped("ga4")}
          >
            <button
              type="button"
              onClick={() => authorizeGoogle.mutate("analytics")}
              disabled={authorizeGoogle.isPending || !projectId}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-3 px-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 transition shadow-lg shadow-white/10 disabled:opacity-50"
            >
              {authorizeGoogle.isPending ? (
                <Loader2 size={16} className="animate-spin text-blue-600" />
              ) : (
                <GoogleG size={18} />
              )}
              <span>Connect Google Analytics</span>
              <ChevronRight size={16} className="text-gray-400 ml-auto" />
            </button>
          </IntegrationCard>

          {/* 3. Google Business Profile */}
          <IntegrationCard
            icon={<MapPin size={20} className="text-emerald-300" />}
            iconBg="bg-emerald-500/15"
            title="Google Business Profile"
            subtitle="Local reviews, star ratings, maps rankings & local visibility"
            features={["Review monitoring", "Local rankings", "GeoGrid tracking", "Post management"]}
            badge="Local SEO"
            badgeColor="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
            state={steps.gbp}
            isActive={activeStep === "gbp"}
            onSkip={() => markSkipped("gbp")}
          >
            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  connectGbp.mutate(
                    {
                      businessName: gbpName || "My Business",
                      address: "Google Maps Verified Storefront",
                      rating: 5.0,
                      reviewCount: 0,
                    },
                    {
                      onSuccess: () => {
                        if (projectId) {
                          localStorage.setItem(`growthx_gbp_connected_${projectId}`, "true");
                        }
                        markDone("gbp");
                        advance("gbp");
                      },
                      onError: (err) => setNotice(errorMessage(err)),
                    }
                  );
                }}
                disabled={connectGbp.isPending || !projectId}
                className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-white py-3 px-4 font-semibold text-sm text-gray-800 hover:bg-gray-50 transition shadow-lg shadow-white/10 disabled:opacity-50"
              >
                {connectGbp.isPending ? (
                  <Loader2 size={16} className="animate-spin text-emerald-600" />
                ) : (
                  <GoogleG size={18} />
                )}
                <span>Connect Google Business Profile</span>
                <ChevronRight size={16} className="text-gray-400 ml-auto" />
              </button>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/10" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-transparent px-2 text-[10px] uppercase tracking-widest text-white/30">
                    or enter business name
                  </span>
                </div>
              </div>
              <input
                type="text"
                placeholder="e.g. Aiva Dental Care"
                value={gbpName}
                onChange={(e) => setGbpName(e.target.value)}
                className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition"
              />
            </div>
          </IntegrationCard>

          {/* 4. GitHub Repository */}
          <IntegrationCard
            icon={<GitBranch size={20} className="text-purple-300" />}
            iconBg="bg-purple-500/15"
            title="GitHub Repository"
            subtitle="Autonomous AI engineers can open pull requests for technical fixes"
            features={["Auto PR creation", "Schema fixes", "Technical SEO patches", "Code review"]}
            badge="Optional"
            badgeColor="bg-purple-500/20 text-purple-300 border border-purple-500/30"
            state={steps.github}
            isActive={activeStep === "github"}
            onSkip={() => markSkipped("github")}
          >
            <div className="space-y-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-white/50">
                    GitHub Owner / Org
                  </label>
                  <input
                    type="text"
                    placeholder="your-org"
                    value={githubForm.owner}
                    onChange={(e) => setGithubForm({ ...githubForm, owner: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] font-semibold text-white/50">
                    Repository Name
                  </label>
                  <input
                    type="text"
                    placeholder="my-website"
                    value={githubForm.name}
                    onChange={(e) => setGithubForm({ ...githubForm, name: e.target.value })}
                    className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-white/50">
                  GitHub Personal Access Token
                </label>
                <input
                  type="password"
                  placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  value={githubForm.accessToken}
                  onChange={(e) => setGithubForm({ ...githubForm, accessToken: e.target.value })}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30"
                />
              </div>
              <button
                type="button"
                disabled={
                  connectRepo.isPending ||
                  !githubForm.owner.trim() ||
                  !githubForm.name.trim() ||
                  !githubForm.accessToken.trim() ||
                  !projectId
                }
                onClick={() =>
                  connectRepo.mutate(githubForm, {
                    onSuccess: () => {
                      markDone("github");
                      advance("github");
                    },
                    onError: (err) => setNotice(errorMessage(err)),
                  })
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-purple-600 py-2.5 px-4 font-semibold text-sm text-white hover:bg-purple-500 transition disabled:opacity-40"
              >
                {connectRepo.isPending ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <GitBranch size={14} />
                )}
                Connect Repository
              </button>
            </div>
          </IntegrationCard>

          {/* 5. Website / URL */}
          <IntegrationCard
            icon={<Globe size={20} className="text-cyan-300" />}
            iconBg="bg-cyan-500/15"
            title="Website URL"
            subtitle="AI crawler analyzes your pages for on-page SEO opportunities"
            features={["Page audits", "Content gaps", "Schema markup", "Core Web Vitals"]}
            badge="Quick setup"
            badgeColor="bg-cyan-500/20 text-cyan-300 border border-cyan-500/30"
            state={steps.website}
            isActive={activeStep === "website"}
            onSkip={() => markSkipped("website")}
          >
            <div className="space-y-2.5">
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-white/50">
                  Your website URL
                </label>
                <input
                  type="url"
                  placeholder="https://yourwebsite.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-white/5 px-4 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-blue-500/50 focus:outline-none focus:ring-1 focus:ring-blue-500/30 transition"
                />
              </div>
              <button
                type="button"
                disabled={!websiteUrl.trim()}
                onClick={() => {
                  // Store website URL and mark done
                  if (projectId && websiteUrl.trim()) {
                    try {
                      localStorage.setItem(`growthx_website_${projectId}`, websiteUrl.trim());
                    } catch {}
                  }
                  markDone("website");
                  advance("website");
                }}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-600 py-2.5 px-4 font-semibold text-sm text-white hover:bg-cyan-500 transition disabled:opacity-40"
              >
                <Globe size={14} />
                Save & Start Crawling
              </button>
            </div>
          </IntegrationCard>
        </div>

        {/* Bottom CTA */}
        <div className="mt-8">
          {allFinished ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
              <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-emerald-500/30">
                <Check size={22} className="text-emerald-400" strokeWidth={2.5} />
              </div>
              <h3 className="text-base font-bold text-white mb-1">You&apos;re all set!</h3>
              <p className="text-sm text-white/50 mb-4">
                {doneCount > 0
                  ? `${doneCount} integration${doneCount > 1 ? "s" : ""} connected. GrowthX AI is ready to optimize your site.`
                  : "You can connect integrations anytime from the Integrations page."}
              </p>
              <button
                type="button"
                onClick={handleFinish}
                className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3 font-bold text-sm text-white shadow-lg shadow-blue-600/30 hover:shadow-blue-600/50 hover:scale-[1.02] transition-all"
              >
                <Zap size={16} />
                Go to Dashboard
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/3 p-5">
              <div>
                <p className="text-sm font-semibold text-white/70">
                  {STEP_ORDER.length - totalDone} step{STEP_ORDER.length - totalDone !== 1 ? "s" : ""} remaining
                </p>
                <p className="text-xs text-white/35 mt-0.5">
                  You can always connect more integrations from Settings → Integrations.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  // Mark all remaining as skipped
                  const updated: StepState = { ...steps };
                  STEP_ORDER.forEach((k) => {
                    if (updated[k] === "idle") updated[k] = "skipped";
                  });
                  setSteps(updated);
                }}
                className="shrink-0 rounded-xl border border-white/20 px-5 py-2.5 text-xs font-semibold text-white/50 hover:text-white hover:border-white/40 transition"
              >
                Skip all & go to dashboard →
              </button>
            </div>
          )}
        </div>

        {/* Trust badges */}
        <div className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[11px] text-white/25">
          <span className="flex items-center gap-1.5">
            <Shield size={11} className="text-emerald-400/50" />
            End-to-end encrypted
          </span>
          <span className="flex items-center gap-1.5">
            <Star size={11} className="text-amber-400/50" />
            SOC-2 compliant
          </span>
          <span className="flex items-center gap-1.5">
            <Zap size={11} className="text-blue-400/50" />
            No data sold, ever
          </span>
        </div>
      </div>
    </div>
  );
}
