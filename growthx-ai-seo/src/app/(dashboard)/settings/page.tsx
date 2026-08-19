"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { User, Shield, Bell, Key, Globe, Users, Palette, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useAddMember, useMembers, useRemoveMember, useUpdateMemberRole, useWorkspace, useProfile } from "@/hooks/use-growthx";
import { ApiError, type Role } from "@/lib/api-client";

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

  if (profile.isLoading) {
    return <div className="card p-6 text-sm text-[var(--text-muted)]">Loading profile...</div>;
  }

  if (profile.error) {
    return <div className="card p-6 text-sm text-red-500">Failed to load profile.</div>;
  }

  const user = profile.data;

  return (
    <div className="card p-6 space-y-4">
      <h3 className="text-sm font-semibold text-[var(--text-primary)]">Profile</h3>
      
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

        {user?.googleId && (
          <div>
            <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Google ID</label>
            <input 
              value={user.googleId} 
              disabled readOnly 
              className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] opacity-70"
            />
          </div>
        )}

        <div>
          <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">Business Details</label>
          <textarea 
            value={user?.businessDetails ?? 'No business details provided.'} 
            disabled readOnly 
            className="w-full min-h-[100px] text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] opacity-70"
          />
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
