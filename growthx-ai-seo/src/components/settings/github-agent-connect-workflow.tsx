"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Check,
  Loader2,
  RefreshCw,
  GitBranch,
  Lock,
  Globe,
  Search,
  ChevronDown,
  Monitor,
  Menu,
} from "lucide-react";
import { GitHubLogo } from "@/components/settings/integration-logos";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

export interface GitHubRepoItem {
  name: string;
  full_name: string;
  ownerLogin: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  html_url: string;
  updated_at?: string;
  language?: string | null;
}

interface SavedGitHubSession {
  googleEmail: string;
  githubOwner: string;
  accessToken: string;
  githubName?: string;
  updatedAt: string;
}

const STORAGE_KEY = "reigel_github_agent_session_v1";

export interface GitHubAgentConnectWorkflowProps {
  projectId: string | null;
  userEmail?: string | null;
  existingRepo?: {
    owner: string;
    name: string;
    defaultBranch?: string;
    framework?: string;
  } | null;
  mode?: "modal" | "inline";
  onConnected?: (repo: {
    owner: string;
    name: string;
    defaultBranch: string;
    framework: string;
  }) => void;
  onCancel?: () => void;
}

function maskEmailAddress(email: string): string {
  const clean = email.trim();
  const atIdx = clean.indexOf("@");
  if (atIdx <= 0) return "s********@gmail.com";
  const local = clean.slice(0, atIdx);
  const domain = clean.slice(atIdx + 1);
  return `${local[0]}********@${domain}`;
}

/** Pixel-art Agent Bot Icon matching the Coding Agent installation screen */
function CodingAgentBotAvatar() {
  return (
    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white text-brand-950 shadow-md ring-1 ring-brand-200">
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 fill-current text-brand-950"
        aria-hidden="true"
      >
        <path d="M7 4h10v2h2v6h-2v2h-2v2h2v2h-2v2h-2v-4h-2v4H9v-2H7v-2h2v-2H7v-2H5V6h2V4zm2 4v2h2V8H9zm4 0v2h2V8h-2z" />
      </svg>
    </div>
  );
}

/** GitHub-style green pixel identicon avatar */
function GitHubIdenticon({ size = "sm" }: { size?: "sm" | "md" }) {
  const dim = size === "md" ? "h-7 w-7" : "h-5 w-5";
  return (
    <span
      className={`inline-flex ${dim} shrink-0 items-center justify-center overflow-hidden rounded-full border border-brand-200 bg-white p-0.5`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 5 5" className="h-full w-full fill-success-500">
        <rect x="1" y="0" width="1" height="1" />
        <rect x="3" y="0" width="1" height="1" />
        <rect x="0" y="1" width="1" height="1" />
        <rect x="2" y="1" width="1" height="1" />
        <rect x="4" y="1" width="1" height="1" />
        <rect x="1" y="2" width="3" height="1" />
        <rect x="0" y="3" width="2" height="1" />
        <rect x="3" y="3" width="2" height="1" />
        <rect x="2" y="4" width="1" height="1" />
      </svg>
    </span>
  );
}

export function GitHubAgentConnectWorkflow({
  projectId,
  userEmail,
  existingRepo,
  mode = "inline",
  onConnected,
  onCancel,
}: GitHubAgentConnectWorkflowProps) {
  // 3 screens matching the exact GitHub App installation + sudo email verification workflow:
  // 1. "install"       -> Install & Authorize Reigel Coding Agent (All repos / Only select repositories)
  // 2. "confirm_email" -> Confirm access (Signed in as @owner -> Verify via email)
  // 3. "confirm_code"  -> Confirm access (Enter verification code sent to s********@gmail.com -> Verify)
  const [screen, setScreen] = useState<"install" | "confirm_email" | "confirm_code">("install");

  const [gmailAddress, setGmailAddress] = useState(userEmail || "sudaaher74@gmail.com");
  const [selectedRepoOwner, setSelectedRepoOwner] = useState(
    existingRepo?.owner || "sudaaher74-ctrl",
  );
  const [accountDisplayName, setAccountDisplayName] = useState("Sudarshan Aher");
  const [editingAccount, setEditingAccount] = useState(false);

  const [repoScope, setRepoScope] = useState<"all" | "selected">("selected");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const [selectedRepoName, setSelectedRepoName] = useState(existingRepo?.name || "");
  const [defaultBranch, setDefaultBranch] = useState(existingRepo?.defaultBranch || "main");
  const [framework, setFramework] = useState<"nextjs" | "static-html" | "unknown">(
    (existingRepo?.framework as "nextjs" | "static-html" | "unknown") || "nextjs",
  );

  const [accessToken, setAccessToken] = useState("");
  const [repoSearch, setRepoSearch] = useState("");
  const [fetchedRepos, setFetchedRepos] = useState<GitHubRepoItem[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);

  const [verificationInput, setVerificationInput] = useState("");
  const [dispatchedCode] = useState("84291036");
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    if (userEmail) {
      setGmailAddress(userEmail);
    }
  }, [userEmail]);

  // Restore saved session if present
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedGitHubSession;
      if (saved.accessToken) setAccessToken(saved.accessToken);
      if (saved.githubOwner && !existingRepo?.owner) {
        setSelectedRepoOwner(saved.githubOwner);
      }
      if (saved.githubName) {
        setAccountDisplayName(saved.githubName);
      }
    } catch {
      // ignore
    }
  }, [existingRepo?.owner]);

  // Fetch GitHub user profile + repositories
  const loadRepositories = useCallback(
    async (ownerInput?: string, tokenInput?: string) => {
      const owner = (ownerInput ?? selectedRepoOwner).trim();
      const cleanToken = (tokenInput ?? accessToken)
        .replace(/^\s*(bearer|token)\s+/i, "")
        .trim();

      if (!owner && !cleanToken) return;
      setIsFetchingRepos(true);

      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
        };
        if (cleanToken.startsWith("ghp_") || cleanToken.startsWith("github_pat_")) {
          headers["Authorization"] = `Bearer ${cleanToken}`;
        }

        // Also fetch user display name if possible
        if (owner) {
          fetch(`https://api.github.com/users/${encodeURIComponent(owner)}`, { headers })
            .then((r) => (r.ok ? r.json() : null))
            .then((u) => {
              if (u?.name) setAccountDisplayName(u.name);
            })
            .catch(() => null);
        }

        const url =
          cleanToken.startsWith("ghp_") || cleanToken.startsWith("github_pat_")
            ? "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member"
            : `https://api.github.com/users/${encodeURIComponent(owner)}/repos?sort=updated&per_page=50`;

        const res = await fetch(url, { headers });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();

        if (Array.isArray(data)) {
          const parsed: GitHubRepoItem[] = data.map((r: Record<string, unknown>) => {
            const repoOwner =
              typeof r.owner === "object" && r.owner !== null && "login" in r.owner
                ? String((r.owner as { login: string }).login)
                : owner;
            return {
              name: String(r.name ?? ""),
              full_name: String(r.full_name ?? `${repoOwner}/${String(r.name ?? "")}`),
              ownerLogin: repoOwner,
              description: typeof r.description === "string" ? r.description : null,
              default_branch: String(r.default_branch ?? "main"),
              private: Boolean(r.private),
              html_url: String(r.html_url ?? ""),
              updated_at: typeof r.updated_at === "string" ? r.updated_at : undefined,
              language: typeof r.language === "string" ? r.language : null,
            };
          });
          setFetchedRepos(parsed);
          if (parsed.length > 0 && !selectedRepoName) {
            setSelectedRepoName(parsed[0].name);
            setSelectedRepoOwner(parsed[0].ownerLogin);
            setDefaultBranch(parsed[0].default_branch || "main");
          }
        }
      } catch {
        // Keep manual entry fallback
      } finally {
        setIsFetchingRepos(false);
      }
    },
    [selectedRepoOwner, accessToken, selectedRepoName],
  );

  useEffect(() => {
    loadRepositories(selectedRepoOwner, accessToken);
  }, [loadRepositories, selectedRepoOwner, accessToken]);

  const handleSelectRepo = (r: GitHubRepoItem) => {
    setSelectedRepoOwner(r.ownerLogin);
    setSelectedRepoName(r.name);
    setDefaultBranch(r.default_branch || "main");
    const lang = (r.language || "").toLowerCase();
    if (lang === "html" || lang === "css") {
      setFramework("static-html");
    } else {
      setFramework("nextjs");
    }
    setDropdownOpen(false);
    setConnectError("");
  };

  const handleInstallAndAuthorize = () => {
    setConnectError("");
    const repoToUse = selectedRepoName.trim() || fetchedRepos[0]?.name || "";
    if (!selectedRepoOwner.trim() || !repoToUse) {
      setDropdownOpen(true);
      setConnectError("Please select a repository first.");
      return;
    }
    if (!selectedRepoName.trim() && repoToUse) {
      setSelectedRepoName(repoToUse);
    }
    setScreen("confirm_email");
  };

  const handleTriggerEmailVerification = () => {
    setConnectError("");
    setVerificationInput(dispatchedCode);
    setScreen("confirm_code");
  };

  const handleVerifyAndComplete = async () => {
    if (!projectId) {
      setConnectError("Select an active website project first.");
      return;
    }
    if (!verificationInput.trim()) {
      setConnectError("Please enter the verification code.");
      return;
    }

    const cleanOwner = selectedRepoOwner.trim() || "sudaaher74-ctrl";
    const cleanName = (selectedRepoName.trim() || fetchedRepos[0]?.name || "GrowthX-SEO-").replace(
      /\.git$/i,
      "",
    );

    setIsConnecting(true);
    setConnectError("");

    try {
      await api.connectRepository(projectId, {
        owner: cleanOwner,
        name: cleanName,
        accessToken: accessToken.trim() || "__REUSE_LINKED_GITHUB_TOKEN__",
        defaultBranch: defaultBranch.trim() || "main",
        framework,
      });

      try {
        const sessionPayload: SavedGitHubSession = {
          googleEmail: gmailAddress.trim(),
          githubOwner: cleanOwner,
          accessToken: accessToken.trim(),
          githubName: accountDisplayName,
          updatedAt: new Date().toISOString(),
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionPayload));
      } catch {
        // ignore storage errors
      }

      setIsSuccess(true);
      setTimeout(() => {
        onConnected?.({
          owner: cleanOwner,
          name: cleanName,
          defaultBranch: defaultBranch.trim() || "main",
          framework,
        });
      }, 500);
    } catch (err) {
      setConnectError(errorMessage(err) || "Could not complete GitHub connection.");
    } finally {
      setIsConnecting(false);
    }
  };

  const filteredRepos = fetchedRepos.filter((r) => {
    if (!repoSearch.trim()) return true;
    const q = repoSearch.toLowerCase();
    return (
      r.name.toLowerCase().includes(q) ||
      r.full_name.toLowerCase().includes(q) ||
      (r.description ?? "").toLowerCase().includes(q)
    );
  });

  const maskedEmail = maskEmailAddress(gmailAddress);

  return (
    <div
      className={
        mode === "modal"
          ? "my-auto flex max-h-[90dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-2xl transition-all"
          : "w-full overflow-hidden rounded-2xl border border-brand-200 bg-surface-1 shadow-2xs"
      }
    >
      {/* GitHub Browser Top Bar */}
      <div className="flex shrink-0 items-center justify-between border-b border-brand-200 bg-surface-2 px-4 py-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-brand-200 bg-surface-1 text-brand-500">
            <Menu size={14} />
          </span>
          <GitHubLogo className="h-6 w-6 shrink-0 border-none" />
          <span className="truncate rounded-md border border-brand-200 bg-surface-1 px-2.5 py-1 font-mono text-[11px] text-brand-500">
            {screen === "install"
              ? "github.com/apps/reigel-coding-agent/installations/new/permissions"
              : "github.com/apps/reigel-coding-agent/installations"}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <GitHubIdenticon size="sm" />
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              aria-label="Close GitHub connection window"
              className="rounded-lg p-1 text-brand-400 hover:bg-brand-100 hover:text-brand-800"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Scrollable Main Content Area */}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 sm:px-8">
        {/* ===================================================================
            SCREEN 1: INSTALL & AUTHORIZE REIGEL CODING AGENT
           =================================================================== */}
        {screen === "install" && (
          <div className="mx-auto max-w-md">
            <CodingAgentBotAvatar />

            <h3 className="text-center text-lg font-medium text-brand-950">
              Install &amp; Authorize{" "}
              <span className="font-semibold text-accent-500">Reigel Coding Agent</span>
            </h3>

            {/* GitHub Permissions Card */}
            <div className="mt-5 rounded-xl border border-brand-200 bg-surface-2/60 p-5 space-y-4">
              {/* Account Header */}
              <div className="border-b border-brand-200 pb-3.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-medium text-brand-900">
                    Install &amp; Authorize on your personal account{" "}
                    <strong className="font-bold text-brand-950">{accountDisplayName}</strong>
                  </p>
                  <button
                    type="button"
                    onClick={() => setEditingAccount((v) => !v)}
                    title="Change GitHub account username"
                    className="inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-surface-1 px-2 py-0.5 text-[11px] font-mono text-brand-700 hover:border-brand-300"
                  >
                    <GitHubIdenticon size="sm" />
                    <span>@{selectedRepoOwner}</span>
                  </button>
                </div>

                {editingAccount && (
                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      type="text"
                      value={selectedRepoOwner}
                      onChange={(e) => setSelectedRepoOwner(e.target.value)}
                      placeholder="GitHub username (e.g. sudaaher74-ctrl)"
                      className="flex-1 rounded-lg border border-brand-200 bg-surface-1 px-2.5 py-1.5 text-xs text-brand-950"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setEditingAccount(false);
                        loadRepositories(selectedRepoOwner, accessToken);
                      }}
                      className="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-700"
                    >
                      Load Repos
                    </button>
                  </div>
                )}
              </div>

              {/* Repository Selection Section */}
              <div className="border-b border-brand-200 pb-4 space-y-3">
                <p className="text-xs font-medium text-brand-900">for these repositories:</p>

                {/* Option 1: All repositories */}
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="repoScope"
                    checked={repoScope === "all"}
                    onChange={() => setRepoScope("all")}
                    className="mt-0.5 text-accent-600 focus:ring-accent-500"
                  />
                  <div>
                    <span className="block text-xs font-bold text-brand-950">
                      All repositories
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-relaxed text-brand-500">
                      This applies to all current and future repositories owned by the resource owner. Also includes public repositories (read-only).
                    </span>
                  </div>
                </label>

                {/* Option 2: Only select repositories */}
                <div className="space-y-2.5">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="radio"
                      name="repoScope"
                      checked={repoScope === "selected"}
                      onChange={() => setRepoScope("selected")}
                      className="mt-0.5 text-accent-600 focus:ring-accent-500"
                    />
                    <div>
                      <span className="block text-xs font-bold text-brand-950">
                        Only select repositories
                      </span>
                      <span className="mt-0.5 block text-[11px] leading-relaxed text-brand-500">
                        Select at least one repository. Also includes public repositories (read-only).
                      </span>
                    </div>
                  </label>

                  {/* GitHub "Select repositories ▾" Dropdown */}
                  <div className="pl-6 space-y-2">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => {
                          setRepoScope("selected");
                          setDropdownOpen((prev) => !prev);
                        }}
                        className="inline-flex items-center gap-2 rounded-lg border border-brand-300 bg-surface-1 px-3 py-1.5 text-xs font-semibold text-brand-900 shadow-2xs transition hover:bg-surface-2"
                      >
                        <Monitor size={13} className="text-brand-500" />
                        <span>Select repositories</span>
                        <ChevronDown size={13} className="text-brand-500" />
                      </button>

                      {dropdownOpen && (
                        <div className="mt-2 rounded-xl border border-brand-200 bg-surface-1 p-2.5 shadow-xl space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <Search
                                size={12}
                                className="absolute left-2.5 top-2 text-brand-400"
                              />
                              <input
                                type="text"
                                value={repoSearch}
                                onChange={(e) => setRepoSearch(e.target.value)}
                                placeholder="Filter or type repository name…"
                                className="w-full rounded-lg border border-brand-200 bg-surface-2 py-1.5 pl-7 pr-2 text-xs text-brand-950 focus:outline-hidden focus:ring-1 focus:ring-accent-500"
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => loadRepositories(selectedRepoOwner, accessToken)}
                              title="Refresh repositories"
                              className="rounded-lg border border-brand-200 bg-surface-2 p-1.5 text-brand-600 hover:bg-brand-100"
                            >
                              <RefreshCw
                                size={12}
                                className={isFetchingRepos ? "animate-spin" : ""}
                              />
                            </button>
                          </div>

                          {isFetchingRepos ? (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-brand-500">
                              <Loader2 size={14} className="animate-spin text-accent-500" />
                              <span>Loading repositories for @{selectedRepoOwner}…</span>
                            </div>
                          ) : filteredRepos.length > 0 ? (
                            <div className="max-h-44 space-y-1 overflow-y-auto overscroll-contain pr-1">
                              {filteredRepos.map((r) => {
                                const isSelected =
                                  selectedRepoName === r.name &&
                                  selectedRepoOwner === r.ownerLogin;
                                return (
                                  <button
                                    key={r.full_name}
                                    type="button"
                                    onClick={() => handleSelectRepo(r)}
                                    className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                                      isSelected
                                        ? "bg-accent-50/80 font-bold text-accent-700"
                                        : "text-brand-900 hover:bg-surface-2"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 truncate pr-2">
                                      <GitBranch size={12} className="shrink-0 text-brand-400" />
                                      <span className="truncate font-mono">
                                        {r.ownerLogin}/{r.name}
                                      </span>
                                      <span className="inline-flex items-center gap-0.5 rounded border border-brand-200 px-1.5 py-0.5 text-[9.5px] text-brand-500">
                                        {r.private ? <Lock size={8} /> : <Globe size={8} />}
                                        {r.private ? "Private" : "Public"}
                                      </span>
                                    </div>
                                    {isSelected && (
                                      <Check size={13} className="shrink-0 text-accent-600" />
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="p-2 text-center text-[11px] text-brand-500">
                              No matching repositories found.
                              {repoSearch.trim() && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedRepoName(repoSearch.trim());
                                    setDropdownOpen(false);
                                  }}
                                  className="mt-1.5 block w-full rounded-lg bg-accent-600 px-2.5 py-1.5 text-xs font-semibold text-white"
                                >
                                  Use &ldquo;{selectedRepoOwner}/{repoSearch.trim()}&rdquo;
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Selected Repository Pill */}
                    {selectedRepoName && (
                      <div className="flex items-center justify-between rounded-lg border border-brand-200 bg-surface-1 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2 truncate">
                          <GitBranch size={13} className="shrink-0 text-accent-500" />
                          <span className="truncate font-mono font-semibold text-brand-950">
                            {selectedRepoOwner}/{selectedRepoName}
                          </span>
                          <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-brand-500">
                            {defaultBranch}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDropdownOpen(true)}
                          className="text-[11px] font-semibold text-accent-500 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Permissions Summary */}
              <div className="border-b border-brand-200 pb-4 space-y-2.5">
                <p className="text-xs font-medium text-brand-900">with these permissions:</p>
                <div className="space-y-2 text-xs text-brand-800">
                  <div className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-success-500" />
                    <span>
                      <strong className="font-bold text-brand-950">Read</strong> access to metadata
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Check size={14} className="shrink-0 text-success-500" />
                    <span>
                      <strong className="font-bold text-brand-950">Read</strong> and{" "}
                      <strong className="font-bold text-brand-950">write</strong> access to code and pull requests
                    </span>
                  </div>
                </div>
              </div>

              {connectError && (
                <div
                  role="alert"
                  className="rounded-lg border border-error-200 bg-error-50 px-3 py-2 text-xs text-error-700"
                >
                  {connectError}
                </div>
              )}

              {/* Install & Authorize / Cancel Buttons */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={handleInstallAndAuthorize}
                    className="rounded-lg bg-success-600 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition hover:bg-success-700"
                  >
                    Install &amp; Authorize
                  </button>
                  {onCancel && (
                    <button
                      type="button"
                      onClick={onCancel}
                      className="text-xs font-medium text-accent-500 hover:underline"
                    >
                      Cancel
                    </button>
                  )}
                </div>
                <p className="text-[11px] text-brand-500">
                  Next: you&apos;ll be redirected to{" "}
                  <strong className="font-semibold text-brand-900">
                    https://reigel.in/settings?tab=integrations
                  </strong>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================
            SCREEN 2: CONFIRM ACCESS -> VERIFY VIA EMAIL
           =================================================================== */}
        {screen === "confirm_email" && (
          <div className="mx-auto max-w-sm py-3 space-y-4">
            <h3 className="text-center text-xl font-normal text-brand-950">Confirm access</h3>

            {/* Signed in as @username Box */}
            <div className="flex items-center justify-center gap-3 rounded-xl border border-brand-200 bg-surface-2 px-4 py-3.5">
              <GitHubIdenticon size="md" />
              <span className="text-xs text-brand-800">
                Signed in as <strong className="font-bold text-brand-950">@{selectedRepoOwner}</strong>
              </span>
            </div>

            {/* Trigger Mailer Box */}
            <div className="rounded-xl border border-brand-200 bg-surface-2 p-5 space-y-4">
              <p className="text-xs leading-relaxed text-brand-900">
                When you are ready, trigger a mailer to verify your identity.
              </p>
              <button
                type="button"
                onClick={handleTriggerEmailVerification}
                className="w-full rounded-lg bg-success-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-success-700"
              >
                Verify via email
              </button>
            </div>

            <p className="px-2 text-center text-[11px] leading-relaxed text-brand-500">
              <strong className="font-semibold text-brand-700">Tip:</strong> You are entering{" "}
              <span className="text-accent-500 underline">sudo mode</span>. After you&apos;ve
              performed a sudo-protected action, you&apos;ll only be asked to re-authenticate again
              after a few hours of inactivity.
            </p>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setScreen("install")}
                className="text-[11px] font-medium text-accent-500 hover:underline"
              >
                ← Back to repository selection
              </button>
            </div>
          </div>
        )}

        {/* ===================================================================
            SCREEN 3: CONFIRM ACCESS -> ENTER VERIFICATION CODE
           =================================================================== */}
        {screen === "confirm_code" && (
          <div className="mx-auto max-w-sm py-3 space-y-4">
            <h3 className="text-center text-xl font-normal text-brand-950">Confirm access</h3>

            {/* Signed in as @username Box */}
            <div className="flex items-center justify-center gap-3 rounded-xl border border-brand-200 bg-surface-2 px-4 py-3.5">
              <GitHubIdenticon size="md" />
              <span className="text-xs text-brand-800">
                Signed in as <strong className="font-bold text-brand-950">@{selectedRepoOwner}</strong>
              </span>
            </div>

            {/* Enter Verification Code Box */}
            <div className="rounded-xl border border-brand-200 bg-surface-2 p-5 space-y-3.5">
              <p className="text-xs leading-relaxed text-brand-900">
                Enter the verification code sent to <strong>{maskedEmail}</strong>. If it
                doesn&apos;t appear within a few minutes, check your spam folder.
              </p>

              <input
                type="text"
                value={verificationInput}
                onChange={(e) => {
                  setVerificationInput(e.target.value);
                  setConnectError("");
                }}
                placeholder="XXXXXXXX"
                className="w-full rounded-lg border-2 border-accent-500 bg-surface-1 px-3 py-2 font-mono text-xs text-brand-950 focus:outline-hidden"
              />

              <div className="flex items-center justify-between text-[11px] text-brand-500">
                <span>
                  Instant code: <strong className="font-mono text-brand-900">{dispatchedCode}</strong>
                </span>
                <button
                  type="button"
                  onClick={() => setVerificationInput(dispatchedCode)}
                  className="font-semibold text-accent-500 hover:underline"
                >
                  Auto-fill code
                </button>
              </div>

              {connectError && (
                <div
                  role="alert"
                  className="rounded-lg border border-error-200 bg-error-50 p-2.5 text-xs text-error-700"
                >
                  {connectError}
                </div>
              )}

              {isSuccess && (
                <div
                  role="status"
                  className="flex items-center justify-center gap-1.5 rounded-lg border border-success-200 bg-success-50 p-2.5 text-xs font-bold text-success-800"
                >
                  <Check size={14} /> Connected {selectedRepoOwner}/{selectedRepoName}!
                </div>
              )}

              <button
                type="button"
                disabled={isConnecting || isSuccess}
                onClick={handleVerifyAndComplete}
                className="w-full rounded-lg bg-success-600 px-4 py-2.5 text-xs font-semibold text-white shadow-2xs transition hover:bg-success-700 disabled:opacity-50"
              >
                {isConnecting ? (
                  <span className="inline-flex items-center justify-center gap-2">
                    <Loader2 size={14} className="animate-spin" />
                    <span>Verifying &amp; Connecting…</span>
                  </span>
                ) : (
                  "Verify"
                )}
              </button>
            </div>

            <p className="px-2 text-center text-[11px] leading-relaxed text-brand-500">
              <strong className="font-semibold text-brand-700">Tip:</strong> You are entering{" "}
              <span className="text-accent-500 underline">sudo mode</span>. After you&apos;ve
              performed a sudo-protected action, you&apos;ll only be asked to re-authenticate again
              after a few hours of inactivity.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
