"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, ShieldCheck, Terminal, Webhook } from "lucide-react";
import { Panel, Pill, Tabs, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import type { AdminAuditLogItem, AdminWebhooksResponse } from "@/lib/api-types";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  FilterChipGroup,
} from "./admin-primitives";

interface GovernanceSectionProps {
  auditLogs: AdminAuditLogItem[];
  webhooks: AdminWebhooksResponse | null;
  loading: boolean;
}

type GovSubTab = "audit" | "deliveries" | "incoming";

export function GovernanceSection({ auditLogs, webhooks, loading }: GovernanceSectionProps) {
  const [subTab, setSubTab] = useState<GovSubTab>("audit");
  const [auditSearch, setAuditSearch] = useState("");
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);
  const [deliveryFilter, setDeliveryFilter] = useState<"all" | "failed">("all");

  const filteredLogs = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    if (!q) return auditLogs;
    return auditLogs.filter(
      (l) =>
        l.action.toLowerCase().includes(q) ||
        l.organizationName.toLowerCase().includes(q) ||
        (l.actorEmail && l.actorEmail.toLowerCase().includes(q)) ||
        (l.resource && l.resource.toLowerCase().includes(q)),
    );
  }, [auditLogs, auditSearch]);

  const deliveries = useMemo(() => webhooks?.deliveries ?? [], [webhooks]);
  const failedDeliveriesCount = deliveries.filter((d) => d.status !== "SUCCESS").length;
  const filteredDeliveries = useMemo(() => {
    if (deliveryFilter === "failed") return deliveries.filter((d) => d.status !== "SUCCESS");
    return deliveries;
  }, [deliveries, deliveryFilter]);

  const incoming = webhooks?.incoming ?? [];

  return (
    <div className="space-y-5">
      <Tabs<GovSubTab>
        active={subTab}
        onChange={setSubTab}
        tabs={[
          { id: "audit", label: "Audit Log", tag: String(auditLogs.length), icon: FileText },
          {
            id: "deliveries",
            label: "Outgoing Webhooks",
            tag: String(deliveries.length),
            icon: Webhook,
          },
          {
            id: "incoming",
            label: "Incoming Webhook Events",
            tag: String(incoming.length),
            icon: ShieldCheck,
          },
        ]}
      />

      {subTab === "audit" && (
        <Panel
          title="Platform Audit Log"
          subtitle="Immutable security and operator trail across all organizations."
          actions={
            <AdminSearchInput
              value={auditSearch}
              onChange={setAuditSearch}
              placeholder="Search action, actor, org, resource…"
            />
          }
        >
          {loading && auditLogs.length === 0 ? (
            <AdminSkeletonRows rows={6} cols={5} />
          ) : (
            <AdminTableWrap label="Platform audit log" minWidth={820}>
              <AdminThead>
                <tr>
                  <Th>Action</Th>
                  <Th>Organization</Th>
                  <Th>Actor</Th>
                  <Th>Resource</Th>
                  <Th align="right">When</Th>
                </tr>
              </AdminThead>
              <tbody>
                {filteredLogs.length > 0 ? (
                  filteredLogs.map((log) => {
                    const isOpen = expandedLogId === log.id;
                    const hasDetails = Boolean(log.details && Object.keys(log.details).length > 0);
                    return (
                      <React.Fragment key={log.id}>
                        <Tr>
                          <Td>
                            <div className="flex items-center gap-2">
                              {hasDetails ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                                  aria-expanded={isOpen}
                                  aria-label={isOpen ? "Hide event payload" : "Show event payload"}
                                  className="flex h-5 w-5 items-center justify-center rounded text-brand-400 hover:bg-surface-2 hover:text-brand-950 cursor-pointer"
                                >
                                  {isOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                                </button>
                              ) : (
                                <span className="inline-block w-5" />
                              )}
                              <Pill
                                tone={
                                  log.action.includes("REVOKED") || log.action.includes("DELETE")
                                    ? "bad"
                                    : log.action.startsWith("ADMIN_") || log.action.includes("GRANTED")
                                      ? "info"
                                      : "default"
                                }
                              >
                                {log.action}
                              </Pill>
                            </div>
                          </Td>
                          <Td>
                            <span className="text-[12.5px] font-medium text-brand-950">
                              {log.organizationName}
                            </span>
                          </Td>
                          <Td>
                            <span className="font-mono text-[11.5px] text-brand-600">
                              {log.actorEmail ?? "System"}
                            </span>
                          </Td>
                          <Td>
                            <span className="font-mono text-[11.5px] text-brand-500">
                              {log.resource ?? "—"}
                            </span>
                          </Td>
                          <Td align="right">
                            <span className="font-mono text-[11.5px] text-brand-500">
                              {relativeTime(log.createdAt)}
                            </span>
                          </Td>
                        </Tr>
                        {isOpen && hasDetails && (
                          <tr className="border-b border-brand-200/60 bg-surface-2/60">
                            <td colSpan={5} className="px-6 py-3">
                              <pre className="overflow-x-auto rounded-lg border border-brand-200 bg-surface-1 p-3 font-mono text-[11px] text-brand-700">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <Tr>
                    <Td colSpan={5} className="py-10 text-center text-[12.5px] text-brand-500">
                      No audit log entries found.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </AdminTableWrap>
          )}
        </Panel>
      )}

      {subTab === "deliveries" && (
        <Panel
          title="Outgoing Webhook Deliveries"
          subtitle="Slack, Discord, and REST webhook dispatch history across tenant projects."
          actions={
            <FilterChipGroup<"all" | "failed">
              value={deliveryFilter}
              onChange={setDeliveryFilter}
              options={[
                { id: "all", label: "All", count: deliveries.length },
                { id: "failed", label: "Failed", count: failedDeliveriesCount, dot: failedDeliveriesCount > 0 ? "bad" : undefined },
              ]}
            />
          }
        >
          <AdminTableWrap label="Outgoing webhook deliveries" minWidth={840}>
            <AdminThead>
              <tr>
                <Th>Channel & Event</Th>
                <Th>Tenant / Project</Th>
                <Th>Target Host</Th>
                <Th>Status</Th>
                <Th align="right">Latency</Th>
                <Th align="right">Sent</Th>
              </tr>
            </AdminThead>
            <tbody>
              {filteredDeliveries.length > 0 ? (
                filteredDeliveries.map((d) => (
                  <Tr key={d.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <Pill tone="default">{d.channel}</Pill>
                        <span className="font-mono text-[11.5px] font-semibold text-brand-950">
                          {d.event}
                        </span>
                      </div>
                      {d.error && (
                        <p className="mt-1 max-w-[260px] truncate font-mono text-[10.5px] text-error-600" title={d.error}>
                          {d.error}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <span className="block text-[12.5px] font-medium text-brand-950">
                        {d.organizationName ?? "—"}
                      </span>
                      <span className="block text-[11px] text-brand-400">{d.projectName ?? ""}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11.5px] text-brand-600">{d.targetHost}</span>
                    </Td>
                    <Td>
                      <Pill tone={d.status === "SUCCESS" ? "good" : "bad"}>
                        {d.status}
                        {d.statusCode ? ` (${d.statusCode})` : ""}
                      </Pill>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500 tabular-nums">
                        {d.latencyMs}ms
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500">
                        {relativeTime(d.createdAt)}
                      </span>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center text-[12.5px] text-brand-500">
                    No outgoing webhook deliveries recorded.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>
      )}

      {subTab === "incoming" && (
        <Panel
          title="Incoming Webhook Events"
          subtitle="Idempotent provider webhook receipts (billing & external integrations)."
        >
          <AdminTableWrap label="Incoming webhook events" minWidth={780}>
            <AdminThead>
              <tr>
                <Th>Provider</Th>
                <Th>Event Type</Th>
                <Th>Event ID</Th>
                <Th>State</Th>
                <Th>Error</Th>
                <Th align="right">Received</Th>
              </tr>
            </AdminThead>
            <tbody>
              {incoming.length > 0 ? (
                incoming.map((e) => (
                  <Tr key={e.id}>
                    <Td>
                      <span className="font-mono text-[12px] font-semibold text-brand-950">
                        {e.provider}
                      </span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11.5px] text-brand-800">{e.eventType}</span>
                    </Td>
                    <Td>
                      <span className="font-mono text-[11px] text-brand-500">{e.eventId}</span>
                    </Td>
                    <Td>
                      <Pill tone={e.error ? "bad" : e.processedAt ? "good" : "warn"}>
                        {e.error ? "FAILED" : e.processedAt ? "PROCESSED" : "PENDING"}
                      </Pill>
                    </Td>
                    <Td>
                      {e.error ? (
                        <span className="block max-w-[260px] truncate font-mono text-[11px] text-error-600" title={e.error}>
                          {e.error}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-brand-400">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500">
                        {relativeTime(e.createdAt)}
                      </span>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center text-[12.5px] text-brand-500">
                    No incoming webhook events recorded yet.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>
      )}

      {/* Operator Provisioning Runbook Reference */}
      <Panel
        title="Operator Access Governance"
        subtitle="Platform operator privileges are managed exclusively out-of-band via verified User IDs."
        padded
      >
        <div className="flex items-start gap-3 rounded-xl border border-brand-200 bg-surface-2/60 p-4">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-brand-200 bg-surface-1 text-brand-600">
            <Terminal size={14} />
          </span>
          <div className="min-w-0 flex-1 space-y-2 text-[12px] text-brand-600">
            <p className="leading-relaxed">
              Granting or revoking operator access requires database-backed ownership verification using the server
              CLI so compromised browser sessions cannot escalate privileges.
            </p>
            <div className="overflow-x-auto rounded-lg border border-brand-200 bg-surface-1 px-3 py-2 font-mono text-[11px] text-brand-800">
              docker compose exec api node scripts/manage-platform-admins.js list
            </div>
          </div>
        </div>
      </Panel>
    </div>
  );
}
