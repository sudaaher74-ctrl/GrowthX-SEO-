"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  CheckCircle2,
  Lock,
  Globe,
  GitBranch,
  Search,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Copy,
  Check,
  KeyRound,
  LogOut,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { GitHubLogo } from "@/components/settings/integration-logos";
import { useConnectRepository } from "@/hooks/use-growthx";
import { errorMessage } from "@/lib/error-message";

export interface GitHubAgentConnectWorkflowProps {
  projectId: string | null;
  userEmail?: string | null;
  existingRepo?: {
    owner?: string;
    name?: string;
    defaultBranch?: string;
    framework?: string;
  } | null;
  mode?: "modal" | "inline";
  oauthCode?: string | null;
  oauthState?: string | null;
  installationId?: string | null;
  onConnected?: (repo: { owner: string; name: string; defaultBranch: string }) => void;
  onCancel?: () => void;
}

interface GitHubAuthenticatedUser {
  login: string;
  name: string | null;
  avatarUrl: string | null;
  email: string | null;
  htmlUrl: string;
}

interface GitHubLiveRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  description: string | null;
  language: string | null;
  updated_at: string;
  permissions?: {
    admin?: boolean;
    push?: boolean;
    pull?: boolean;
  };
  owner: {
    login: string;
    avatar_url?: string;
  };
}

interface StoredGitHubAppConfig {
  slug: string;
  name: string;
  clientId: string;
  clientSecret: string;
  htmlUrl: string;
}

const SESSION_STORAGE_KEY = "reigel_github_oauth_session_v1";
const APP_CONFIG_STORAGE_KEY = "reigel_github_app_config_v1";

function inferFramework(repo: GitHubLiveRepo): string {
  const hay = `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase();
  if (hay.includes("astro")) return "Astro";
  if (hay.includes("remix")) return "Remix";
  if (hay.includes("wordpress") || hay.includes("php")) return "WordPress";
  return "nextjs";
}

export function GitHubAgentConnectWorkflow({
  projectId,
  userEmail,
  existingRepo,
  mode = "modal",
  oauthCode,
  oauthState,
  onConnected,
  onCancel,
}: GitHubAgentConnectWorkflowProps) {
  const connectRepo = useConnectRepository(projectId);

  // Server/local GitHub OAuth configuration
  const [serverAppSlug, setServerAppSlug] = useState<string | null>(null);
  const [customAppConfig, setCustomAppConfig] = useState<StoredGitHubAppConfig | null>(null);

  // Authenticated GitHub user + real OAuth token (`gho_...` / `ghu_...` / `ghp_...`)
  const [accessToken, setAccessToken] = useState<string>("");
  const [ghUser, setGhUser] = useState<GitHubAuthenticatedUser | null>(null);

  // GitHub OAuth Device Flow state (`https://github.com/login/device`)
  const [deviceCode, setDeviceCode] = useState<string | null>(null);
  const [userCode, setUserCode] = useState<string | null>(null);
  const [verificationUri, setVerificationUri] = useState<string>("https://github.com/login/device");
  const [pollIntervalSec, setPollIntervalSec] = useState<number>(5);
  const [isStartingDevice, setIsStartingDevice] = useState<boolean>(false);
  const [isWaitingForGitHub, setIsWaitingForGitHub] = useState<boolean>(false);
  const [copiedCode, setCopiedCode] = useState<boolean>(false);

  // Personal Access Token alternative
  const [showPatInput, setShowPatInput] = useState<boolean>(false);
  const [patValue, setPatValue] = useState<string>("");
  const [isVerifyingPat, setIsVerifyingPat] = useState<boolean>(false);

  // Live repositories from `https://api.github.com/user/repos`
  const [repos, setRepos] = useState<GitHubLiveRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);
  const [repoSearch, setRepoSearch] = useState<string>("");
  const [visibilityFilter, setVisibilityFilter] = useState<"all" | "public" | "private">("all");
  const [selectedFullName, setSelectedFullName] = useState<string>(
    existingRepo?.owner && existingRepo?.name ? `${existingRepo.owner}/${existingRepo.name}` : "",
  );
  const [branchInput, setBranchInput] = useState<string>(existingRepo?.defaultBranch || "main");
  const [frameworkInput, setFrameworkInput] = useState<string>(existingRepo?.framework || "nextjs");

  const [errorText, setErrorText] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);

  const popupRef = useRef<Window | null>(null);
  const manifestFormRef = useRef<HTMLFormElement | null>(null);
  const [manifestJson, setManifestJson] = useState<string>("");

  // Load saved GitHub App config or active OAuth session from storage
  useEffect(() => {
    try {
      const savedApp = window.localStorage.getItem(APP_CONFIG_STORAGE_KEY);
      if (savedApp) {
        const parsed = JSON.parse(savedApp) as StoredGitHubAppConfig;
        if (parsed?.slug && parsed?.clientId && parsed?.clientSecret) {
          setCustomAppConfig(parsed);
        }
      }
      const savedSession = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (savedSession) {
        const parsed = JSON.parse(savedSession) as {
          accessToken?: string;
          user?: GitHubAuthenticatedUser;
        };
        if (parsed?.accessToken && parsed?.user?.login) {
          setAccessToken(parsed.accessToken);
          setGhUser(parsed.user);
        }
      }
    } catch {
      // ignore storage errors
    }

    fetch("/api/github/oauth")
      .then((r) => r.json())
      .then((cfg: { appSlug?: string | null }) => {
        if (cfg?.appSlug) setServerAppSlug(cfg.appSlug);
      })
      .catch(() => {
        // ignore
      });
  }, []);

  // Fetch real repositories from `https://api.github.com/user/repos` whenever `accessToken` is set
  const fetchLiveRepositories = useCallback(
    async (token: string) => {
      if (!token) return;
      setLoadingRepos(true);
      setErrorText(null);
      try {
        const res = await fetch(
          "https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member",
          {
            headers: {
              Authorization: `Bearer ${token}`,
              Accept: "application/vnd.github+json",
            },
            cache: "no-store",
          },
        );
        if (!res.ok) {
          if (res.status === 401) {
            window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
            setAccessToken("");
            setGhUser(null);
            throw new Error("GitHub session expired. Please sign in with GitHub again.");
          }
          throw new Error(`GitHub API returned HTTP ${res.status} while loading repositories.`);
        }
        const list = (await res.json()) as GitHubLiveRepo[];
        const valid = Array.isArray(list) ? list : [];
        setRepos(valid);

        if (valid.length > 0) {
          const existingMatch =
            existingRepo?.owner && existingRepo?.name
              ? valid.find(
                  (r) =>
                    r.full_name.toLowerCase() ===
                    `${existingRepo.owner}/${existingRepo.name}`.toLowerCase(),
                )
              : null;
          const pick = existingMatch || valid[0];
          setSelectedFullName(pick.full_name);
          setBranchInput(pick.default_branch || "main");
          setFrameworkInput(inferFramework(pick));
        }
      } catch (err) {
        setErrorText(errorMessage(err));
      } finally {
        setLoadingRepos(false);
      }
    },
    [existingRepo],
  );

  useEffect(() => {
    if (accessToken) {
      fetchLiveRepositories(accessToken);
    }
  }, [accessToken, fetchLiveRepositories]);

  // Start a real GitHub OAuth Device session (`https://github.com/login/device/code`)
  const startDeviceSession = useCallback(async () => {
    setIsStartingDevice(true);
    setErrorText(null);
    try {
      const res = await fetch("/api/github/oauth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "device_start",
          clientId: customAppConfig?.clientId,
        }),
      });
      const data = (await res.json()) as {
        deviceCode?: string;
        userCode?: string;
        verificationUri?: string;
        interval?: number;
        error?: string;
      };
      if (!res.ok || !data.deviceCode || !data.userCode) {
        throw new Error(data.error || "Unable to start GitHub OAuth session.");
      }
      setDeviceCode(data.deviceCode);
      setUserCode(data.userCode);
      setVerificationUri(data.verificationUri || "https://github.com/login/device");
      setPollIntervalSec(data.interval || 5);
    } catch (err) {
      setErrorText(errorMessage(err));
    } finally {
      setIsStartingDevice(false);
    }
  }, [customAppConfig]);

  useEffect(() => {
    if (!accessToken && !oauthCode && !deviceCode && !isStartingDevice) {
      startDeviceSession();
    }
  }, [accessToken, oauthCode, deviceCode, isStartingDevice, startDeviceSession]);

  // Handle callback code from `https://github.com` (`/api/github/callback`)
  useEffect(() => {
    if (!oauthCode) return;
    let cancelled = false;

    async function handleOAuthReturn() {
      setErrorText(null);
      try {
        // Case A: Returning from 1-click GitHub App Manifest registration on github.com
        if (oauthState?.startsWith("manifest_")) {
          setStatusBanner("Finalizing your GitHub App registration with github.com…");
          const res = await fetch("/api/github/oauth", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "manifest_convert", code: oauthCode }),
          });
          const data = (await res.json()) as StoredGitHubAppConfig & { error?: string };
          if (!res.ok || !data.slug) {
            throw new Error(data.error || "Failed to register GitHub App.");
          }
          if (cancelled) return;
          window.localStorage.setItem(APP_CONFIG_STORAGE_KEY, JSON.stringify(data));
          setCustomAppConfig(data);
          // Immediately redirect to `https://github.com/apps/<slug>/installations/new`
          window.location.href = `https://github.com/apps/${encodeURIComponent(data.slug)}/installations/new?state=${encodeURIComponent(projectId || "connect")}`;
          return;
        }

        // Case B: Returning from GitHub App installation / Web OAuth callback with `?code=...`
        setStatusBanner("Completing GitHub OAuth handshake with github.com…");
        let savedClientId: string | undefined;
        let savedClientSecret: string | undefined;
        try {
          const raw = window.localStorage.getItem(APP_CONFIG_STORAGE_KEY);
          if (raw) {
            const parsed = JSON.parse(raw) as StoredGitHubAppConfig;
            savedClientId = parsed.clientId;
            savedClientSecret = parsed.clientSecret;
          }
        } catch {
          // ignore
        }

        const res = await fetch("/api/github/oauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "exchange_code",
            code: oauthCode,
            clientId: savedClientId,
            clientSecret: savedClientSecret,
          }),
        });
        const data = (await res.json()) as {
          status?: string;
          accessToken?: string;
          user?: GitHubAuthenticatedUser;
          error?: string;
        };
        if (!res.ok || !data.accessToken || !data.user) {
          throw new Error(data.error || "Could not exchange GitHub authorization code.");
        }
        if (cancelled) return;
        setAccessToken(data.accessToken);
        setGhUser(data.user);
        setStatusBanner(null);
        try {
          window.sessionStorage.setItem(
            SESSION_STORAGE_KEY,
            JSON.stringify({ accessToken: data.accessToken, user: data.user }),
          );
          const cleanUrl = new URL(window.location.href);
          cleanUrl.searchParams.delete("github_code");
          cleanUrl.searchParams.delete("installation_id");
          cleanUrl.searchParams.delete("setup_action");
          cleanUrl.searchParams.delete("github_state");
          window.history.replaceState(null, "", cleanUrl.toString());
        } catch {
          // ignore
        }
      } catch (err) {
        if (!cancelled) {
          setStatusBanner(null);
          setErrorText(errorMessage(err));
        }
      }
    }

    handleOAuthReturn();
    return () => {
      cancelled = true;
    };
  }, [oauthCode, oauthState, projectId]);

  // Poll `/api/github/oauth` (`action: "device_poll"`) while the user authorizes on `https://github.com/login/device`
  useEffect(() => {
    if (!deviceCode || accessToken) return;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const pollOnce = async () => {
      try {
        const res = await fetch("/api/github/oauth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "device_poll",
            deviceCode,
            clientId: customAppConfig?.clientId,
          }),
        });
        const data = (await res.json()) as {
          status?: "authorized" | "pending" | "failed";
          accessToken?: string;
          user?: GitHubAuthenticatedUser;
          interval?: number;
          error?: string;
        };
        if (cancelled) return;

        if (data.status === "authorized" && data.accessToken && data.user) {
          setAccessToken(data.accessToken);
          setGhUser(data.user);
          setIsWaitingForGitHub(false);
          try {
            window.sessionStorage.setItem(
              SESSION_STORAGE_KEY,
              JSON.stringify({ accessToken: data.accessToken, user: data.user }),
            );
            if (popupRef.current && !popupRef.current.closed) {
              popupRef.current.close();
            }
          } catch {
            // ignore
          }
          return;
        }

        if (data.status === "failed") {
          setIsWaitingForGitHub(false);
          setErrorText(data.error || "GitHub authorization expired. Generating a fresh code…");
          startDeviceSession();
          return;
        }

        const nextWait = (data.interval || pollIntervalSec || 5) * 1000;
        timer = setTimeout(pollOnce, nextWait);
      } catch {
        if (!cancelled) {
          timer = setTimeout(pollOnce, (pollIntervalSec || 5) * 1000);
        }
      }
    };

    timer = setTimeout(pollOnce, (pollIntervalSec || 5) * 1000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [deviceCode, accessToken, pollIntervalSec, customAppConfig, startDeviceSession]);

  const handleCopyAndOpenGitHub = async () => {
    setErrorText(null);
    if (userCode) {
      try {
        await navigator.clipboard.writeText(userCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 3500);
      } catch {
        // ignore clipboard permission issues
      }
    }
    setIsWaitingForGitHub(true);
    const width = 620;
    const height = 740;
    const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2));
    const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2));
    const popup = window.open(
      verificationUri,
      "github_oauth_window",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
    popupRef.current = popup;
  };

  const activeAppSlug = customAppConfig?.slug || serverAppSlug;

  const handleInstallGitHubAppRedirect = () => {
    if (!activeAppSlug) return;
    window.location.href = `https://github.com/apps/${encodeURIComponent(activeAppSlug)}/installations/new?state=${encodeURIComponent(projectId || "connect")}`;
  };

  // 1-Click GitHub App registration on `https://github.com/settings/apps/new`
  const handleCreateGitHubAppOnGitHub = () => {
    if (typeof window === "undefined") return;
    const origin = window.location.origin;
    const callbackUrl = `${origin}/api/github/callback`;
    const suffix = Date.now().toString(36).slice(-5);
    const manifest = {
      name: `Reigel SEO Agent ${suffix}`,
      url: origin,
      redirect_url: callbackUrl,
      setup_url: callbackUrl,
      setup_on_update: true,
      request_oauth_on_install: true,
      public: true,
      default_permissions: {
        contents: "write",
        pull_requests: "write",
        metadata: "read",
      },
      default_events: ["push", "pull_request"],
    };
    setManifestJson(JSON.stringify(manifest));
    setTimeout(() => {
      manifestFormRef.current?.submit();
    }, 50);
  };

  const handleVerifyPat = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = patValue.trim();
    if (!trimmed) {
      setErrorText("Please enter a valid GitHub Personal Access Token.");
      return;
    }
    setIsVerifyingPat(true);
    setErrorText(null);
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: "application/vnd.github+json",
        },
        cache: "no-store",
      });
      if (!res.ok) {
        throw new Error("GitHub rejected this token. Verify the token has `repo` permissions.");
      }
      const data = (await res.json()) as {
        login?: string;
        name?: string | null;
        avatar_url?: string | null;
        email?: string | null;
        html_url?: string;
      };
      if (!data.login) {
        throw new Error("Could not verify GitHub user profile for this token.");
      }
      const verifiedUser: GitHubAuthenticatedUser = {
        login: data.login,
        name: data.name ?? null,
        avatarUrl: data.avatar_url ?? null,
        email: data.email ?? null,
        htmlUrl: data.html_url ?? `https://github.com/${data.login}`,
      };
      setAccessToken(trimmed);
      setGhUser(verifiedUser);
      try {
        window.sessionStorage.setItem(
          SESSION_STORAGE_KEY,
          JSON.stringify({ accessToken: trimmed, user: verifiedUser }),
        );
      } catch {
        // ignore
      }
    } catch (err) {
      setErrorText(errorMessage(err));
    } finally {
      setIsVerifyingPat(false);
    }
  };

  const handleSwitchGitHubAccount = () => {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
    setAccessToken("");
    setGhUser(null);
    setRepos([]);
    setDeviceCode(null);
    setUserCode(null);
    setIsWaitingForGitHub(false);
  };

  const filteredRepos = useMemo(() => {
    const q = repoSearch.trim().toLowerCase();
    return repos.filter((r) => {
      if (visibilityFilter === "public" && r.private) return false;
      if (visibilityFilter === "private" && !r.private) return false;
      if (!q) return true;
      return (
        r.full_name.toLowerCase().includes(q) ||
        (r.description || "").toLowerCase().includes(q) ||
        (r.language || "").toLowerCase().includes(q)
      );
    });
  }, [repos, repoSearch, visibilityFilter]);

  const selectedRepoObj = useMemo(
    () => repos.find((r) => r.full_name === selectedFullName) || null,
    [repos, selectedFullName],
  );

  const handleConnectSelectedRepo = async () => {
    if (!projectId) {
      setErrorText("Please select a website project first.");
      return;
    }
    if (!accessToken) {
      setErrorText("Please authenticate with GitHub first.");
      return;
    }
    const [owner, name] = selectedFullName.split("/");
    if (!owner || !name) {
      setErrorText("Please select a GitHub repository to connect.");
      return;
    }

    setErrorText(null);
    try {
      await connectRepo.mutateAsync({
        owner: owner.trim(),
        name: name.trim(),
        defaultBranch: branchInput.trim() || "main",
        framework: frameworkInput || "nextjs",
        accessToken,
      });
      onConnected?.({
        owner: owner.trim(),
        name: name.trim(),
        defaultBranch: branchInput.trim() || "main",
      });
    } catch (err) {
      setErrorText(errorMessage(err));
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className={`flex flex-col overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 text-brand-950 shadow-2xl ${
        mode === "modal" ? "my-auto max-h-[90vh] w-full max-w-2xl" : "w-full"
      }`}
    >
      {/* Hidden form for 1-click GitHub App Manifest creation on https://github.com/settings/apps/new */}
      <form
        ref={manifestFormRef}
        action={`https://github.com/settings/apps/new?state=${encodeURIComponent(`manifest_${projectId || "default"}`)}`}
        method="post"
        className="hidden"
      >
        <input type="hidden" name="manifest" value={manifestJson} readOnly />
      </form>

      {/* Top Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-brand-100 bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <GitHubLogo />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-brand-950">
                Connect GitHub to Reigel Coding Agent
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full border border-success-200 bg-success-50 px-2 py-0.5 text-[10.5px] font-semibold text-success-700">
                <ShieldCheck size={11} />
                Official GitHub.com OAuth
              </span>
            </div>
            <p className="truncate text-xs text-brand-500">
              {userEmail
                ? `Signed in as ${userEmail} · Authenticate your GitHub account on github.com`
                : "Authenticate directly on github.com and select the repository to connect"}
            </p>
          </div>
        </div>

        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close GitHub connection modal"
            className="rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1 text-xs font-semibold text-brand-600 transition hover:bg-brand-50 hover:text-brand-950"
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable Body */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 space-y-5">
        {statusBanner && (
          <div className="flex items-center gap-2.5 rounded-xl border border-primary-200 bg-primary-50 p-3.5 text-xs font-medium text-primary-800">
            <RefreshCw size={14} className="animate-spin shrink-0 text-primary-600" />
            <span>{statusBanner}</span>
          </div>
        )}

        {errorText && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl border border-error-200 bg-error-50 p-3.5 text-xs text-error-800"
          >
            <AlertCircle size={15} className="mt-0.5 shrink-0 text-error-600" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">GitHub Connection Error</p>
              <p className="mt-0.5">{errorText}</p>
            </div>
          </div>
        )}

        {/* STEP 1: Authenticate with real GitHub.com */}
        {!ghUser ? (
          <div className="space-y-5">
            {/* Primary Real GitHub.com OAuth Card */}
            <div className="rounded-2xl border border-brand-200 bg-surface-2/60 p-5 space-y-4">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="space-y-1 min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-950 px-2.5 py-0.5 text-[10.5px] font-semibold text-white">
                    Step 1 of 2 · GitHub.com Authentication
                  </span>
                  <h3 className="text-sm font-bold text-brand-950 pt-1">
                    Authorize Your GitHub Account on github.com
                  </h3>
                  <p className="text-xs text-brand-600 leading-relaxed">
                    Sign in with any GitHub account on{" "}
                    <span className="font-mono font-semibold text-brand-900">github.com</span>,
                    complete GitHub&apos;s security/email verification if prompted, and grant
                    repository access so the SEO Coding Agent can open automated pull requests.
                  </p>
                </div>
              </div>

              {/* Option A: Dedicated GitHub App Installation redirect if configured */}
              {activeAppSlug && (
                <div className="rounded-xl border border-primary-200 bg-primary-50/60 p-4 space-y-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div>
                      <p className="text-xs font-bold text-brand-950">
                        GitHub App Installation ({activeAppSlug})
                      </p>
                      <p className="text-[11px] text-brand-600">
                        Redirects directly to{" "}
                        <span className="font-mono">
                          github.com/apps/{activeAppSlug}/installations/new
                        </span>{" "}
                        to choose All repositories or Only select repositories.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInstallGitHubAppRedirect}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-800"
                    >
                      <span>Install &amp; Authorize on GitHub.com</span>
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>
              )}

              {/* Universal Multi-User GitHub.com OAuth Device Flow */}
              <div className="rounded-xl border border-brand-200 bg-surface-1 p-4 space-y-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1">
                    <p className="text-xs font-bold text-brand-950">
                      One-Time GitHub.com Verification Code
                    </p>
                    <p className="text-[11px] text-brand-500">
                      Click <span className="font-semibold text-brand-800">Continue on GitHub.com</span>{" "}
                      below — we automatically copy this code and open{" "}
                      <span className="font-mono text-brand-700">github.com/login/device</span>.
                    </p>
                  </div>

                  {isStartingDevice ? (
                    <div className="inline-flex items-center gap-2 rounded-xl border border-brand-200 bg-surface-2 px-4 py-2.5 text-xs font-medium text-brand-600">
                      <RefreshCw size={13} className="animate-spin" />
                      <span>Requesting code from github.com…</span>
                    </div>
                  ) : userCode ? (
                    <div className="flex items-center gap-2">
                      <code className="rounded-xl border-2 border-brand-900 bg-surface-2 px-3.5 py-2 font-mono text-base font-bold tracking-widest text-brand-950 select-all">
                        {userCode}
                      </code>
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(userCode);
                            setCopiedCode(true);
                            setTimeout(() => setCopiedCode(false), 2500);
                          } catch {
                            // ignore
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 px-2.5 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-100"
                        title="Copy verification code"
                      >
                        {copiedCode ? <Check size={14} className="text-success-600" /> : <Copy size={14} />}
                        <span>{copiedCode ? "Copied" : "Copy"}</span>
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={startDeviceSession}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-semibold text-brand-700 hover:bg-brand-100"
                    >
                      <RefreshCw size={13} />
                      <span>Generate Code</span>
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-3.5">
                  <div className="flex items-center gap-2 text-xs text-brand-600">
                    {isWaitingForGitHub ? (
                      <>
                        <RefreshCw size={13} className="animate-spin text-primary-600 shrink-0" />
                        <span className="font-medium text-primary-800">
                          Waiting for you to click Authorize on github.com… (auto-detects immediately)
                        </span>
                      </>
                    ) : (
                      <span>
                        Works with any personal or organization GitHub account (including 2FA &amp; SSO).
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={!userCode || isStartingDevice}
                    onClick={handleCopyAndOpenGitHub}
                    className="inline-flex items-center gap-2 rounded-xl bg-brand-950 px-4 py-2.5 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-800 disabled:opacity-50"
                  >
                    <span>
                      {isWaitingForGitHub ? "Re-open GitHub.com" : "Copy Code & Continue on GitHub.com"}
                    </span>
                    <ExternalLink size={13} />
                  </button>
                </div>
              </div>
            </div>

            {/* Secondary Options: 1-Click GitHub App Registration OR Personal Access Token */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col justify-between rounded-xl border border-brand-200 bg-surface-1 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                    <Sparkles size={13} className="text-primary-600" />
                    <span>Dedicated GitHub App Flow</span>
                  </div>
                  <p className="text-[11px] text-brand-500">
                    Want the direct{" "}
                    <span className="font-mono">github.com/apps/.../installations/new</span> screen
                    for your workspace? Register your GitHub App on github.com in 1 click.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleCreateGitHubAppOnGitHub}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  <span>Create &amp; Install GitHub App on GitHub.com</span>
                  <ExternalLink size={12} />
                </button>
              </div>

              <div className="flex flex-col justify-between rounded-xl border border-brand-200 bg-surface-1 p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                    <KeyRound size={13} className="text-brand-600" />
                    <span>Personal Access Token (PAT)</span>
                  </div>
                  <p className="text-[11px] text-brand-500">
                    Prefer connecting with a Fine-Grained or Classic GitHub Token (
                    <span className="font-mono">ghp_…</span> /{" "}
                    <span className="font-mono">github_pat_…</span>)?
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPatInput((v) => !v)}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 rounded-lg border border-brand-200 bg-surface-2 px-3 py-2 text-xs font-semibold text-brand-800 transition hover:bg-brand-100"
                >
                  <span>{showPatInput ? "Hide Token Input" : "Connect with Access Token"}</span>
                </button>
              </div>
            </div>

            {showPatInput && (
              <form
                onSubmit={handleVerifyPat}
                className="rounded-xl border border-brand-200 bg-surface-2 p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <label htmlFor="github-pat-input" className="text-xs font-bold text-brand-950">
                    GitHub Personal Access Token (with <code className="font-mono">repo</code> scope)
                  </label>
                  <a
                    href="https://github.com/settings/tokens/new?scopes=repo,read:user&description=Reigel+AI+SEO+Coding+Agent"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-600 hover:underline"
                  >
                    <span>Generate token on github.com</span>
                    <ExternalLink size={11} />
                  </a>
                </div>
                <div className="flex gap-2">
                  <input
                    id="github-pat-input"
                    type="password"
                    value={patValue}
                    onChange={(e) => setPatValue(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
                    className="min-w-0 flex-1 rounded-xl border border-brand-200 bg-surface-1 px-3.5 py-2 font-mono text-xs text-brand-950 focus:border-brand-900 focus:outline-hidden"
                  />
                  <button
                    type="submit"
                    disabled={isVerifyingPat || !patValue.trim()}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-800 disabled:opacity-50"
                  >
                    {isVerifyingPat ? "Verifying…" : "Verify Token"}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* STEP 2: Authenticated GitHub Account -> Pick Real Repository */
          <div className="space-y-5">
            {/* Authenticated GitHub User Banner */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-success-200 bg-success-50/70 p-3.5">
              <div className="flex items-center gap-3 min-w-0">
                {ghUser.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ghUser.avatarUrl}
                    alt={ghUser.login}
                    className="h-9 w-9 rounded-full border border-success-300 bg-surface-1 object-cover"
                  />
                ) : (
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-950 text-xs font-bold text-white">
                    {ghUser.login.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-bold text-brand-950">
                      {ghUser.name || ghUser.login}
                    </span>
                    <a
                      href={ghUser.htmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-xs font-semibold text-success-800 hover:underline"
                    >
                      @{ghUser.login}
                    </a>
                    <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-semibold text-success-800">
                      <CheckCircle2 size={10} />
                      Authenticated via GitHub.com
                    </span>
                  </div>
                  <p className="text-[11px] text-brand-600 truncate">
                    Select which repository from your GitHub account to connect to the SEO Coding Agent
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fetchLiveRepositories(accessToken)}
                  disabled={loadingRepos}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                  title="Refresh repositories from GitHub"
                >
                  <RefreshCw size={12} className={loadingRepos ? "animate-spin" : ""} />
                  <span>Refresh</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwitchGitHubAccount}
                  className="inline-flex items-center gap-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50"
                >
                  <LogOut size={12} />
                  <span>Switch Account</span>
                </button>
              </div>
            </div>

            {/* Search & Visibility Filters */}
            <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative min-w-0 flex-1">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-brand-400"
                />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  placeholder="Search your GitHub repositories (owner/repository)…"
                  className="w-full rounded-xl border border-brand-200 bg-surface-1 py-2 pr-3 pl-9 text-xs text-brand-950 focus:border-brand-900 focus:outline-hidden"
                />
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-brand-200 bg-surface-2 p-1">
                {(["all", "public", "private"] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setVisibilityFilter(f)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                      visibilityFilter === f
                        ? "bg-surface-1 text-brand-950 shadow-2xs"
                        : "text-brand-500 hover:text-brand-900"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </div>

            {/* Repository List from api.github.com */}
            <div className="max-h-64 overflow-y-auto rounded-xl border border-brand-200 bg-surface-1 divide-y divide-brand-100">
              {loadingRepos ? (
                <div className="flex items-center justify-center gap-2 py-12 text-xs text-brand-500">
                  <RefreshCw size={15} className="animate-spin text-brand-600" />
                  <span>Loading your repositories from api.github.com…</span>
                </div>
              ) : filteredRepos.length === 0 ? (
                <div className="py-10 text-center text-xs text-brand-500 space-y-1">
                  <p className="font-semibold text-brand-700">No matching repositories found</p>
                  <p>Try clearing the search filter or check your GitHub repository permissions.</p>
                </div>
              ) : (
                filteredRepos.map((r) => {
                  const isSelected = r.full_name === selectedFullName;
                  return (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setSelectedFullName(r.full_name);
                        setBranchInput(r.default_branch || "main");
                        setFrameworkInput(inferFramework(r));
                      }}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition ${
                        isSelected ? "bg-primary-50/70" : "hover:bg-brand-50/60"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-xs font-bold text-brand-950 truncate">
                            {r.full_name}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              r.private
                                ? "border-warning-200 bg-warning-50 text-warning-800"
                                : "border-brand-200 bg-surface-2 text-brand-600"
                            }`}
                          >
                            {r.private ? <Lock size={9} /> : <Globe size={9} />}
                            {r.private ? "Private" : "Public"}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10.5px] font-mono text-brand-500">
                            <GitBranch size={11} />
                            {r.default_branch}
                          </span>
                        </div>
                        {r.description && (
                          <p className="mt-0.5 truncate text-[11px] text-brand-500">
                            {r.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0">
                        <span
                          className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                            isSelected
                              ? "border-brand-950 bg-brand-950 text-white"
                              : "border-brand-300 bg-surface-1"
                          }`}
                        >
                          {isSelected && <Check size={12} />}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Target Branch & Framework Settings */}
            {selectedRepoObj && (
              <div className="grid grid-cols-1 gap-3 rounded-xl border border-brand-200 bg-surface-2 p-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="github-branch-input"
                    className="block text-[11px] font-bold text-brand-700"
                  >
                    Default Base Branch
                  </label>
                  <input
                    id="github-branch-input"
                    type="text"
                    value={branchInput}
                    onChange={(e) => setBranchInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 font-mono text-xs text-brand-950 focus:border-brand-900 focus:outline-hidden"
                  />
                </div>
                <div>
                  <label
                    htmlFor="github-framework-select"
                    className="block text-[11px] font-bold text-brand-700"
                  >
                    Repository Framework
                  </label>
                  <select
                    id="github-framework-select"
                    value={frameworkInput}
                    onChange={(e) => setFrameworkInput(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-brand-200 bg-surface-1 px-3 py-1.5 text-xs font-medium text-brand-950 focus:border-brand-900 focus:outline-hidden"
                  >
                    <option value="nextjs">Next.js</option>
                    <option value="Astro">Astro</option>
                    <option value="Remix">Remix</option>
                    <option value="WordPress">WordPress</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-brand-100 bg-surface-2 px-6 py-4">
        <div className="text-xs text-brand-500">
          {ghUser && selectedFullName ? (
            <span>
              Selected:{" "}
              <strong className="font-mono text-brand-950">{selectedFullName}</strong> (
              <span className="font-mono">{branchInput || "main"}</span>)
            </span>
          ) : (
            <span>OAuth tokens are verified via GitHub API and encrypted at rest.</span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-brand-200 bg-surface-1 px-4 py-2 text-xs font-semibold text-brand-700 transition hover:bg-brand-50"
            >
              Cancel
            </button>
          )}

          {ghUser && (
            <button
              type="button"
              disabled={!selectedFullName || connectRepo.isPending}
              onClick={handleConnectSelectedRepo}
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-950 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-brand-800 disabled:opacity-50"
            >
              <span>
                {connectRepo.isPending ? "Verifying & Connecting…" : "Connect Repository"}
              </span>
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
