"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, LogOut, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type { AdminUserItem } from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  FilterChipGroup,
} from "./admin-primitives";

type UserFilter = "all" | "online" | "offline" | "operators" | "unverified";

interface UsersSectionProps {
  users: AdminUserItem[];
  onlineTotal: number;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

export function UsersSection({ users, onlineTotal, loading, onRefresh }: UsersSectionProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [revokeTarget, setRevokeTarget] = useState<AdminUserItem | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad"; text: string } | null>(null);

  const counts = useMemo(() => {
    let online = 0;
    let operators = 0;
    let unverified = 0;
    for (const u of users) {
      if (u.isLoggedIn) online++;
      if (u.isPlatformAdmin) operators++;
      if (u.emailVerified === false) unverified++;
    }
    return {
      all: users.length,
      online: Math.max(online, onlineTotal),
      offline: Math.max(0, users.length - online),
      operators,
      unverified,
    };
  }, [users, onlineTotal]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "online" && !u.isLoggedIn) return false;
      if (filter === "offline" && u.isLoggedIn) return false;
      if (filter === "operators" && !u.isPlatformAdmin) return false;
      if (filter === "unverified" && u.emailVerified !== false) return false;
      if (!q) return true;
      const models = (u.modelsUsed || []).join(" ").toLowerCase();
      return (
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.organizationName.toLowerCase().includes(q) ||
        models.includes(q)
      );
    });
  }, [users, search, filter]);

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setRevoking(true);
    setFeedback(null);
    try {
      const res = await api.revokeAdminUserSessions(revokeTarget.id);
      setFeedback({
        tone: "good",
        text: `Signed out ${revokeTarget.email} (${res.revokedSessions} active session${res.revokedSessions === 1 ? "" : "s"} revoked).`,
      });
      setRevokeTarget(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: `Could not revoke sessions: ${errorMessage(err)}` });
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      <Panel
        title="Platform Users & Access"
        subtitle="Account directory with live session presence, email verification, auth method, and session revocation."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <FilterChipGroup<UserFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "All", count: counts.all },
                { id: "online", label: "Online", count: counts.online, dot: "good" },
                { id: "offline", label: "Offline", count: counts.offline },
                { id: "operators", label: "Operators", count: counts.operators },
                { id: "unverified", label: "Unverified", count: counts.unverified },
              ]}
            />
            <AdminSearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search user, email, org, or model…"
            />
          </div>
        }
      >
        {loading && users.length === 0 ? (
          <AdminSkeletonRows rows={6} cols={7} />
        ) : (
          <AdminTableWrap label="Platform users" minWidth={960}>
            <AdminThead>
              <tr>
                <Th>User</Th>
                <Th>Verification & Auth</Th>
                <Th>Organization / Role</Th>
                <Th>Session State</Th>
                <Th>Last Login</Th>
                <Th>AI Models Used</Th>
                <Th align="right">Action</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-2 font-mono text-[11px] font-bold text-brand-700 border border-brand-200">
                            {u.name.slice(0, 2).toUpperCase()}
                          </span>
                          {u.isLoggedIn && (
                            <span
                              title="Currently signed in"
                              className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-success-500 ring-2 ring-surface-1"
                            />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="truncate text-[13px] font-semibold text-brand-950">{u.name}</span>
                            {u.isPlatformAdmin && (
                              <span
                                title="Verified platform operator"
                                className="inline-flex items-center gap-0.5 rounded-md bg-signal-400/20 px-1.5 py-0.5 font-mono text-[9.5px] font-bold uppercase text-brand-950 border border-signal-400/40"
                              >
                                <ShieldCheck size={10} />
                                Op
                              </span>
                            )}
                          </div>
                          <span className="block truncate font-mono text-[11px] text-brand-400">
                            {u.email}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {u.emailVerified ? (
                          <Pill tone="good">
                            <CheckCircle2 size={10} /> Verified
                          </Pill>
                        ) : (
                          <Pill tone="warn">Unverified</Pill>
                        )}
                        {u.authProvider && (
                          <Pill tone="default">
                            {u.authProvider === "both"
                              ? "Google + Pass"
                              : u.authProvider === "google"
                                ? "Google"
                                : "Password"}
                          </Pill>
                        )}
                        {u.platformAdminRevoked && (
                          <Pill tone="bad">
                            <ShieldOff size={10} /> Revoked
                          </Pill>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <span className="text-[12.5px] font-medium text-brand-900">{u.organizationName}</span>
                        <Pill tone={u.role === "OWNER" ? "good" : u.role === "ADMIN" ? "info" : "default"}>
                          {u.role}
                        </Pill>
                      </div>
                      <span className="block text-[10.5px] text-brand-400">
                        Joined {relativeTime(u.createdAt)}
                        {(u.membershipsCount ?? 1) > 1 ? ` · ${u.membershipsCount} orgs` : ""}
                      </span>
                    </Td>
                    <Td>
                      {u.isLoggedIn ? (
                        <div className="flex items-center gap-1.5">
                          <Pill tone="good" dot>
                            ONLINE
                          </Pill>
                          {(u.activeSessionsCount ?? 0) > 1 && (
                            <span className="font-mono text-[10.5px] text-brand-400">
                              ×{u.activeSessionsCount}
                            </span>
                          )}
                        </div>
                      ) : (
                        <Pill tone="default">OFFLINE</Pill>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-[12px] text-brand-500">
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Never"}
                      </span>
                    </Td>
                    <Td>
                      {u.modelsUsed && u.modelsUsed.length > 0 ? (
                        <div className="flex flex-wrap items-center gap-1 max-w-[220px]">
                          {u.modelsUsed.slice(0, 3).map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 rounded-md border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] font-medium text-brand-700"
                            >
                              <Zap size={9} className="text-warning-500" />
                              {m}
                            </span>
                          ))}
                          {u.modelsUsed.length > 3 && (
                            <span className="font-mono text-[10px] text-brand-400">
                              +{u.modelsUsed.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11.5px] text-brand-400">None</span>
                      )}
                    </Td>
                    <Td align="right">
                      <ActionButton
                        variant="secondary"
                        disabled={!u.isLoggedIn}
                        icon={<LogOut size={12} />}
                        onClick={() => setRevokeTarget(u)}
                        className="ml-auto"
                        title={
                          u.isLoggedIn
                            ? "Revoke active refresh sessions and invalidate current JWTs"
                            : "No active sessions to revoke"
                        }
                      >
                        Force Sign Out
                      </ActionButton>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={7} className="py-10 text-center text-[12.5px] text-brand-500">
                    No users match the current filter.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        )}
      </Panel>

      <ConfirmModal
        open={Boolean(revokeTarget)}
        title="Force Sign Out User?"
        description={`This immediately invalidates all active tokens and refresh sessions for ${revokeTarget?.email ?? "this user"}. They will have to sign in again.`}
        confirmLabel="Revoke All Sessions"
        tone="danger"
        busy={revoking}
        onConfirm={confirmRevoke}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}
