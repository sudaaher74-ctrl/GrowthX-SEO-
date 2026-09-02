"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { User, Shield, Bell, Key, Globe, Users, Palette, Loader2, Trash2, LogOut } from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useAddMember, useMembers, useRemoveMember, useUpdateMemberRole, useWorkspace, useProfile } from "@/hooks/use-growthx";
import { api, ApiError, type Role } from "@/lib/api-client";

const tabs = [
  { id: "workspace", label: "Workspace", icon: Globe },
  { id: "profile", label: "Profile", icon: User },
  { id: "team", label: "Team", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & 2FA", icon: Shield },
  { id: "api", label: "API Keys", icon: Key },
  { id: "appearance", label: "Appearance", icon: Palette },
];

const ROLE_OPTIONS: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("workspace");
  const { orgId, organizations } = useWorkspace();
  const activeOrg = organizations.find((o) => o.id === orgId);

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-h1 text-[var(--text-primary)]">Settings</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">Manage workspace, team, integrations, and security</p>
      </motion.div>

      <div className="grid xl:grid-cols-4 gap-6">
        {/* Sidebar */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="card p-2 h-fit">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              className={cn("sidebar-item w-full", activeTab === tab.id && "active")}>
              <tab.icon size={15}/>
              {tab.label}
            </button>
          ))}
        </motion.div>

        {/* Content */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="xl:col-span-3 space-y-4">
          {activeTab === "workspace" && (
            <div className="card p-6 space-y-4">
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Workspace</h3>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Workspace name</label>
                <input value={activeOrg?.name ?? ""} disabled readOnly className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] opacity-70"/>
                <p className="mt-1 text-xs text-[var(--text-muted)]">Renaming a workspace isn&apos;t available yet.</p>
              </div>
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Integrations</label>
                <div className="space-y-2">
                  {["Google Search Console", "Google Analytics 4", "Google Business Profile", "Slack Notifications"].map((name) => (
                    <div key={name} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)]">
                      <span className="text-sm text-[var(--text-primary)]">{name}</span>
                      <Badge variant="default">Not available yet</Badge>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === "team" && <TeamTab orgId={orgId} />}
          {activeTab === "profile" && <ProfileTab />}

          {activeTab !== "workspace" && activeTab !== "team" && activeTab !== "profile" && (
            <div className="card p-6 flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{tabs.find(t => t.id === activeTab)?.label} isn&apos;t built yet</h3>
              <p className="text-sm text-[var(--text-muted)]">This section doesn&apos;t have a backend to read or write against yet.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function ProfileTab() {
  const profile = useProfile();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await api.logout();
      queryClient.clear();
      router.replace("/login");
    } finally {
      setLoggingOut(false);
    }
  }

  if (profile.isLoading) {
    return <div className="card p-6 text-sm text-[var(--text-muted)]">Loading profile...</div>;
  }

  if (profile.error) {
    return <div className="card p-6 text-sm text-red-500">Failed to load profile.</div>;
  }

  const user = profile.data;

  return (
    <div className="space-y-4">
      <div className="card p-6 space-y-4">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">User Profile</h3>
        
        <div className="grid gap-4">
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Name</label>
            <input 
              value={`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || '—'} 
              disabled readOnly 
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] opacity-70"
            />
          </div>
          
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Email</label>
            <input 
              value={user?.email ?? '—'} 
              disabled readOnly 
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] opacity-70"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Authentication Method</label>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-color)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text-primary)]">
                {user?.googleId ? (
                  <>
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24">
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
                    Google OAuth
                  </>
                ) : (
                  <>Email &amp; Password</>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="card p-6 border-red-100 bg-red-50/20 space-y-3">
        <h3 className="text-sm font-semibold text-brand-950">Session Management</h3>
        <p className="text-xs text-[var(--text-muted)]">
          Sign out of your active GrowthX session on this device. You will be redirected to the sign-in screen.
        </p>
        <div>
          <Button
            type="button"
            variant="secondary"
            onClick={handleLogout}
            disabled={loggingOut}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200"
          >
            {loggingOut ? <Loader2 size={14} className="animate-spin mr-2" /> : <LogOut size={14} className="mr-2 text-red-500" />}
            Sign out of GrowthX
          </Button>
        </div>
      </div>
    </div>
  );
}

function TeamTab({ orgId }: { orgId: string | null }) {
  const members = useMembers(orgId);
  const addMember = useAddMember(orgId);
  const updateRole = useUpdateMemberRole(orgId);
  const removeMember = useRemoveMember(orgId);

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("MEMBER");
  const [error, setError] = useState("");

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setError("");
    try {
      await addMember.mutateAsync({ email: email.trim(), role });
      setEmail("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to add member");
    }
  }

  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--border-color)] space-y-3">
        <h3 className="text-sm font-semibold text-[var(--text-primary)]">Team members</h3>
        <form onSubmit={handleInvite} className="flex flex-wrap gap-2">
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@yourbusiness.in"
            className="flex-1 min-w-[200px] text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2 text-[var(--text-primary)] focus:outline-none focus:border-purple-500"
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-2.5 py-2 text-[var(--text-primary)]"
          >
            {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <Button type="submit" variant="primary" size="sm" disabled={addMember.isPending || !email.trim()}>
            {addMember.isPending ? <Loader2 size={13} className="animate-spin" /> : "Add member"}
          </Button>
        </form>
        {error && <p className="text-xs text-red-500">{error}</p>}
        <p className="text-xs text-[var(--text-muted)]">
          They need a GrowthX AI account already — this attaches an existing account to your workspace, it doesn&apos;t email an invite.
        </p>
      </div>

      {members.isLoading ? (
        <div className="p-5 text-sm text-[var(--text-muted)]">Loading…</div>
      ) : !members.data?.length ? (
        <div className="p-5 text-sm text-[var(--text-muted)]">No members yet.</div>
      ) : (
        <div className="divide-y divide-[var(--border-color)]">
          {members.data.map((member) => {
            const label = [member.firstName, member.lastName].filter(Boolean).join(" ") || member.email;
            const initial = label.charAt(0).toUpperCase();
            return (
              <div key={member.id} className="flex items-center gap-4 px-5 py-3">
                <div className="w-9 h-9 rounded-full gradient-bg-brand flex items-center justify-center text-white font-bold shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{label}</div>
                  <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                </div>
                <select
                  value={member.role}
                  onChange={(e) => updateRole.mutate({ memberId: member.id, role: e.target.value as Role })}
                  disabled={updateRole.isPending}
                  className="text-xs bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-2 py-1.5 text-[var(--text-primary)]"
                >
                  {ROLE_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
                <button
                  onClick={() => removeMember.mutate(member.id)}
                  disabled={removeMember.isPending}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:bg-red-500/10 hover:text-red-500 transition-base"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      {(updateRole.error || removeMember.error) && (
        <p className="px-5 pb-4 text-xs text-red-500">
          {updateRole.error instanceof ApiError ? updateRole.error.message : removeMember.error instanceof ApiError ? removeMember.error.message : "Something went wrong."}
        </p>
      )}
    </div>
  );
}
