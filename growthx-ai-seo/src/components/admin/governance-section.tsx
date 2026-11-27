"use client";

import React, { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { Pill, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import type {
  AdminAuditLogItem,
  AdminPipelinesResponse,
  AdminWebhooksResponse,
} from "@/lib/api-types";
import {
  AdminSearchInput,
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  FilterChipGroup,
  NocPanel,
} from "./admin-primitives";

interface GovernanceSectionProps {
  pipelines: AdminPipelinesResponse | null;
  auditLogs: AdminAuditLogItem[];
  webhooks: AdminWebhooksResponse | null;
  loading: boolean;
}

type GovSubTab = "pipelines" | "audit" | "deliveries" | "incoming";

export function GovernanceSection({
  pipelines,
  auditLogs,
  webhooks,
  loading,
}: GovernanceSectionProps) {
  const [subTab, setSubTab] = useState<GovSubTab>("pipelines");
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

  const totalPipelines =
    (pipelines?.autopilotRuns.length ?? 0) +
    (pipelines?.visibilityScans.length ?? 0) +
    (pipelines?.backlinkRuns.length ?? 0) +
    (pipelines?.automationRuns.length ?? 0) +
    (pipelines?.researchRuns.length ?? 0);

  return (
    <div className="space-y-4">
      <FilterChipGroup<GovSubTab>
        value={subTab}
        onChange={setSubTab}
        options={[
          { id: "pipelines", label: "BACKGROUND_PIPELINES", count: totalPipelines },
          { id: "audit", label: "AUDIT_LOG", count: auditLogs.length },
          {
            id: "deliveries",
            label: "OUTGOING_WEBHOOKS",
            count: deliveries.length,
            dot: failedDeliveriesCount > 0 ? "bad" : undefined,
          },
          { id: "incoming", label: "INCOMING_WEBHOOKS", count: incoming.length },
        ]}
      />

      {subTab === "pipelines" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <NocPanel
              code="AUTO"
              title="AUTOPILOT_PIPELINE_RUNS"
              subtitle="Cross-tenant workspace autopilot runs."
            >
              <AdminTableWrap label="Autopilot runs" minWidth={480} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>Domain</Th>
                    <Th>Step</Th>
                    <Th>Status</Th>
                    <Th align="right">Started</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {pipelines && pipelines.autopilotRuns.length > 0 ? (
                    pipelines.autopilotRuns.map((r) => (
                      <Tr key={r.id}>
                        <Td>
                          <span className="font-mono text-[11.5px] font-bold text-brand-950">{r.domain}</span>
                          {r.error && (
                            <p className="max-w-[220px] truncate font-mono text-[10px] text-error-700">{r.error}</p>
                          )}
                        </Td>
                        <Td><span className="font-mono text-[11px] text-brand-500">{r.step}</span></Td>
                        <Td>
                          <Pill tone={r.status === "DONE" ? "good" : r.status === "FAILED" ? "bad" : "info"}>
                            {r.status}
                          </Pill>
                        </Td>
                        <Td align="right"><span className="font-mono text-[10.5px] text-brand-400">{relativeTime(r.startedAt)}</span></Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr><Td colSpan={4} className="py-8 text-center font-mono text-[11px] text-brand-400">NO_AUTOPILOT_RUNS</Td></Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>

            <NocPanel
              code="AIVIS"
              title="AI_VISIBILITY_SCANS"
              subtitle="Cross-tenant multi-engine AI citation scan cycles."
            >
              <AdminTableWrap label="AI Visibility scans" minWidth={480} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>Project / Org</Th>
                    <Th align="right">Engines</Th>
                    <Th>Status</Th>
                    <Th align="right">Started</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {pipelines && pipelines.visibilityScans.length > 0 ? (
                    pipelines.visibilityScans.map((s) => (
                      <Tr key={s.id}>
                        <Td>
                          <span className="block font-mono text-[11.5px] font-bold text-brand-950">{s.projectName ?? s.cycleId}</span>
                          <span className="block font-mono text-[10px] text-brand-400">{s.organizationName ?? "—"}</span>
                          {s.error && <p className="max-w-[220px] truncate font-mono text-[10px] text-error-700">{s.error}</p>}
                        </Td>
                        <Td align="right"><span className="font-mono text-[11.5px] text-brand-600">{s.providerRuns}</span></Td>
                        <Td>
                          <Pill tone={s.status === "COMPLETED" ? "good" : s.status === "FAILED" ? "bad" : "info"}>
                            {s.status}
                          </Pill>
                        </Td>
                        <Td align="right"><span className="font-mono text-[10.5px] text-brand-400">{relativeTime(s.startedAt)}</span></Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr><Td colSpan={4} className="py-8 text-center font-mono text-[11px] text-brand-400">NO_VISIBILITY_SCANS</Td></Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>

            <NocPanel
              code="BLINK"
              title="BACKLINK_DISCOVERY_RUNS"
              subtitle="Public backlink graph discovery & verification runs."
            >
              <AdminTableWrap label="Backlink discovery runs" minWidth={480} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>Project</Th>
                    <Th align="right">Cand / Added</Th>
                    <Th>Status</Th>
                    <Th align="right">Started</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {pipelines && pipelines.backlinkRuns.length > 0 ? (
                    pipelines.backlinkRuns.map((b) => (
                      <Tr key={b.id}>
                        <Td>
                          <span className="block font-mono text-[11.5px] font-bold text-brand-950">{b.projectName ?? "—"}</span>
                          <span className="block truncate max-w-[200px] font-mono text-[10px] text-brand-400">{b.stage}</span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-600 tabular-nums">
                            {b.candidates} / <strong className="text-success-700">{b.added}</strong>
                          </span>
                        </Td>
                        <Td>
                          <Pill tone={b.status === "COMPLETED" ? "good" : b.status === "FAILED" ? "bad" : "info"}>
                            {b.status}
                          </Pill>
                        </Td>
                        <Td align="right"><span className="font-mono text-[10.5px] text-brand-400">{relativeTime(b.startedAt)}</span></Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr><Td colSpan={4} className="py-8 text-center font-mono text-[11px] text-brand-400">NO_BACKLINK_RUNS</Td></Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>

            <NocPanel
              code="FIX"
              title="FIX_ENGINE_AUTOMATION_RUNS"
              subtitle="Autonomous GitHub PR & CMS deployment jobs."
            >
              <AdminTableWrap label="Fix Engine automation runs" minWidth={480} maxHeightClass="max-h-[300px]">
                <AdminThead>
                  <tr>
                    <Th>Repo / Kind</Th>
                    <Th align="right">Files</Th>
                    <Th>Status</Th>
                    <Th align="right">Started</Th>
                  </tr>
                </AdminThead>
                <tbody>
                  {pipelines && pipelines.automationRuns.length > 0 ? (
                    pipelines.automationRuns.map((a) => (
                      <Tr key={a.id}>
                        <Td>
                          <span className="block font-mono text-[11.5px] font-bold text-brand-950">{a.repository ?? a.kind}</span>
                          <span className="block font-mono text-[10px] text-brand-400">{a.branch ?? a.kind}</span>
                          {a.error && <p className="max-w-[220px] truncate font-mono text-[10px] text-error-700">{a.error}</p>}
                        </Td>
                        <Td align="right"><span className="font-mono text-[11.5px] text-brand-600">{a.filesCount}</span></Td>
                        <Td>
                          <Pill tone={a.status === "COMPLETED" ? "good" : a.status === "FAILED" ? "bad" : "info"}>
                            {a.status}
                          </Pill>
                        </Td>
                        <Td align="right"><span className="font-mono text-[10.5px] text-brand-400">{relativeTime(a.startedAt)}</span></Td>
                      </Tr>
                    ))
                  ) : (
                    <Tr><Td colSpan={4} className="py-8 text-center font-mono text-[11px] text-brand-400">NO_AUTOMATION_RUNS</Td></Tr>
                  )}
                </tbody>
              </AdminTableWrap>
            </NocPanel>
          </div>
        </div>
      )}

      {subTab === "audit" && (
        <NocPanel
          code="AUD"
          title="IMMUTABLE_AUDIT_LOG"
          subtitle="Security and operator mutations across all organizations."
          actions={<AdminSearchInput value={auditSearch} onChange={setAuditSearch} placeholder="Filter action, actor, org…" />}
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
                            <div className="flex items-center gap-1.5">
                              {hasDetails ? (
                                <button
                                  type="button"
                                  onClick={() => setExpandedLogId(isOpen ? null : log.id)}
                                  aria-expanded={isOpen}
                                  aria-label="Toggle audit JSON details"
                                  className="flex h-5 w-5 items-center justify-center rounded-xs text-brand-400 hover:bg-surface-2 hover:text-signal-400 cursor-pointer"
                                >
                                  {isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                                </button>
                              ) : (
                                <span className="inline-block w-5" />
                              )}
                              <Pill
                                tone={
                                  log.action.includes("REVOKED") || log.action.includes("FAIL")
                                    ? "bad"
                                    : log.action.startsWith("ADMIN_")
                                      ? "info"
                                      : "default"
                                }
                              >
                                {log.action}
                              </Pill>
                            </div>
                          </Td>
                          <Td><span className="text-[12px] font-semibold text-brand-900">{log.organizationName}</span></Td>
                          <Td><span className="font-mono text-[11px] text-brand-500">{log.actorEmail ?? "SYSTEM"}</span></Td>
                          <Td><span className="font-mono text-[11px] text-brand-400">{log.resource ?? "—"}</span></Td>
                          <Td align="right"><span className="font-mono text-[11px] text-brand-400">{relativeTime(log.createdAt)}</span></Td>
                        </Tr>
                        {isOpen && hasDetails && (
                          <tr className="border-b border-brand-200 bg-surface-2/60">
                            <td colSpan={5} className="px-5 py-2.5">
                              <pre className="overflow-x-auto rounded-sm border border-brand-200 bg-surface-1 p-2.5 font-mono text-[11px] text-brand-700">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                ) : (
                  <Tr><Td colSpan={5} className="py-10 text-center font-mono text-[11.5px] text-brand-400">NO_AUDIT_ENTRIES</Td></Tr>
                )}
              </tbody>
            </AdminTableWrap>
          )}
        </NocPanel>
      )}

      {subTab === "deliveries" && (
        <NocPanel
          code="WH_OUT"
          title="OUTGOING_WEBHOOK_DELIVERIES"
          actions={
            <FilterChipGroup<"all" | "failed">
              value={deliveryFilter}
              onChange={setDeliveryFilter}
              options={[
                { id: "all", label: "ALL", count: deliveries.length },
                { id: "failed", label: "FAILED", count: failedDeliveriesCount, dot: failedDeliveriesCount > 0 ? "bad" : undefined },
              ]}
            />
          }
        >
          <AdminTableWrap label="Outgoing webhook deliveries" minWidth={840}>
            <AdminThead>
              <tr>
                <Th>Channel / Event</Th>
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
                      <div className="flex items-center gap-1.5">
                        <Pill tone="default">{d.channel}</Pill>
                        <span className="font-mono text-[11.5px] font-bold text-brand-950">{d.event}</span>
                      </div>
                      {d.error && <p className="mt-0.5 max-w-[260px] truncate font-mono text-[10px] text-error-700">{d.error}</p>}
                    </Td>
                    <Td>
                      <span className="block text-[12px] font-semibold text-brand-900">{d.organizationName ?? "—"}</span>
                      <span className="block font-mono text-[10px] text-brand-400">{d.projectName ?? ""}</span>
                    </Td>
                    <Td><span className="font-mono text-[11px] text-brand-500">{d.targetHost}</span></Td>
                    <Td>
                      <Pill tone={d.status === "SUCCESS" ? "good" : "bad"}>
                        {d.status}{d.statusCode ? ` (${d.statusCode})` : ""}
                      </Pill>
                    </Td>
                    <Td align="right"><span className="font-mono text-[11px] text-brand-400">{d.latencyMs}ms</span></Td>
                    <Td align="right"><span className="font-mono text-[11px] text-brand-400">{relativeTime(d.createdAt)}</span></Td>
                  </Tr>
                ))
              ) : (
                <Tr><Td colSpan={6} className="py-10 text-center font-mono text-[11.5px] text-brand-400">NO_OUTGOING_DELIVERIES</Td></Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </NocPanel>
      )}

      {subTab === "incoming" && (
        <NocPanel code="WH_IN" title="INCOMING_WEBHOOK_EVENTS">
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
                    <Td><span className="font-mono text-[11.5px] font-bold text-brand-950">{e.provider}</span></Td>
                    <Td><span className="font-mono text-[11px] text-brand-700">{e.eventType}</span></Td>
                    <Td><span className="font-mono text-[10.5px] text-brand-400">{e.eventId}</span></Td>
                    <Td>
                      <Pill tone={e.error ? "bad" : e.processedAt ? "good" : "warn"}>
                        {e.error ? "FAILED" : e.processedAt ? "PROCESSED" : "PENDING"}
                      </Pill>
                    </Td>
                    <Td>
                      <span className="block max-w-[260px] truncate font-mono text-[10.5px] text-error-700">{e.error ?? "—"}</span>
                    </Td>
                    <Td align="right"><span className="font-mono text-[11px] text-brand-400">{relativeTime(e.createdAt)}</span></Td>
                  </Tr>
                ))
              ) : (
                <Tr><Td colSpan={6} className="py-10 text-center font-mono text-[11.5px] text-brand-400">NO_INCOMING_WEBHOOKS</Td></Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </NocPanel>
      )}

      <NocPanel code="CLI" title="OPERATOR_PROVISIONING_CLI" padded>
        <div className="flex items-start gap-2.5 font-mono text-[11px] text-brand-500">
          <Terminal size={13} className="mt-0.5 shrink-0 text-signal-400" />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p>Platform-admin grants and revocations are strictly CLI-enforced via verified immutable User UUIDs:</p>
            <code className="block overflow-x-auto rounded-xs border border-brand-200 bg-surface-2 px-2.5 py-1.5 text-brand-900">
              docker compose exec api node scripts/manage-platform-admins.js list
            </code>
          </div>
        </div>
      </NocPanel>
    </div>
  );
}
