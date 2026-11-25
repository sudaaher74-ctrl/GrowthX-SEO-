"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  BarChart3,
  Zap,
  Users,
  Mail,
  Lock,
  User,
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
  AlertCircle,
} from "lucide-react";
import { api, auth, getApiBase } from "@/lib/api-client";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ui/console";

const GOOGLE_RECOVERY_KEY = "reigel.google-recovery";
// Cap the browser copy at the API's ten-minute challenge lifetime.
const GOOGLE_RECOVERY_TTL_MS = 10 * 60 * 1000;

function readGoogleRecovery() {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(GOOGLE_RECOVERY_KEY);
    if (!saved) return null;
    const { token, email, expiresAt } = JSON.parse(saved);
    if (typeof token === "string" && token && typeof email === "string" && typeof expiresAt === "number" && expiresAt > Date.now()) {
      return { token, email };
    }
  } catch {
    // Recovery can still proceed from its original link when storage is blocked.
  }
  return null;
}

function GoogleRecoveryForm({
  token,
  email,
  onSignedIn,
}: {
  token: string;
  email: string;
  onSignedIn: () => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmRecovery, setConfirmRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inProgress = useRef(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const incomingToken = url.searchParams.get("token");
    if (!incomingToken) return;
    try {
      sessionStorage.setItem(GOOGLE_RECOVERY_KEY, JSON.stringify({
        token: incomingToken,
        email: url.searchParams.get("email") ?? "",
        expiresAt: Date.now() + GOOGLE_RECOVERY_TTL_MS,
      }));
    } catch {
      // Keep the original link usable across reloads when storage is blocked.
      return;
    }
    url.searchParams.delete("token");
    url.searchParams.delete("email");
    window.history.replaceState(null, "", url);
  }, []);

  async function completeRecovery(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token || inProgress.current) return;
    inProgress.current = true;
    setBusy(true);
    setError(null);

    try {
      await api.completeGoogleRecovery(token, confirmRecovery ? undefined : password);
      try {
        sessionStorage.removeItem(GOOGLE_RECOVERY_KEY);
      } catch {
        // The API has already consumed the one-time challenge.
      }
      await onSignedIn();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete Google sign-in. Please try again.");
      inProgress.current = false;
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto my-auto w-full max-w-md py-6 sm:py-8">
      <h2 id="google-recovery-heading" className="mb-2 text-3xl font-black tracking-tight text-brand-950">
        Finish Google sign-in
      </h2>
      {token ? (
        <form className="mt-4 space-y-4" aria-labelledby="google-recovery-heading" onSubmit={completeRecovery}>
          <p className="text-sm text-brand-600">
            {email ? <>There’s already a Reigel account for <strong className="break-all">{email}</strong>.</> : "There’s already a Reigel account for this email address."}
          </p>
          {confirmRecovery ? (
            <p className="text-sm text-brand-700">
              Recovering with Google disables your old Reigel password, signs you out on other devices, and may remove your access to shared workspaces.
            </p>
          ) : (
            <div>
              <label htmlFor="reigel-recovery-password" className="mb-1.5 block text-xs font-bold text-brand-700">
                Current Reigel password
              </label>
              <input
                id="reigel-recovery-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={128}
                disabled={busy}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="min-h-[48px] w-full rounded-xl border border-brand-200 bg-surface-1 px-4 py-3 text-base text-brand-950 focus-visible:outline-2 focus-visible:outline-signal-400 sm:text-sm"
              />
            </div>
          )}
          {error && <p role="alert" className="text-sm text-error-600">{error}</p>}
          <ActionButton type="submit" variant="primary" disabled={busy} className="min-h-[44px] w-full justify-center">
            {busy ? "Signing in…" : confirmRecovery ? "Confirm Google recovery" : "Link Google and sign in"}
          </ActionButton>
          <ActionButton
            type="button"
            disabled={busy}
            onClick={() => {
              setConfirmRecovery(!confirmRecovery);
              setPassword("");
              setError(null);
            }}
            className="min-h-[44px] w-full justify-center"
          >
            {confirmRecovery ? "Use my Reigel password" : "Recover with Google instead"}
          </ActionButton>
        </form>
      ) : (
        <p role="alert" className="text-sm text-error-600">
          This recovery link is incomplete or expired. Start again with Google to get a new link.
        </p>
      )}
      <a
        href={`${getApiBase()}/auth/google`}
        className="mt-5 inline-block text-sm font-semibold text-brand-900 underline underline-offset-2"
      >
        Start again with Google
      </a>
    </div>
  );
}

type AuthMode = "login" | "signup";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function splitFullName(raw: string): { firstName?: string; lastName?: string } {
  const cleaned = raw.trim().replace(/\s+/g, " ");
  if (!cleaned) return {};
  const spaceIdx = cleaned.indexOf(" ");
  if (spaceIdx === -1) return { firstName: cleaned.slice(0, 80) };
  return {
    firstName: cleaned.slice(0, spaceIdx).slice(0, 80),
    lastName: cleaned.slice(spaceIdx + 1).slice(0, 80) || undefined,
  };
}

function LoginFormInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [googleRecovery] = useState(() => {
    if (searchParams.get("recovery") !== "google") return null;
    const token = searchParams.get("token");
    if (token) return { token, email: searchParams.get("email") ?? "" };
    return readGoogleRecovery() ?? { token: "", email: "" };
  });
  const urlParam = (searchParams.get("url") || "").trim();
  const planParam = searchParams.get("plan");
  const cycleParam = searchParams.get("cycle");
  const modeParam = (searchParams.get("mode") || "").toLowerCase();

  const initialMode: AuthMode =
    modeParam === "login"
      ? "login"
      : modeParam === "signup" || Boolean(urlParam) || Boolean(planParam)
        ? "signup"
        : "login";

  const [modeOverride, setModeOverride] = useState<{ key: string; mode: AuthMode } | null>(null);
  const modeKey = `${modeParam}|${urlParam}|${planParam ?? ""}`;
  const mode: AuthMode = modeOverride?.key === modeKey ? modeOverride.mode : initialMode;
  const [form, setForm] = useState({ fullName: "", email: "", password: "" });
  const [touched, setTouched] = useState<{ email: boolean; password: boolean }>({
    email: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(searchParams.get("error") || null);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

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

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    if (error) setError(null);
  };

  const switchMode = (next: AuthMode) => {
    if (next === mode) return;
    setModeOverride({ key: modeKey, mode: next });
    setError(null);
    setSubmitted(false);
    setTouched({ email: false, password: false });
    setShowPassword(false);
  };

  const isSignup = mode === "signup";
  const trimmedEmail = form.email.trim();

  const getEmailValidationError = (): string | null => {
    if (!trimmedEmail) return "Please enter your email address.";
    if (!EMAIL_RE.test(trimmedEmail)) return "Enter an email address in the format you@company.com.";
    return null;
  };

  const getPasswordValidationError = (): string | null => {
    if (!form.password) {
      return isSignup
        ? "Create a password with at least 8 characters."
        : "Please enter your password.";
    }
    if (isSignup && form.password.length < 8) {
      return "Use a password of at least 8 characters.";
    }
    if (form.password.length > 128) {
      return "Use a password of at most 128 characters.";
    }
    return null;
  };

  const showEmailError = (submitted || touched.email) ? getEmailValidationError() : null;
  const showPasswordError = (submitted || touched.password) ? getPasswordValidationError() : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setError(null);

    const emailErr = getEmailValidationError();
    const passwordErr = getPasswordValidationError();

    if (emailErr) {
      emailRef.current?.focus();
      return;
    }
    if (passwordErr) {
      passwordRef.current?.focus();
      return;
    }

    setBusy(true);
    try {
      if (isSignup) {
        const { firstName, lastName } = splitFullName(form.fullName);
        await api.register({
          email: trimmedEmail,
          password: form.password,
          ...(firstName ? { firstName } : {}),
          ...(lastName ? { lastName } : {}),
        });
      } else {
        await api.login(trimmedEmail, form.password);
      }

      await openWorkspace(isSignup);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isSignup
            ? "Could not create your account. Please try again."
            : "Could not sign in. Please check your credentials and try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function openWorkspace(newAccount: boolean) {
    const navigate = googleRecovery ? router.replace : router.push;
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
      navigate(`/analyze?url=${encodeURIComponent(pendingDomain)}`);
      return;
    }

    const existingProjects = !newAccount && firstOrgId ? await api.listProjects(firstOrgId).catch(() => []) : [];
    navigate(existingProjects?.length ? "/dashboard" : "/analyze");
  }

  if (googleRecovery) {
    return (
      <GoogleRecoveryForm
        {...googleRecovery}
        onSignedIn={() => openWorkspace(false).catch(() => router.replace("/analyze"))}
      />
    );
  }

  const emailDescribedBy = [
    isSignup ? "auth-email-hint" : null,
    showEmailError ? "auth-email-error" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  const passwordDescribedBy = [
    isSignup ? "auth-password-rules" : null,
    showPasswordError ? "auth-password-error" : null,
  ]
    .filter(Boolean)
    .join(" ") || undefined;

  return (
    <div className="w-full max-w-md mx-auto my-auto py-6 sm:py-8">
      {/* Pending Website Audit Pill */}
      {urlParam && (
        <div className="mb-4 inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2 text-xs font-semibold text-brand-950 shadow-2xs">
          <Globe size={14} className="text-brand-700 shrink-0" />
          <span>
            Auditing <strong className="font-mono text-brand-950">{urlParam}</strong> right after{" "}
            {isSignup ? "sign-up" : "sign-in"}
          </span>
        </div>
      )}

      {/* Mode Switcher: Create free account | Log in */}
      <div
        role="tablist"
        aria-label="Account mode"
        className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-brand-200 bg-surface-1 p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={isSignup}
          onClick={() => switchMode("signup")}
          className={cn(
            "min-h-[40px] rounded-full px-3 py-2 text-xs font-extrabold transition-all cursor-pointer",
            isSignup
              ? "bg-signal-400 text-signal-ink shadow-xs"
              : "text-brand-600 hover:text-brand-950",
          )}
        >
          Create free account
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={!isSignup}
          onClick={() => switchMode("login")}
          className={cn(
            "min-h-[40px] rounded-full px-3 py-2 text-xs font-extrabold transition-all cursor-pointer",
            !isSignup
              ? "bg-signal-400 text-signal-ink shadow-xs"
              : "text-brand-600 hover:text-brand-950",
          )}
        >
          Log in
        </button>
      </div>

      {/* Heading */}
      <h2 id="auth-form-heading" className="text-3xl font-black text-brand-950 tracking-tight mb-1">
        {isSignup ? "Create your free account" : "Welcome back"}
      </h2>
      <p className="text-sm text-brand-500 mb-6">
        {isSignup
          ? urlParam
            ? `Set up your free workspace to crawl ${urlParam} in under 60 seconds.`
            : "Start your first technical SEO & AI visibility audit — no credit card required."
          : urlParam
            ? `Sign in to start crawling ${urlParam}.`
            : "Log in to your Reigel account."}
      </p>

      {/* Form */}
      <form
        key={mode}
        method="post"
        onSubmit={handleSubmit}
        aria-labelledby="auth-form-heading"
        className="space-y-4"
        noValidate
      >
        {/* Full Name (Sign-up only — single field for global names & autofill) */}
        {isSignup && (
          <div>
            <label
              htmlFor="auth-full-name"
              className="block text-xs font-bold text-brand-700 mb-1.5"
            >
              Your name <span className="font-normal text-brand-400">(optional)</span>
            </label>
            <div className="relative">
              <User
                size={16}
                aria-hidden="true"
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
              />
              <input
                id="auth-full-name"
                name="full-name"
                type="text"
                autoComplete="name"
                enterKeyHint="next"
                maxLength={160}
                value={form.fullName}
                onChange={set("fullName")}
                placeholder="Alex Rivera"
                className="w-full min-h-[48px] pl-10 pr-4 py-3 text-base sm:text-sm rounded-xl border border-brand-200 bg-surface-1 placeholder:text-brand-400 text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-400 focus:border-brand-400 transition-all"
              />
            </div>
          </div>
        )}

        {/* Email */}
        <div>
          <label
            htmlFor="auth-email"
            className="block text-xs font-bold text-brand-700 mb-1"
          >
            Work email <span aria-hidden="true" className="text-error-500">*</span>
          </label>
          {isSignup && (
            <p id="auth-email-hint" className="text-[11px] text-brand-500 mb-1.5">
              Format: you@company.com
            </p>
          )}
          <div className="relative">
            <Mail
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
            />
            <input
              ref={emailRef}
              id="auth-email"
              name="email"
              type="email"
              required
              autoComplete="username"
              spellCheck={false}
              autoCapitalize="none"
              autoCorrect="off"
              enterKeyHint="next"
              aria-invalid={showEmailError ? "true" : "false"}
              aria-describedby={emailDescribedBy}
              value={form.email}
              onChange={set("email")}
              onBlur={() => {
                if (form.email.trim().length > 0) {
                  setTouched((t) => ({ ...t, email: true }));
                }
              }}
              placeholder="you@company.com"
              className={cn(
                "w-full min-h-[48px] pl-10 pr-4 py-3 text-base sm:text-sm rounded-xl border bg-surface-1 placeholder:text-brand-400 text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-400 transition-all",
                showEmailError
                  ? "border-error-500 bg-error-50/40"
                  : "border-brand-200 focus:border-brand-400",
              )}
            />
          </div>
          {showEmailError && (
            <p
              id="auth-email-error"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-error-600"
            >
              <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
              <span>{showEmailError}</span>
            </p>
          )}
        </div>

        {/* Password */}
        <div>
          <label
            htmlFor={isSignup ? "new-password" : "current-password"}
            className="block text-xs font-bold text-brand-700 mb-1"
          >
            {isSignup ? "Create password" : "Password"}{" "}
            <span aria-hidden="true" className="text-error-500">*</span>
          </label>
          {isSignup && (
            <p
              id="auth-password-rules"
              className={cn(
                "text-[11px] mb-1.5",
                showPasswordError ? "text-error-600 font-semibold" : "text-brand-500",
              )}
            >
              At least 8 characters. You can paste from a password manager.
            </p>
          )}
          <div className="relative">
            <Lock
              size={16}
              aria-hidden="true"
              className="absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-400 pointer-events-none"
            />
            <input
              ref={passwordRef}
              id={isSignup ? "new-password" : "current-password"}
              name={isSignup ? "new-password" : "current-password"}
              type={showPassword ? "text" : "password"}
              required
              minLength={isSignup ? 8 : 1}
              maxLength={128}
              autoComplete={isSignup ? "new-password" : "current-password"}
              enterKeyHint="done"
              aria-invalid={showPasswordError ? "true" : "false"}
              aria-describedby={passwordDescribedBy}
              value={form.password}
              onChange={set("password")}
              onBlur={() => {
                if (form.password.length > 0) {
                  setTouched((t) => ({ ...t, password: true }));
                }
              }}
              placeholder={isSignup ? "Minimum 8 characters" : "Enter your password"}
              className={cn(
                "w-full min-h-[48px] pl-10 pr-12 py-3 text-base sm:text-sm rounded-xl border bg-surface-1 placeholder:text-brand-400 text-brand-950 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-signal-400 transition-all",
                showPasswordError
                  ? "border-error-500 bg-error-50/40"
                  : "border-brand-200 focus:border-brand-400",
              )}
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-pressed={showPassword}
              aria-label={showPassword ? "Hide password" : "Show password"}
              title={showPassword ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-lg text-brand-500 hover:text-brand-950 hover:bg-surface-2 transition-colors cursor-pointer"
            >
              {showPassword ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
            </button>
          </div>
          {showPasswordError && (
            <p
              id="auth-password-error"
              className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-error-600"
            >
              <AlertCircle size={13} aria-hidden="true" className="shrink-0" />
              <span>{showPasswordError}</span>
            </p>
          )}
        </div>

        {/* Server Error Notification */}
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-xl border border-error-500/40 bg-error-50 px-3.5 py-2.5 text-xs text-error-600 font-medium"
          >
            <AlertCircle size={14} aria-hidden="true" className="shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={busy}
          className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 py-3 px-4 rounded-full text-sm font-extrabold text-signal-ink bg-signal-400 hover:bg-signal-500 active:scale-[0.99] shadow-xs transition-all cursor-pointer disabled:opacity-60"
        >
          {busy ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>{isSignup ? "Creating workspace…" : "Signing in…"}</span>
            </>
          ) : (
            <>
              <span>{isSignup ? "Create free account" : "Sign in"}</span>
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
      <div className="space-y-2">
        <a
          href={`${getApiBase()}/auth/google`}
          className="w-full min-h-[48px] flex items-center justify-center gap-3 py-2.5 px-4 rounded-full border border-brand-200 bg-surface-1 hover:bg-surface-2 text-xs sm:text-sm font-semibold text-brand-900 shadow-2xs transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
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
        {isSignup && (
          <p className="text-center text-[11px] text-brand-500">
            Google sign-in creates your free workspace automatically.
          </p>
        )}
      </div>

      {/* Inline mode switch prompt */}
      <p className="mt-5 text-center text-xs text-brand-500">
        {isSignup ? (
          <>
            Already have an account?{" "}
            <button
              type="button"
              onClick={() => switchMode("login")}
              className="font-bold text-brand-950 underline underline-offset-2 hover:text-signal-500 cursor-pointer"
            >
              Sign in
            </button>
          </>
        ) : (
          <>
            New to Reigel?{" "}
            <button
              type="button"
              onClick={() => switchMode("signup")}
              className="font-bold text-brand-950 underline underline-offset-2 hover:text-signal-500 cursor-pointer"
            >
              Create a free account
            </button>
          </>
        )}
      </p>

      {/* Security Note */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-brand-500">
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
    const hasIntentQuery = typeof window !== "undefined" && window.location.search.length > 1;
    if (!hasIntentQuery && /(^|\.)(google\.|bing\.|duckduckgo\.|yahoo\.|ecosia\.|search\.brave\.)/i.test(referrer)) {
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
              Audit, fix, and <br />
              keep{" "}
              <span className="text-signal-400">
                growing.
              </span>
            </h1>
            <p className="text-sm text-brand-500 mt-2.5 max-w-md leading-relaxed">
              Create a free workspace or sign in to audit your site, track AI citations, and export developer-ready reports.
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
