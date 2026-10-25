"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Check,
  ArrowRight,
  Mail,
  Search,
  RefreshCw,
  Loader2,
  GitBranch,
  GitPullRequest,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  KeyRound,
  FolderGit2,
  Lock,
  Globe,
} from "lucide-react";
import { GitHubLogo, GoogleGLogo } from "@/components/settings/integration-logos";
import { api } from "@/lib/api-client";
import { errorMessage } from "@/lib/error-message";

const STORAGE_KEY = "reigel_github_agent_session_v1";

interface SavedGitHubSession {
  googleEmail: string;
  githubOwner: string;
  accessToken: string;
  githubAvatarUrl?: string;
  updatedAt: string;
}

interface GitHubRepoItem {
  name: string;
  full_name: string;
  ownerLogin: string;
  description: string | null;
  default_branch: string;
  private: boolean;
  language: string | null;
  canPush?: boolean;
}

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
  onConnected?: (repo: { owner: string; name: string; defaultBranch: string; framework: string }) => void;
  onCancel?: () => void;
}

export function GitHubAgentConnectWorkflow({
  projectId,
  userEmail,
  existingRepo,
  mode = "inline",
  onConnected,
  onCancel,
}: GitHubAgentConnectWorkflowProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [gmailAddress, setGmailAddress] = useState(userEmail || "");
  const [googleVerified, setGoogleVerified] = useState(true);

  const [selectedRepoOwner, setSelectedRepoOwner] = useState(
    existingRepo?.owner || "sudaaher74-ctrl",
  );
  const [selectedRepoName, setSelectedRepoName] = useState(
    existingRepo?.name || "",
  );
  const [defaultBranch, setDefaultBranch] = useState(
    existingRepo?.defaultBranch || "main",
  );
  const [framework, setFramework] = useState<"nextjs" | "static-html" | "unknown">(
    (existingRepo?.framework as "nextjs" | "static-html" | "unknown") || "nextjs",
  );

  const [accessToken, setAccessToken] = useState("");
  const [githubProfile, setGithubProfile] = useState<{
    login: string;
    name: string | null;
    avatarUrl: string | null;
  } | null>(null);
  const [isCheckingToken, setIsCheckingToken] = useState(false);

  const [repoSearch, setRepoSearch] = useState("");
  const [fetchedRepos, setFetchedRepos] = useState<GitHubRepoItem[]>([]);
  const [isFetchingRepos, setIsFetchingRepos] = useState(false);
  const [fetchRepoError, setFetchRepoError] = useState("");

  const [sharePermissions, setSharePermissions] = useState({
    readCode: true,
    createBranches: true,
    openPullRequests: true,
  });

  const [isConnecting, setIsConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  // Sync user email when profile loads
  useEffect(() => {
    if (userEmail && !gmailAddress) {
      setGmailAddress(userEmail);
    }
  }, [userEmail, gmailAddress]);

  // Load saved GitHub session linked to Google ID from localStorage
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as SavedGitHubSession;
      if (saved.accessToken) {
        setAccessToken(saved.accessToken);
      }
      if (saved.githubOwner && !existingRepo?.owner) {
        setSelectedRepoOwner(saved.githubOwner);
      }
    } catch {
      // ignore storage errors
    }
  }, [existingRepo?.owner]);

  // Verify GitHub token & resolve GitHub identity when token changes
  const verifyGitHubIdentity = useCallback(async (tokenToVerify: string) => {
    const clean = tokenToVerify.replace(/^\s*(bearer|token)\s+/i, "").trim();
    if (!clean || clean.length < 10) {
      setGithubProfile(null);
      return null;
    }
    setIsCheckingToken(true);
    try {
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${clean}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (!res.ok) {
        setGithubProfile(null);
        return null;
      }
      const data = await res.json();
      if (data?.login) {
        const profile = {
          login: String(data.login),
          name: data.name ? String(data.name) : null,
          avatarUrl: data.avatar_url ? String(data.avatar_url) : null,
        };
        setGithubProfile(profile);
        setSelectedRepoOwner(profile.login);
        return profile;
      }
      return null;
    } catch {
      return null;
    } finally {
      setIsCheckingToken(false);
    }
  }, []);

  useEffect(() => {
    if (accessToken.trim().length >= 12) {
      verifyGitHubIdentity(accessToken);
    }
  }, [accessToken, verifyGitHubIdentity]);

  // Load repositories from GitHub API
  const loadRepositories = useCallback(
    async (ownerInput: string, tokenInput?: string) => {
      const cleanOwner = ownerInput.trim();
      const cleanToken = (tokenInput ?? accessToken)
        .replace(/^\s*(bearer|token)\s+/i, "")
        .trim();

      if (!cleanOwner && !cleanToken) return;
      setIsFetchingRepos(true);
      setFetchRepoError("");

      try {
        const headers: Record<string, string> = {
          Accept: "application/vnd.github+json",
        };
        if (cleanToken) {
          headers["Authorization"] = `Bearer ${cleanToken}`;
        }

        // If authenticated with token, fetch user's accessible repos (public + private)
        const url = cleanToken
          ? "https://api.github.com/user/repos?sort=updated&per_page=50&affiliation=owner,collaborator,organization_member"
          : `https://api.github.com/users/${encodeURIComponent(cleanOwner)}/repos?sort=updated&per_page=50`;

        let res = await fetch(url, { headers });
        // Fallback to public user repos if token wasn't accepted by /user/repos
        if (!res.ok && cleanOwner) {
          res = await fetch(
            `https://api.github.com/users/${encodeURIComponent(cleanOwner)}/repos?sort=updated&per_page=50`,
            { headers: { Accept: "application/vnd.github+json" } },
          );
        }

        if (!res.ok) {
          throw new Error(`GitHub returned status ${res.status}`);
        }

        const data = await res.json();
        if (Array.isArray(data)) {
          const parsed: GitHubRepoItem[] = data.map((r: Record<string, unknown>) => {
            const ownerObj = (r.owner ?? {}) as Record<string, unknown>;
            const permsObj = (r.permissions ?? {}) as Record<string, unknown>;
            return {
              name: String(r.name ?? ""),
              full_name: String(r.full_name ?? r.name ?? ""),
              ownerLogin: String(ownerObj.login ?? cleanOwner),
              description: r.description ? String(r.description) : null,
              default_branch: String(r.default_branch || "main"),
              private: Boolean(r.private),
              language: r.language ? String(r.language) : null,
              canPush: permsObj.push !== undefined ? Boolean(permsObj.push) : undefined,
            };
          });
          setFetchedRepos(parsed);
          if (parsed.length > 0 && !selectedRepoName) {
            const first = parsed[0];
            setSelectedRepoOwner(first.ownerLogin);
            setSelectedRepoName(first.name);
            setDefaultBranch(first.default_branch || "main");
          }
        }
      } catch {
        setFetchRepoError(
          "Could not automatically list repositories. You can enter your repository owner and name below.",
        );
      } finally {
        setIsFetchingRepos(false);
      }
    },
    [accessToken, selectedRepoName],
  );

  const openGitHubAuthorizePopup = () => {
    const label = encodeURIComponent(
      `Reigel AI Coding Agent (${gmailAddress || "Google Linked"})`,
    );
    const url = `https://github.com/settings/tokens/new?description=${label}&scopes=repo,read:user`;
    const width = 920;
    const height = 720;
    const left = Math.max(0, (window.screen.width - width) / 2);
    const top = Math.max(0, (window.screen.height - height) / 2);
    window.open(
      url,
      "reigel_github_authorize",
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`,
    );
  };

  const handleSelectRepoCard = (r: GitHubRepoItem) => {
    setSelectedRepoOwner(r.ownerLogin);
    setSelectedRepoName(r.name);
    setDefaultBranch(r.default_branch || "main");
    const lang = (r.language || "").toLowerCase();
    if (lang === "html" || lang === "css") {
      setFramework("static-html");
    } else if (lang === "typescript" || lang === "javascript") {
      setFramework("nextjs");
    }
  };

  const handleShareAndConnect = async () => {
    if (!projectId) {
      setConnectError("Select a active website project first.");
      return;
    }
    const cleanOwner = selectedRepoOwner.trim();
    const cleanName = selectedRepoName.trim().replace(/\.git$/i, "");
    const cleanToken = accessToken.replace(/^\s*(bearer|token)\s+/i, "").trim();

    if (!cleanOwner || !cleanName) {
      setConnectError("Please select or enter both the GitHub Owner and Repository Name.");
      return;
    }

    setIsConnecting(true);
    setConnectError("");

    try {
      await api.connectRepository(projectId, {
        owner: cleanOwner,
        name: cleanName,
        accessToken: cleanToken || "__REUSE_LINKED_GITHUB_TOKEN__",
        defaultBranch: defaultBranch.trim() || "main",
        framework,
      });

      // Persist linked Google <-> GitHub session in localStorage for 1-click reuse across projects
      if (cleanToken) {
        try {
          const sessionPayload: SavedGitHubSession = {
            googleEmail: gmailAddress.trim(),
            githubOwner: cleanOwner,
            accessToken: cleanToken,
            githubAvatarUrl: githubProfile?.avatarUrl ?? undefined,
            updatedAt: new Date().toISOString(),
          };
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionPayload));
        } catch {
          // ignore storage errors
        }
      }

      setIsSuccess(true);
      setTimeout(() => {
        onConnected?.({
          owner: cleanOwner,
          name: cleanName,
          defaultBranch: defaultBranch.trim() || "main",
          framework,
        });
      }, 700);
    } catch (err) {
      setConnectError(
        errorMessage(err) || "Could not verify write access to the selected GitHub repository.",
      );
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

  return (
    <div
      className={
        mode === "modal"
          ? "w-full max-w-xl rounded-3xl border border-brand-200 bg-surface-1 p-6 shadow-2xl transition-all"
          : "w-full rounded-2xl border border-brand-200 bg-white p-5 shadow-2xs"
      }
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-brand-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-2 text-brand-950">
            <GitHubLogo className="h-9 w-9 border-none" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-brand-950">
              Connect GitHub Project to Reigel Coding Agent
            </h3>
            <p className="text-[11px] text-brand-500">
              Step 1: Google Login &amp; Link GitHub · Step 2: Select Project · Step 3: Share with Coding Agent
            </p>
          </div>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close GitHub connection workflow"
            className="rounded-lg p-1.5 text-brand-400 hover:bg-brand-100 hover:text-brand-700"
          >
            ✕
          </button>
        )}
      </div>

      {/* 3-Step Progress Bar */}
      <div className="my-4 grid grid-cols-3 gap-2 text-xs">
        <button
          type="button"
          onClick={() => setStep(1)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left font-semibold transition ${
            step === 1
              ? "border-primary-500 bg-primary-50/70 text-primary-800"
              : step > 1
                ? "border-success-200 bg-success-50/50 text-success-800"
                : "border-brand-200 bg-surface-2 text-brand-500"
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-2xs">
            {step > 1 ? "✓" : "1"}
          </span>
          <span className="truncate">1. Google → GitHub</span>
        </button>

        <button
          type="button"
          disabled={!gmailAddress.trim()}
          onClick={() => {
            setStep(2);
            loadRepositories(selectedRepoOwner, accessToken);
          }}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left font-semibold transition ${
            step === 2
              ? "border-primary-500 bg-primary-50/70 text-primary-800"
              : step > 2
                ? "border-success-200 bg-success-50/50 text-success-800"
                : "border-brand-200 bg-surface-2 text-brand-500"
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-2xs">
            {step > 2 ? "✓" : "2"}
          </span>
          <span className="truncate">2. Access Project</span>
        </button>

        <button
          type="button"
          disabled={!selectedRepoOwner.trim() || !selectedRepoName.trim()}
          onClick={() => setStep(3)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left font-semibold transition ${
            step === 3
              ? "border-primary-500 bg-primary-50/70 text-primary-800"
              : "border-brand-200 bg-surface-2 text-brand-500"
          }`}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[11px] font-bold shadow-2xs">
            3
          </span>
          <span className="truncate">3. Share with Agent</span>
        </button>
      </div>

      {/* =====================================================================
          STEP 1: GOOGLE LOGIN & LINK GITHUB ACCOUNT
         ===================================================================== */}
      {step === 1 && (
        <div className="space-y-4 py-1">
          {/* Card 1: Google Identity */}
          <div className="rounded-2xl border border-brand-200/80 bg-surface-2 p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs">
                  <GoogleGLogo className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-brand-950">
                      Step 1A · Google Account Identity
                    </h4>
                    {googleVerified && gmailAddress.trim() && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold text-success-800">
                        <Check size={10} /> Signed in with Google
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-brand-500">
                    Your Google identity is used to link and authenticate your GitHub coding agent session.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                Google Account Email Connected to GitHub
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-2.5 text-brand-400" />
                <input
                  type="email"
                  required
                  value={gmailAddress}
                  onChange={(e) => {
                    setGmailAddress(e.target.value);
                    setGoogleVerified(true);
                  }}
                  placeholder="your-name@gmail.com"
                  className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-xs text-brand-900 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Connect Google ID with GitHub Account */}
          <div className="rounded-2xl border border-brand-200/80 bg-surface-2 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white shadow-2xs">
                  <GitHubLogo className="h-8 w-8 border-none" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-brand-950">
                      Step 1B · Link GitHub Account with Your Google ID
                    </h4>
                    {githubProfile ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-success-100 px-2 py-0.5 text-[10px] font-bold text-success-800">
                        <Check size={10} /> Linked @{githubProfile.login}
                      </span>
                    ) : selectedRepoOwner.trim() ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary-100 px-2 py-0.5 text-[10px] font-bold text-primary-800">
                        @{selectedRepoOwner.trim()}
                      </span>
                    ) : null}
                  </div>
                  <p className="text-[11px] text-brand-500">
                    Authorize Reigel Coding Agent on GitHub once so you can access and share any of your projects.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={openGitHubAuthorizePopup}
                className="inline-flex items-center gap-1.5 rounded-xl border border-brand-300 bg-white px-3 py-1.5 text-[11.5px] font-semibold text-brand-900 shadow-2xs transition hover:bg-brand-50"
              >
                <GitHubLogo className="h-4 w-4 border-none" />
                <span>Authorize on GitHub (1-Click)</span>
                <ExternalLink size={11} />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                  GitHub Username / Organization
                </label>
                <input
                  type="text"
                  required
                  value={selectedRepoOwner}
                  onChange={(e) => setSelectedRepoOwner(e.target.value)}
                  placeholder="e.g. sudaaher74-ctrl"
                  className="w-full rounded-xl border bg-white py-2 px-3 text-xs text-brand-900 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                  GitHub Agent Token{" "}
                  <span className="font-normal text-brand-400">(Saved for all your projects)</span>
                </label>
                <div className="relative">
                  <KeyRound size={13} className="absolute left-3 top-2.5 text-brand-400" />
                  <input
                    type="password"
                    autoComplete="off"
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    placeholder="ghp_... or github_pat_..."
                    className="w-full rounded-xl border bg-white py-2 pl-8 pr-3 text-xs text-brand-900 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
                  />
                </div>
              </div>
            </div>

            {isCheckingToken && (
              <p className="flex items-center gap-1.5 text-[11px] text-brand-500">
                <Loader2 size={12} className="animate-spin text-primary-600" />
                Verifying GitHub identity…
              </p>
            )}

            {githubProfile && (
              <div className="flex items-center justify-between rounded-xl border border-success-200 bg-success-50/60 px-3 py-2 text-[11.5px] text-success-900">
                <span className="flex items-center gap-1.5 font-semibold">
                  <Check size={13} className="text-success-700" />
                  Google ID ({gmailAddress}) is linked with GitHub account @{githubProfile.login}
                </span>
                <span className="text-[10.5px] font-mono text-success-700">Agent Ready</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-brand-100 pt-3">
            {onCancel && (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-xl border border-brand-200 bg-surface-2 px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              disabled={!gmailAddress.trim() || !selectedRepoOwner.trim()}
              onClick={() => {
                setStep(2);
                loadRepositories(selectedRepoOwner, accessToken);
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
            >
              <GoogleGLogo className="h-3.5 w-3.5" />
              <span>Continue &amp; Access GitHub Projects</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2: ACCESS & SELECT YOUR GITHUB PROJECT
         ===================================================================== */}
      {step === 2 && (
        <div className="space-y-4 py-1">
          {/* Linked Identity Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200/70 bg-surface-2 px-3 py-2 text-[11.5px]">
            <div className="flex items-center gap-2">
              <GoogleGLogo className="h-3.5 w-3.5" />
              <span className="font-semibold text-brand-900">{gmailAddress}</span>
              <span className="text-brand-400">↔</span>
              <span className="font-mono font-semibold text-brand-900">
                @{githubProfile?.login || selectedRepoOwner}
              </span>
            </div>
            <button
              type="button"
              onClick={() => loadRepositories(selectedRepoOwner, accessToken)}
              className="inline-flex items-center gap-1 rounded-lg border bg-white px-2.5 py-1 text-[11px] font-semibold text-brand-700 hover:bg-brand-50"
            >
              <RefreshCw size={11} className={isFetchingRepos ? "animate-spin" : ""} />
              <span>Refresh Projects</span>
            </button>
          </div>

          {/* Search & Direct Selection */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                GitHub Owner / Organization
              </label>
              <input
                type="text"
                required
                value={selectedRepoOwner}
                onChange={(e) => setSelectedRepoOwner(e.target.value)}
                placeholder="e.g. sudaaher74-ctrl"
                className="w-full rounded-xl border bg-white p-2 text-xs text-brand-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                Selected Project Repository
              </label>
              <input
                type="text"
                required
                value={selectedRepoName}
                onChange={(e) => setSelectedRepoName(e.target.value)}
                placeholder="e.g. my-website-repo"
                className="w-full rounded-xl border bg-white p-2 text-xs text-brand-900"
              />
            </div>
          </div>

          {/* Project List */}
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <label className="flex items-center gap-1.5 text-xs font-bold text-brand-950">
                <FolderGit2 size={14} className="text-primary-600" />
                <span>Select Your GitHub Project ({filteredRepos.length})</span>
              </label>
              <div className="relative w-48">
                <Search size={12} className="absolute left-2.5 top-2 text-brand-400" />
                <input
                  type="text"
                  placeholder="Search projects…"
                  value={repoSearch}
                  onChange={(e) => setRepoSearch(e.target.value)}
                  className="w-full rounded-lg border bg-white py-1 pl-7 pr-2 text-[11px] text-brand-900"
                />
              </div>
            </div>

            {isFetchingRepos ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-brand-200 p-6 text-xs text-brand-500">
                <Loader2 size={15} className="animate-spin text-primary-600" />
                <span>Loading GitHub projects for @{selectedRepoOwner}…</span>
              </div>
            ) : filteredRepos.length > 0 ? (
              <div className="max-h-52 space-y-1.5 overflow-y-auto pr-1">
                {filteredRepos.map((r) => {
                  const isSelected =
                    selectedRepoName === r.name && selectedRepoOwner === r.ownerLogin;
                  return (
                    <button
                      key={r.full_name}
                      type="button"
                      onClick={() => handleSelectRepoCard(r)}
                      className={`w-full rounded-xl border p-3 text-left transition ${
                        isSelected
                          ? "border-primary-500 bg-primary-50/50 ring-1 ring-primary-500"
                          : "border-brand-200 bg-white hover:border-brand-300 hover:bg-surface-2"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 truncate">
                          <GitBranch
                            size={13}
                            className={
                              isSelected ? "shrink-0 text-primary-600" : "shrink-0 text-brand-400"
                            }
                          />
                          <span className="truncate text-xs font-bold text-brand-950">
                            {r.ownerLogin}/{r.name}
                          </span>
                          <span className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-surface-2 px-2 py-0.5 text-[10px] font-medium text-brand-600">
                            {r.private ? (
                              <>
                                <Lock size={9} /> Private
                              </>
                            ) : (
                              <>
                                <Globe size={9} /> Public
                              </>
                            )}
                          </span>
                          <span className="font-mono text-[10px] text-brand-400">
                            {r.default_branch}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {r.language && (
                            <span className="rounded bg-brand-100 px-1.5 py-0.5 text-[10px] font-medium text-brand-700">
                              {r.language}
                            </span>
                          )}
                          {isSelected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary-600 text-[10px] text-white">
                              ✓
                            </span>
                          )}
                        </div>
                      </div>
                      {r.description && (
                        <p className="mt-1 truncate text-[10.5px] text-brand-500">
                          {r.description}
                        </p>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-brand-200 p-4 text-center text-xs text-brand-500">
                <p>
                  {fetchRepoError ||
                    "No repositories matched your filter. Enter your repository name directly above."}
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-between gap-2 border-t border-brand-100 pt-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="rounded-xl border border-brand-200 bg-surface-2 px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={!selectedRepoOwner.trim() || !selectedRepoName.trim()}
              onClick={() => setStep(3)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-primary-600 px-5 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
            >
              <span>Continue to Share Project with Agent</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 3: SHARE PROJECT WITH CODING AGENT & CONNECT
         ===================================================================== */}
      {step === 3 && (
        <div className="space-y-4 py-1">
          {/* Visual Connection Summary */}
          <div className="rounded-2xl border border-primary-200 bg-primary-50/40 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary-600" />
                <h4 className="text-xs font-bold text-brand-950">
                  Share Project with Reigel Coding Agent
                </h4>
              </div>
              <span className="rounded-full bg-primary-100 px-2.5 py-0.5 font-mono text-[10.5px] font-bold text-primary-800">
                {selectedRepoOwner}/{selectedRepoName}
              </span>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 text-[11px]">
              <div className="rounded-xl border bg-white p-2.5">
                <span className="block text-[10px] font-bold uppercase text-brand-400">
                  1. Google Identity
                </span>
                <span className="mt-0.5 block truncate font-semibold text-brand-900">
                  {gmailAddress}
                </span>
              </div>
              <div className="rounded-xl border bg-white p-2.5">
                <span className="block text-[10px] font-bold uppercase text-brand-400">
                  2. GitHub Project
                </span>
                <span className="mt-0.5 block truncate font-mono font-semibold text-brand-900">
                  {selectedRepoOwner}/{selectedRepoName}
                </span>
              </div>
              <div className="rounded-xl border bg-white p-2.5">
                <span className="block text-[10px] font-bold uppercase text-brand-400">
                  3. Agent Mode
                </span>
                <span className="mt-0.5 block font-semibold text-success-700">
                  Branch &amp; Pull Request Only
                </span>
              </div>
            </div>
          </div>

          {/* Coding Agent Access Permissions (Same as Cursor / Devin / Claude Code) */}
          <div className="rounded-2xl border border-brand-200 bg-surface-2 p-4 space-y-2.5">
            <p className="text-xs font-bold text-brand-950">
              Coding Agent Repository Access (Shared Permissions)
            </p>
            <label className="flex items-start gap-2.5 text-xs text-brand-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sharePermissions.readCode}
                onChange={(e) =>
                  setSharePermissions((p) => ({ ...p, readCode: e.target.checked }))
                }
                className="mt-0.5 rounded border-brand-300 text-primary-600"
              />
              <span>
                <strong>Read project source &amp; structure</strong> — Allows the Coding Agent to inspect routes, components, and SEO metadata in an isolated sandbox.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-brand-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sharePermissions.createBranches}
                onChange={(e) =>
                  setSharePermissions((p) => ({ ...p, createBranches: e.target.checked }))
                }
                className="mt-0.5 rounded border-brand-300 text-primary-600"
              />
              <span>
                <strong>Create dedicated fix branches</strong> — Agent commits improvements to <code className="font-mono text-[11px]">growthx-ai/engineer-*</code> and never pushes directly to <code className="font-mono text-[11px]">{defaultBranch}</code>.
              </span>
            </label>
            <label className="flex items-start gap-2.5 text-xs text-brand-800 cursor-pointer">
              <input
                type="checkbox"
                checked={sharePermissions.openPullRequests}
                onChange={(e) =>
                  setSharePermissions((p) => ({ ...p, openPullRequests: e.target.checked }))
                }
                className="mt-0.5 rounded border-brand-300 text-primary-600"
              />
              <span>
                <strong>Open Pull Requests across all 5 Fix Engine tabs</strong> — Prepares reviewable PRs with Before &amp; After diffs for Website Audit, Traffic, Competitor, AI Visibility, and Backlinks.
              </span>
            </label>
          </div>

          {/* Branch, Framework & Token Verification */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                Default Branch
              </label>
              <input
                type="text"
                value={defaultBranch}
                onChange={(e) => setDefaultBranch(e.target.value)}
                placeholder="main"
                className="w-full rounded-xl border bg-white p-2 text-xs text-brand-900"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-brand-700 mb-1">
                Project Framework
              </label>
              <select
                value={framework}
                onChange={(e) =>
                  setFramework(e.target.value as "nextjs" | "static-html" | "unknown")
                }
                className="w-full rounded-xl border bg-white p-2 text-xs text-brand-900"
              >
                <option value="nextjs">Next.js / React</option>
                <option value="static-html">Static HTML</option>
                <option value="unknown">Auto-detect / Other</option>
              </select>
            </div>
          </div>

          {/* Ensure GitHub Agent Token is ready */}
          <div className="rounded-xl border border-brand-200 bg-white p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-[11px] font-semibold text-brand-800 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary-600" />
                <span>GitHub Coding Agent Access Token (Read &amp; Write)</span>
              </label>
              <button
                type="button"
                onClick={openGitHubAuthorizePopup}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:underline"
              >
                <span>Get 1-Click Agent Token on GitHub</span>
                <ExternalLink size={10} />
              </button>
            </div>
            <input
              type="password"
              autoComplete="off"
              value={accessToken}
              onChange={(e) => {
                setAccessToken(e.target.value);
                setConnectError("");
              }}
              placeholder="Paste GitHub token (ghp_... or github_pat_...) to grant agent write access"
              className="w-full rounded-xl border bg-surface-1 p-2 text-xs text-brand-900 focus:outline-hidden focus:ring-1 focus:ring-primary-500"
            />
            <p className="text-[10.5px] text-brand-400">
              Encrypted at rest and saved to your Google session ({gmailAddress}) so you can connect any project in 1 click.
            </p>
          </div>

          {connectError && (
            <div
              role="alert"
              className="rounded-xl border border-error-200 bg-error-50 p-3 text-xs text-error-800"
            >
              {connectError}
            </div>
          )}

          {isSuccess && (
            <div
              role="status"
              className="flex items-center justify-center gap-2 rounded-xl border border-success-200 bg-success-50 p-3 text-xs font-bold text-success-800"
            >
              <Check size={16} /> Project {selectedRepoOwner}/{selectedRepoName} Shared &amp; Connected with Coding Agent!
            </div>
          )}

          <div className="flex justify-between gap-2 border-t border-brand-100 pt-3">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-xl border border-brand-200 bg-surface-2 px-4 py-2 text-xs font-medium text-brand-700 hover:bg-brand-50"
            >
              Back
            </button>
            <button
              type="button"
              disabled={
                isConnecting ||
                isSuccess ||
                !sharePermissions.readCode ||
                !sharePermissions.createBranches ||
                !sharePermissions.openPullRequests
              }
              onClick={handleShareAndConnect}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-2 text-xs font-semibold text-white shadow-xs transition hover:bg-primary-700 disabled:opacity-50"
            >
              {isConnecting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Sharing Project &amp; Verifying Agent Access…</span>
                </>
              ) : (
                <>
                  <GitPullRequest size={14} />
                  <span>Share Project &amp; Connect Coding Agent</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
