"use client";

import React, { useState } from "react";
import {
  Check,
  ChevronRight,
  ShieldCheck,
  Search,
  BarChart3,
  Star,
  Image as ImageIcon,
  FileText,
  TrendingUp,
  Rocket,
  Lock,
  Users,
  Settings2,
  HelpCircle,
  ArrowRight,
  ChevronDown,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { GoogleGLogo, GbpStoreIcon } from "./gbp-icons";
import { ConnectGbpModal } from "./connect-gbp-modal";
import { useConnectLocalBusiness } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

interface ConnectGbpScreenProps {
  projectId: string | null;
  onConnected?: () => void;
}

export function ConnectGbpScreen({ projectId, onConnected }: ConnectGbpScreenProps) {
  const [profileId, setProfileId] = useState("");
  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [helpModalOpen, setHelpModalOpen] = useState(false);
  const [manualError, setManualError] = useState<string | null>(null);

  const connectMutation = useConnectLocalBusiness(projectId);

  const handleConnectWithGoogle = () => {
    setConnectModalOpen(true);
  };

  const handleManualConnect = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileId.trim()) {
      setConnectModalOpen(true);
      return;
    }

    setManualError(null);
    const businessName = profileId.trim().startsWith("http")
      ? "Google Business Profile"
      : profileId.trim();

    connectMutation.mutate(
      {
        businessName,
        address: "Google Maps Verified Listing",
        rating: 0,
        reviewCount: 0,
      },
      {
        onSuccess: () => {
          onConnected?.();
        },
        onError: (err) => {
          setManualError(errorMessage(err));
        },
      }
    );
  };

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* Top Header / Breadcrumbs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-700 dark:text-brand-300">
          <div className="flex h-5 w-5 items-center justify-center rounded-md bg-blue-600 text-white shadow-2xs">
            <GbpStoreIcon className="h-3.5 w-3.5 text-white" />
          </div>
          <ChevronDown size={14} className="text-brand-400" />
          <span className="font-bold text-brand-950 dark:text-white">Google Business Profile</span>
        </div>

        <button
          type="button"
          onClick={() => setHelpModalOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 transition shadow-2xs dark:border-brand-800 dark:bg-brand-900 dark:text-brand-300 dark:hover:bg-brand-850"
        >
          <HelpCircle size={13} className="text-blue-600 dark:text-blue-400" />
          <span>Need Help?</span>
        </button>
      </div>

      {/* Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center pt-1">
        {/* Left Headline */}
        <div className="lg:col-span-7 space-y-3">
          <h1 className="text-3xl sm:text-[34px] font-extrabold tracking-tight text-brand-950 dark:text-white leading-[1.15]">
            Connect your <br className="hidden sm:inline" />
            Google Business Profile
          </h1>
          <p className="text-sm text-brand-500 dark:text-brand-400 leading-relaxed max-w-lg">
            Link your Google Business Profile to GrowthX and let AI analyze, optimize,
            and grow your local visibility automatically.
          </p>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs font-medium text-brand-700 dark:text-brand-300">
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Secure & Safe</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Read & Manage (with your permission)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check size={10} strokeWidth={3} />
              </span>
              <span>Only takes 1 minute</span>
            </div>
          </div>
        </div>

        {/* Right Hero Graphic Card */}
        <div className="lg:col-span-5">
          <div className="relative rounded-2xl border border-blue-100 dark:border-blue-900/40 bg-gradient-to-br from-blue-50/40 via-white to-indigo-50/30 dark:from-slate-900 dark:via-brand-950 dark:to-blue-950/20 p-6 flex items-center justify-center min-h-[190px] shadow-2xs overflow-hidden">
            {/* Background ambient glow */}
            <div className="absolute -top-10 -right-10 w-36 h-36 bg-blue-400/10 rounded-full blur-2xl pointer-events-none" />

            {/* Floating Tags */}
            <div className="absolute top-3 left-1/3 -translate-x-1/2 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200/80 text-blue-600 dark:bg-blue-950/80 dark:border-blue-800 dark:text-blue-300 text-[11px] font-semibold shadow-2xs">
              <BarChart3 size={11} className="text-blue-600 dark:text-blue-400" />
              <span>Analyze</span>
            </div>

            <div className="absolute top-3 right-5 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200/80 text-emerald-600 dark:bg-emerald-950/80 dark:border-emerald-800 dark:text-emerald-300 text-[11px] font-semibold shadow-2xs">
              <Settings2 size={11} className="text-emerald-600 dark:text-emerald-400" />
              <span>Optimize</span>
            </div>

            <div className="absolute bottom-5 right-2 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-purple-50 border border-purple-200/80 text-purple-600 dark:bg-purple-950/80 dark:border-purple-800 dark:text-purple-300 text-[11px] font-semibold shadow-2xs">
              <TrendingUp size={11} className="text-purple-600 dark:text-purple-400" />
              <span>Grow</span>
            </div>

            {/* Cards Link Flow */}
            <div className="flex items-center gap-2 sm:gap-3 z-10">
              {/* Left Browser Mockup Card */}
              <div className="w-[110px] rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 p-2.5 shadow-sm flex flex-col items-center">
                <div className="flex items-center gap-1 w-full mb-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </div>
                <div className="py-1">
                  <GoogleGLogo size={24} />
                </div>
                <div className="mt-1.5 w-full flex justify-center">
                  <GbpStoreIcon className="w-9 h-9" />
                </div>
              </div>

              {/* Connecting Curved Arrow */}
              <div className="px-1 text-blue-600 dark:text-blue-400">
                <svg width="44" height="26" viewBox="0 0 44 26" fill="none" className="shrink-0">
                  <path
                    d="M2 20C12 4 30 4 40 12"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <path
                    d="M34 13L41 12L39 5"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>

              {/* Right GrowthX Card */}
              <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900 p-3 shadow-sm flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-950 text-white shadow-xs">
                  <div className="grid grid-cols-2 gap-0.5 p-1">
                    <div className="w-1.5 h-1.5 rounded-xs bg-blue-400" />
                    <div className="w-1.5 h-1.5 rounded-xs bg-white" />
                    <div className="w-1.5 h-1.5 rounded-xs bg-white" />
                    <div className="w-1.5 h-1.5 rounded-xs bg-blue-400" />
                  </div>
                </div>
                <div>
                  <div className="text-[13px] font-bold text-brand-950 dark:text-white leading-tight">
                    GrowthX
                  </div>
                  <div className="text-[9px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                    AI Local SEO
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Connection & Value Proposition Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pt-2">
        {/* Left Column: Choose how you want to connect */}
        <div className="lg:col-span-7 flex flex-col justify-between">
          <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900/90 p-7 shadow-xs">
            <h2 className="text-lg font-bold text-brand-950 dark:text-white">
              Choose how you want to connect
            </h2>
            <p className="text-xs text-brand-500 dark:text-brand-400 mt-1">
              Select the Google account that manages your business profile.
            </p>

            {/* Big Google Connect Button */}
            <button
              type="button"
              onClick={handleConnectWithGoogle}
              className="w-full mt-6 py-4 px-6 rounded-xl border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-850 hover:bg-brand-50/70 dark:hover:bg-brand-800 hover:border-brand-300 transition-all flex items-center justify-center gap-3 group shadow-2xs"
            >
              <GoogleGLogo size={20} />
              <span className="text-sm font-bold text-brand-900 dark:text-white">
                Connect with Google
              </span>
              <ChevronRight
                size={17}
                className="text-blue-600 dark:text-blue-400 ml-1 group-hover:translate-x-0.5 transition-transform"
              />
            </button>

            {/* OR Divider */}
            <div className="relative my-6 flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-brand-200 dark:border-brand-800" />
              </div>
              <span className="relative bg-white dark:bg-brand-900 px-3 text-[11px] font-semibold uppercase tracking-wider text-brand-400">
                OR
              </span>
            </div>

            {/* Manual Business Profile ID Form */}
            <form onSubmit={handleManualConnect} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-brand-900 dark:text-brand-200 mb-2">
                  Enter your Business Profile ID
                </label>
                <input
                  type="text"
                  value={profileId}
                  onChange={(e) => setProfileId(e.target.value)}
                  placeholder="Paste your Google Business Profile ID (e.g. 1234567890123456789)"
                  className="w-full px-4 py-3 text-xs sm:text-sm rounded-xl border border-brand-200 dark:border-brand-700 bg-white dark:bg-brand-900 text-brand-950 dark:text-white placeholder:text-brand-400 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition shadow-2xs"
                />
              </div>

              {manualError && (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">
                  {manualError}
                </p>
              )}

              <button
                type="submit"
                disabled={connectMutation.isPending}
                className="w-full py-3 px-4 rounded-xl bg-blue-50 hover:bg-blue-100/90 dark:bg-blue-950/50 dark:hover:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold text-xs tracking-wide transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {connectMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <>
                    <span>Connect Manually</span>
                    <ArrowRight size={13} />
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Privacy / Encryption Footer Note */}
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-brand-500 dark:text-brand-400">
            <ShieldCheck size={14} className="text-brand-400 dark:text-brand-500 shrink-0" />
            <span>Your data is encrypted and secure. We only access the information you allow.</span>
          </div>
        </div>

        {/* Right Column: What you'll get after connecting */}
        <div className="lg:col-span-5">
          <div className="rounded-2xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900/90 p-6 shadow-xs h-full">
            <h3 className="text-sm font-bold text-brand-950 dark:text-white mb-4">
              What you&apos;ll get after connecting
            </h3>

            <div className="space-y-3.5">
              {/* 1. Complete Profile Audit */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400">
                  <Search size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Complete Profile Audit
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Find what&apos;s missing and what to improve.
                  </p>
                </div>
              </div>

              {/* 2. Local Rankings */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400">
                  <BarChart3 size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Local Rankings
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Track your visibility in local search.
                  </p>
                </div>
              </div>

              {/* 3. Reviews & Sentiment */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-500 dark:bg-amber-950/50 dark:text-amber-400">
                  <Star size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Reviews & Sentiment
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Analyze reviews and get AI-generated responses.
                  </p>
                </div>
              </div>

              {/* 4. Photos & Media */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400">
                  <ImageIcon size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Photos & Media
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Check your photo coverage and get suggestions.
                  </p>
                </div>
              </div>

              {/* 5. Services & Categories */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400">
                  <FileText size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Services & Categories
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Optimize your services and categories.
                  </p>
                </div>
              </div>

              {/* 6. AI Recommendations */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                  <TrendingUp size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    AI Recommendations
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Get a personalized action plan.
                  </p>
                </div>
              </div>

              {/* 7. Automation */}
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-400">
                  <Rocket size={15} />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-brand-900 dark:text-white">
                    Automation
                  </h4>
                  <p className="text-[11px] text-brand-500 dark:text-brand-400">
                    Apply approved changes automatically.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom 3 Trust Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
        {/* Card 1: Safe & Secure */}
        <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900/90 p-5 shadow-2xs flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Lock size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-950 dark:text-white">
              Safe & Secure
            </h4>
            <p className="text-[11px] text-brand-500 dark:text-brand-400 mt-1 leading-relaxed">
              We use Google&apos;s official and secure OAuth authentication.
            </p>
          </div>
        </div>

        {/* Card 2: Your Control */}
        <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900/90 p-5 shadow-2xs flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-950 dark:text-white">
              Your Control
            </h4>
            <p className="text-[11px] text-brand-500 dark:text-brand-400 mt-1 leading-relaxed">
              You choose what we can access. You can disconnect anytime.
            </p>
          </div>
        </div>

        {/* Card 3: Trusted by Businesses */}
        <div className="rounded-xl border border-brand-200 dark:border-brand-800 bg-white dark:bg-brand-900/90 p-5 shadow-2xs flex items-start gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Users size={18} />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-950 dark:text-white">
              Trusted by Businesses
            </h4>
            <p className="text-[11px] text-brand-500 dark:text-brand-400 mt-1 leading-relaxed">
              Thousands of businesses use GrowthX to improve their local visibility.
            </p>
          </div>
        </div>
      </div>

      {/* Connect Modal for Google Places Search & Manual Entry */}
      <ConnectGbpModal
        open={connectModalOpen}
        onOpenChange={setConnectModalOpen}
        projectId={projectId}
        onConnected={onConnected}
      />

      {/* Need Help Modal */}
      {helpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            onClick={() => setHelpModalOpen(false)}
          />
          <div className="relative z-10 w-full max-w-lg rounded-2xl border border-brand-200 bg-white dark:border-brand-800 dark:bg-brand-900 p-6 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-brand-100 dark:border-brand-800 pb-4">
              <div className="flex items-center gap-2">
                <HelpCircle size={18} className="text-blue-600" />
                <h3 className="text-sm font-bold text-brand-950 dark:text-white">
                  Google Business Profile Connection Help
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="text-brand-400 hover:text-brand-700 transition"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-4 py-4 text-xs text-brand-600 dark:text-brand-300 leading-relaxed">
              <div>
                <h4 className="font-bold text-brand-900 dark:text-white mb-1">
                  How to find your Business Profile ID:
                </h4>
                <ol className="list-decimal pl-4 space-y-1 text-brand-500 dark:text-brand-400">
                  <li>Go to Google Search and search for your business name.</li>
                  <li>Click on the three dots menu ⋮ next to your Business Profile.</li>
                  <li>Select <strong>Business Profile settings</strong> &gt; <strong>Advanced settings</strong>.</li>
                  <li>Copy the numeric <strong>Business Profile ID</strong> shown at the top.</li>
                </ol>
              </div>

              <div>
                <h4 className="font-bold text-brand-900 dark:text-white mb-1">
                  Direct Search Option:
                </h4>
                <p className="text-brand-500 dark:text-brand-400">
                  Click <strong>Connect with Google</strong> to search directly by your business name and city to link your verified listing without looking up IDs.
                </p>
              </div>

              <div className="rounded-lg bg-blue-50 dark:bg-blue-950/40 p-3 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                <span className="font-bold">Security Note:</span> GrowthX will never post or publish changes without your explicit review and approval.
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setHelpModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-brand-950 text-white hover:opacity-90 transition"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
