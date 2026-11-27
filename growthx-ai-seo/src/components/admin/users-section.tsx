"use client";

import React, { useMemo, useState } from "react";
import { CheckCircle2, LogOut, MailCheck, ShieldCheck, ShieldOff, Zap } from "lucide-react";
import { Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
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
  NocButton,
  NocPanel,
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
  const [busyId, setBusyId] = useState<string | null>(null);
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
        u.id.toLowerCase().includes(q) ||
        u.organizationName.toLowerCase().includes(q) ||
        models.includes(q)
      );
    });
  }, [users, search, filter]);

  async function verifyEmail(u: AdminUserItem) {
    setBusyId(`verify-${u.id}`);
    setFeedback(null);
    try {
      await api.verifyAdminUserEmail(u.id);
      setFeedback({ tone: "good", text: `Marked ${u.email} as email-verified.` });
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRevoke() {
    if (!revokeTarget) return;
    setBusyId(`revoke-${revokeTarget.id}`);
    setFeedback(null);
    try {
      const res = await api.revokeAdminUserSessions(revokeTarget.id);
      setFeedback({
        tone: "good",
        text: `Revoked ${res.revokedSessions} active session(s) and invalidated JWTs for ${revokeTarget.email}.`,
      });
      setRevokeTarget(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      <NocPanel
        code="IAM"
        title="USERS_SESSIONS_AND_VERIFICATION"
        subtitle="Inspect user UUIDs, auth methods, active refresh sessions, manually verify emails, and force sign-out."
        actions={
          <>
            <FilterChipGroup<UserFilter>
              value={filter}
              onChange={setFilter}
              options={[
                { id: "all", label: "ALL", count: counts.all },
                { id: "online", label: "ONLINE", count: counts.online, dot: "good" },
                { id: "offline", label: "OFFLINE", count: counts.offline },
                { id: "operators", label: "OPERATORS", count: counts.operators },
                { id: "unverified", label: "UNVERIFIED", count: counts.unverified },
              ]}
            />
            <AdminSearchInput value={search} onChange={setSearch} placeholder="Search email, UUID, org…" />
          </>
        }
      >
        {loading && users.length === 0 ? (
          <AdminSkeletonRows rows={6} cols={7} />
        ) : (
          <AdminTableWrap label="Platform users IAM" minWidth={1020}>
            <AdminThead>
              <tr>
                <Th>Identity / UUID</Th>
                <Th>Verification & Auth</Th>
                <Th>Org / Role</Th>
                <Th>Session</Th>
                <Th>Last Login</Th>
                <Th>AI Models</Th>
                <Th align="right">Actions</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filtered.length > 0 ? (
                filtered.map((u) => (
                  <Tr key={u.id}>
                    <Td>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="truncate font-mono text-[12px] font-bold text-brand-950">
                            {u.email}
                          </span>
                          {u.isPlatformAdmin && (
                            <Pill tone="info">
                              <ShieldCheck size={9} /> ROOT
                            </Pill>
                          )}
                        </div>
                        <span className="block font-mono text-[10px] text-brand-400">
                          {u.name} · {u.id.slice(0, 8)}
                        </span>
                      </div>
                    </Td>
                    <Td>
                      <div className="flex flex-wrap items-center gap-1">
                        {u.emailVerified ? (
                          <Pill tone="good">
                            <CheckCircle2 size={9} /> VERIFIED
                          </Pill>
                        ) : (
                          <Pill tone="warn">UNVERIFIED</Pill>
                        )}
                        {u.authProvider && (
                          <Pill tone="default">{u.authProvider.toUpperCase()}</Pill>
                        )}
                        {u.platformAdminRevoked && (
                          <Pill tone="bad">
                            <ShieldOff size={9} /> REVOKED
                          </Pill>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[12px] font-semibold text-brand-900">{u.organizationName}</span>
                        <Pill tone={u.role === "OWNER" ? "good" : "default"}>{u.role}</Pill>
                      </div>
                      <span className="block font-mono text-[10px] text-brand-400">
                        joined {relativeTime(u.createdAt)}
                      </span>
                    </Td>
                    <Td>
                      {u.isLoggedIn ? (
                        <Pill tone="good" dot>
                          LIVE ×{u.activeSessionsCount ?? 1}
                        </Pill>
                      ) : (
                        <Pill tone="default">OFFLINE</Pill>
                      )}
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-brand-400">
                        {u.lastLoginAt ? relativeTime(u.lastLoginAt) : "NEVER"}
                      </span>
                    </Td>
                    <Td>
                      {u.modelsUsed && u.modelsUsed.length > 0 ? (
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {u.modelsUsed.slice(0, 2).map((m) => (
                            <span
                              key={m}
                              className="inline-flex items-center gap-1 rounded-xs border border-brand-200 bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-brand-700"
                            >
                              <Zap size={9} className="text-warning-500" />
                              {m}
                            </span>
                          ))}
                          {u.modelsUsed.length > 2 && (
                            <span className="font-mono text-[10px] text-brand-400">+{u.modelsUsed.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span className="font-mono text-[11px] text-brand-400">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {!u.emailVerified && (
                          <NocButton
                            variant="primary"
                            disabled={busyId !== null}
                            icon={<MailCheck size={11} />}
                            onClick={() => void verifyEmail(u)}
                          >
                            VERIFY
                          </NocButton>
                        )}
                        <NocButton
                          variant="danger"
                          disabled={!u.isLoggedIn || busyId !== null}
                          icon={<LogOut size={11} />}
                          onClick={() => setRevokeTarget(u)}
                        >
                          KILL_SESS
                        </NocButton>
                      </div>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={7} className="py-10 text-center font-mono text-[11.5px] text-brand-400">
                    NO_USERS_MATCH_FILTER
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        )}
      </NocPanel>

      <ConfirmModal
        open={Boolean(revokeTarget)}
        title="TERMINATE_USER_SESSIONS"
        description={`Immediately revoke all active refresh sessions and invalidate current access JWTs for ${revokeTarget?.email ?? "this user"}.`}
        confirmLabel="REVOKE_SESSIONS"
        tone="danger"
        busy={busyId !== null}
        onConfirm={confirmRevoke}
        onClose={() => setRevokeTarget(null)}
      />
    </div>
  );
}
