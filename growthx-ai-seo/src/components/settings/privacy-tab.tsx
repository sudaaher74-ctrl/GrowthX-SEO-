"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Trash2, ExternalLink, AlertTriangle, Loader2, CheckCircle2 } from "lucide-react";
import { useWorkspace, useProfile } from "@/hooks/use-growthx";
import { api, ApiError } from "@/lib/api-client";

export function PrivacyTab() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { orgId, projectId, projects } = useWorkspace();
  const profile = useProfile();

  const currentProject = projects.find((p) => p.id === projectId);

  // Delete project state
  const [deleteProjectConfirm, setDeleteProjectConfirm] = useState("");
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);

  // Delete account state
  const [deleteAccountConfirm, setDeleteAccountConfirm] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [accountError, setAccountError] = useState<string | null>(null);

  async function handleDeleteProject() {
    if (!projectId || deleteProjectConfirm !== "DELETE") return;
    setDeletingProject(true);
    setProjectError(null);
    try {
      await api.deleteProject(projectId);
      queryClient.clear();
      window.location.href = "/dashboard";
    } catch (err) {
      setProjectError(err instanceof ApiError ? err.message : "Failed to delete project.");
      setDeletingProject(false);
    }
  }

  async function handleDeleteAccount() {
    if (deleteAccountConfirm !== "DELETE MY ACCOUNT") return;
    setDeletingAccount(true);
    setAccountError(null);
    try {
      await api.deleteAccount();
      queryClient.clear();
      router.replace("/login");
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Failed to delete account.");
      setDeletingAccount(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Privacy & Data Overview */}
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Shield size={16} className="text-series-6" />
          <h3>Privacy &amp; Data Rights</h3>
        </div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Reigel processes search engine optimization data, customer website crawl results, and optional connected Google service metrics under strict tenant isolation. In accordance with global privacy principles and India DPDP readiness, you have complete authority to inspect, disconnect, and erase your data.
        </p>

        <div className="grid sm:grid-cols-2 gap-3 pt-2">
          <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]">
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">Account Data</div>
            <div className="text-xs text-[var(--text-muted)]">
              {profile.data?.email ?? "Signed in"}
            </div>
            <div className="mt-2 text-[11px] text-[var(--text-muted)]">
              Password encrypted via bcrypt. Auth credentials held in HttpOnly cookies.
            </div>
          </div>

          <div className="p-3 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)]">
            <div className="text-xs font-semibold text-[var(--text-primary)] mb-1">Connected Integrations</div>
            <div className="text-xs text-[var(--text-muted)]">
              Search Console, GA4, Business Profile
            </div>
            <div className="mt-2">
              <Link
                href="/integrations"
                className="inline-flex items-center gap-1 text-[11px] text-series-6 hover:underline"
              >
                Manage &amp; Disconnect Integrations <ExternalLink size={10} />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Legal Documentation Links */}
      <div className="card p-6 space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Legal &amp; Compliance Policies</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Read our actual technical architectures, privacy terms, and security assurances.
        </p>
        <div className="flex flex-wrap gap-4 pt-1">
          <Link
            href="/legal/privacy"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-series-6 hover:underline"
          >
            Privacy Policy <ExternalLink size={11} />
          </Link>
          <Link
            href="/legal/terms"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-series-6 hover:underline"
          >
            Terms of Service <ExternalLink size={11} />
          </Link>
          <Link
            href="/legal/security"
            target="_blank"
            className="inline-flex items-center gap-1 text-xs text-series-6 hover:underline"
          >
            Security Architecture <ExternalLink size={11} />
          </Link>
        </div>
      </div>

      {/* 3. Delete Current Project */}
      {currentProject && (
        <div className="card p-6 border-warning/30 bg-warning/5 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle size={16} />
            <h4>Delete Project: {currentProject.name}</h4>
          </div>
          <p className="text-xs text-[var(--text-muted)] leading-relaxed">
            Deleting this project permanently removes its crawl history, technical SEO issues, competitor snapshots, and revokes any associated Google OAuth grants. Active background crawl jobs are immediately cancelled.
          </p>
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
              Type <span className="text-warning font-mono">DELETE</span> to confirm:
            </label>
            <div className="flex gap-2 max-w-sm">
              <input
                type="text"
                value={deleteProjectConfirm}
                onChange={(e) => setDeleteProjectConfirm(e.target.value)}
                placeholder="DELETE"
                className="text-xs bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none w-36 font-mono"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleDeleteProject}
                disabled={deleteProjectConfirm !== "DELETE" || deletingProject}
                className="text-warning border-warning/30 hover:bg-warning/10"
              >
                {deletingProject ? <Loader2 size={12} className="animate-spin mr-1" /> : <Trash2 size={12} className="mr-1" />}
                Delete Project
              </Button>
            </div>
            {projectError && <p className="text-xs text-error">{projectError}</p>}
          </div>
        </div>
      )}

      {/* 4. Delete Account */}
      <div className="card p-6 border-error/30 bg-error/5 space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-error">
          <AlertTriangle size={16} />
          <h4>Delete Account (Right to Erasure)</h4>
        </div>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed">
          Permanently delete your user account. If you are the sole member of your workspace, all associated projects, crawl reports, and Google integrations are revoked and deleted. If other members belong to your workspace, your personal membership and login credentials will be severed while preserving shared agency work.
        </p>

        <div className="space-y-2">
          <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wide block">
            Type <span className="text-error font-mono">DELETE MY ACCOUNT</span> to confirm:
          </label>
          <div className="flex flex-wrap gap-2 max-w-md">
            <input
              type="text"
              value={deleteAccountConfirm}
              onChange={(e) => setDeleteAccountConfirm(e.target.value)}
              placeholder="DELETE MY ACCOUNT"
              className="text-xs bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none flex-1 font-mono"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleteAccountConfirm !== "DELETE MY ACCOUNT" || deletingAccount}
              className="text-error border-error/30 hover:bg-error/10"
            >
              {deletingAccount ? <Loader2 size={12} className="animate-spin mr-1" /> : <Trash2 size={12} className="mr-1" />}
              Erase My Account
            </Button>
          </div>
          {accountError && <p className="text-xs text-error">{accountError}</p>}
        </div>
      </div>
    </div>
  );
}
