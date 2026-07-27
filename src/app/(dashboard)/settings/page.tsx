"use client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { User, Shield, Bell, Key, Globe, Users, Palette, ChevronRight, CheckCircle2 } from "lucide-react";
import { useState } from "react";

const tabs = [
  { id: "workspace", label: "Workspace", icon: Globe },
  { id: "profile", label: "Profile", icon: User },
  { id: "team", label: "Team", icon: Users },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "security", label: "Security & 2FA", icon: Shield },
  { id: "api", label: "API Keys", icon: Key },
  { id: "appearance", label: "Appearance", icon: Palette },
];

const teamMembers = [
  { name: "Sudarshan", email: "sudarshan@growthx.in", role: "Agency Owner", avatar: "S", status: "active" },
  { name: "Priya Sharma", email: "priya@growthx.in", role: "SEO Manager", avatar: "P", status: "active" },
  { name: "Rahul Dev", email: "rahul@client.com", role: "Client", avatar: "R", status: "active" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("workspace");
  const [saved, setSaved] = useState(false);

  const save = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

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
              <h3 className="text-sm font-semibold text-[var(--text-primary)]">Workspace Settings</h3>
              {[
                { label: "Workspace Name", value: "GrowthX Agency" },
                { label: "Primary Domain", value: "milquu.com" },
                { label: "Industry", value: "Food & Dairy" },
                { label: "Target Location", value: "Navi Mumbai, Maharashtra, India" },
              ].map(({ label, value }) => (
                <div key={label}>
                  <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-1.5">{label}</label>
                  <input defaultValue={value} className="w-full text-sm bg-[var(--surface-2)] border border-[var(--border-color)] rounded-lg px-3 py-2.5 text-[var(--text-primary)] focus:outline-none focus:border-indigo-500"/>
                </div>
              ))}
              <div>
                <label className="text-xs font-semibold text-[var(--text-muted)] uppercase tracking-wide block mb-2">Connected Integrations</label>
                <div className="space-y-2">
                  {[
                    { name: "Google Search Console", connected: true },
                    { name: "Google Analytics 4", connected: true },
                    { name: "Google Business Profile", connected: false },
                    { name: "Slack Notifications", connected: false },
                  ].map(({ name, connected }) => (
                    <div key={name} className="flex items-center justify-between p-3 rounded-lg border border-[var(--border-color)]">
                      <span className="text-sm text-[var(--text-primary)]">{name}</span>
                      <div className="flex items-center gap-2">
                        <Badge variant={connected ? "success" : "default"}>{connected ? "Connected" : "Not Connected"}</Badge>
                        <Button variant="ghost" size="sm">{connected ? "Disconnect" : "Connect"}</Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <Button variant="primary" onClick={save} icon={saved ? <CheckCircle2 size={13}/> : undefined}>
                {saved ? "Saved!" : "Save Settings"}
              </Button>
            </div>
          )}

          {activeTab === "team" && (
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-color)]">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">Team Members</h3>
                <Button variant="primary" size="sm">Invite Member</Button>
              </div>
              <div className="divide-y divide-[var(--border-color)]">
                {teamMembers.map(member => (
                  <div key={member.email} className="flex items-center gap-4 px-5 py-3">
                    <div className="w-9 h-9 rounded-full gradient-bg-brand flex items-center justify-center text-white font-bold shrink-0">
                      {member.avatar}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{member.name}</div>
                      <div className="text-xs text-[var(--text-muted)]">{member.email}</div>
                    </div>
                    <Badge variant="info">{member.role}</Badge>
                    <Button variant="ghost" size="sm">Edit</Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab !== "workspace" && activeTab !== "team" && (
            <div className="card p-6 flex flex-col items-center justify-center py-16 text-center">
              <div className="text-4xl mb-3">⚙️</div>
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">{tabs.find(t => t.id === activeTab)?.label} Settings</h3>
              <p className="text-sm text-[var(--text-muted)]">Configure your {tabs.find(t => t.id === activeTab)?.label.toLowerCase()} preferences here.</p>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
