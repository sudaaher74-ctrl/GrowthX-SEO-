"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  Database,
  Globe,
  Pause,
  Play,
  RefreshCw,
  Server,
  Trash2,
} from "lucide-react";
import { ActionButton, Panel, Pill, StatusNote, Tabs, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminFailedJob,
  AdminRecentCrawlsResponse,
  QueueStat,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  formatDurationSec,
} from "./admin-primitives";

interface QueuesSectionProps {
  queues: QueueStat[];
  failedJobs: AdminFailedJob[];
  recentCrawls: AdminRecentCrawlsResponse | null;
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

type OpsSubTab = "failed" | "crawls" | "syncs";

export function QueuesSection({
  queues,
  failedJobs,
  recentCrawls,
  loading,
  onRefresh,
}: QueuesSectionProps) {
  const [subTab, setSubTab] = useState<OpsSubTab>("crawls");
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    kind: "pause-all" | "clean-failed";
    queue?: string;
  } | null>(null);

  const allPaused = queues.length > 0 && queues.every((q) => q.paused);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  async function toggleQueue(queueName?: string, shouldResume?: boolean) {
    const key = `toggle-${queueName ?? "all"}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      if (shouldResume) {
        await api.resumeAdminQueues(queueName);
        setFeedback({
          tone: "good",
          text: queueName ? `Resumed queue ${queueName}.` : "Resumed all crawler worker queues.",
        });
      } else {
        await api.pauseAdminQueues(queueName);
        setFeedback({
          tone: "warn",
          text: queueName ? `Paused queue ${queueName}.` : "Paused all crawler worker queues.",
        });
      }
      setConfirmState(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function retryJobs(opts?: { queue?: string; jobId?: string }) {
    const key = `retry-${opts?.jobId ?? opts?.queue ?? "all"}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const res = await api.retryAdminFailedJobs(opts);
      setFeedback({
        tone: "good",
        text: `Re-queued ${res.retriedCount} failed job${res.retriedCount === 1 ? "" : "s"}.`,
      });
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function cleanFailed(queueName?: string) {
    const key = `clean-${queueName ?? "all"}`;
    setBusyKey(key);
    setFeedback(null);
    try {
      const res = await api.cleanAdminFailedJobs(queueName);
      setFeedback({
        tone: "good",
        text: `Cleared ${res.cleanedCount} failed job${res.cleanedCount === 1 ? "" : "s"}${queueName ? ` from ${queueName}` : ""}.`,
      });
      setConfirmState(null);
      await onRefresh();
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-5">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      {/* BullMQ Worker Queues */}
      <Panel
        title="BullMQ Worker Queues"
        subtitle="Real-time queue telemetry and per-queue controls across crawl-jobs, page-fetch, and page-render."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton
              variant={allPaused ? "primary" : "secondary"}
              disabled={busyKey !== null}
              icon={allPaused ? <Play size={12} /> : <Pause size={12} />}
              onClick={() => {
                if (allPaused) void toggleQueue(undefined, true);
                else setConfirmState({ kind: "pause-all" });
              }}
            >
              {allPaused ? "Resume All" : "Pause All"}
            </ActionButton>
            <ActionButton
              variant="secondary"
              disabled={busyKey !== null || totalFailed === 0}
              icon={<RefreshCw size={12} className={busyKey === "retry-all" ? "animate-spin" : ""} />}
              onClick={() => void retryJobs()}
            >
              Retry Failed ({totalFailed})
            </ActionButton>
            {totalFailed > 0 && (
              <ActionButton
                variant="secondary"
                disabled={busyKey !== null}
                icon={<Trash2 size={12} />}
                onClick={() => setConfirmState({ kind: "clean-failed" })}
              >
                Clear Failed
              </ActionButton>
            )}
          </div>
        }
      >
        {loading && queues.length === 0 ? (
          <AdminSkeletonRows rows={3} cols={7} />
        ) : (
          <AdminTableWrap label="BullMQ queues" minWidth={760}>
            <AdminThead>
              <tr>
                <Th>Queue</Th>
                <Th align="right">Active</Th>
                <Th align="right">Waiting</Th>
                <Th align="right">Delayed</Th>
                <Th align="right">Completed</Th>
                <Th align="right">Failed</Th>
                <Th align="right">Status</Th>
                <Th align="right">Controls</Th>
              </tr>
            </AdminThead>
            <tbody>
              {queues.map((q) => (
                <Tr key={q.name}>
                  <Td>
                    <div className="flex items-center gap-2 font-mono text-[12.5px] font-semibold text-brand-950">
                      <Server size={13} className="text-brand-400" />
                      {q.name}
                    </div>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12.5px] font-semibold text-brand-950 tabular-nums">
                      {q.active}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12.5px] text-brand-600 tabular-nums">{q.waiting}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12.5px] text-brand-500 tabular-nums">
                      {q.delayed ?? 0}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12.5px] font-semibold text-success-600 tabular-nums">
                      {q.completed.toLocaleString()}
                    </span>
                  </Td>
                  <Td align="right">
                    <span
                      className={`font-mono text-[12.5px] font-semibold tabular-nums ${q.failed > 0 ? "text-error-600" : "text-brand-400"}`}
                    >
                      {q.failed}
                    </span>
                  </Td>
                  <Td align="right">
                    <Pill tone={q.paused ? "warn" : q.failed > 0 ? "bad" : q.status === "active" ? "good" : "default"} dot>
                      {q.paused ? "PAUSED" : q.status.toUpperCase()}
                    </Pill>
                  </Td>
                  <Td align="right">
                    <div className="flex items-center justify-end gap-1.5">
                      <ActionButton
                        variant="secondary"
                        disabled={busyKey !== null || q.status === "idle"}
                        icon={q.paused ? <Play size={11} /> : <Pause size={11} />}
                        onClick={() => void toggleQueue(q.name, Boolean(q.paused))}
                      >
                        {q.paused ? "Resume" : "Pause"}
                      </ActionButton>
                      {q.failed > 0 && (
                        <ActionButton
                          variant="secondary"
                          disabled={busyKey !== null}
                          icon={<RefreshCw size={11} />}
                          onClick={() => void retryJobs({ queue: q.name })}
                        >
                          Retry
                        </ActionButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </AdminTableWrap>
        )}
      </Panel>

      {/* Deep Ops Sub-tabs */}
      <Tabs<OpsSubTab>
        active={subTab}
        onChange={setSubTab}
        tabs={[
          {
            id: "crawls",
            label: "Recent Crawl Runs",
            tag: String(recentCrawls?.crawls.length ?? 0),
            icon: Globe,
          },
          {
            id: "failed",
            label: "Failed Queue Jobs",
            tag: String(failedJobs.length),
            icon: AlertTriangle,
          },
          {
            id: "syncs",
            label: "Google Data Syncs",
            tag: String(recentCrawls?.syncJobs.length ?? 0),
            icon: Database,
          },
        ]}
      />

      {subTab === "crawls" && (
        <Panel
          title="Cross-Tenant Crawl History"
          subtitle="Most recent site audits across all organizations with status, coverage, duration, and errors."
        >
          {loading && !recentCrawls ? (
            <AdminSkeletonRows rows={6} cols={6} />
          ) : (
            <AdminTableWrap label="Recent crawl runs" minWidth={880}>
              <AdminThead>
                <tr>
                  <Th>Domain & Tenant</Th>
                  <Th>Status</Th>
                  <Th align="right">Pages</Th>
                  <Th align="right">Issues</Th>
                  <Th align="right">Score</Th>
                  <Th align="right">Duration</Th>
                  <Th align="right">Started</Th>
                </tr>
              </AdminThead>
              <tbody>
                {recentCrawls && recentCrawls.crawls.length > 0 ? (
                  recentCrawls.crawls.map((c) => (
                    <Tr key={c.id}>
                      <Td>
                        <div className="min-w-0 max-w-[300px]">
                          <div className="flex items-center gap-2">
                            <span className="truncate font-mono text-[12.5px] font-semibold text-brand-950">
                              {c.domain}
                            </span>
                            {c.scope.startsWith("competitor:") && <Pill tone="default">Competitor</Pill>}
                          </div>
                          <span className="block truncate text-[11px] text-brand-400">
                            {c.organizationName ?? "Unscoped"}
                            {c.projectName ? ` · ${c.projectName}` : ""}
                          </span>
                          {c.errorMessage && (
                            <p className="mt-1 truncate text-[11px] text-error-600" title={c.errorMessage}>
                              {c.errorMessage}
                            </p>
                          )}
                        </div>
                      </Td>
                      <Td>
                        <Pill
                          tone={
                            c.status === "COMPLETED"
                              ? "good"
                              : c.status === "FAILED"
                                ? "bad"
                                : c.status === "RUNNING"
                                  ? "info"
                                  : "warn"
                          }
                          dot={c.status === "RUNNING"}
                        >
                          {c.status}
                        </Pill>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] text-brand-950 tabular-nums">
                          {c.pagesCrawled}
                          {c.pagesDiscovered > 0 ? (
                            <span className="text-brand-400">/{c.pagesDiscovered}</span>
                          ) : null}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                          {c.issuesFound}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] font-semibold text-brand-950 tabular-nums">
                          {c.healthScore != null ? `${c.healthScore}/100` : "—"}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[12px] text-brand-500 tabular-nums">
                          {formatDurationSec(c.durationSec)}
                        </span>
                      </Td>
                      <Td align="right">
                        <span className="font-mono text-[11.5px] text-brand-500">
                          {relativeTime(c.startedAt ?? c.createdAt)}
                        </span>
                      </Td>
                    </Tr>
                  ))
                ) : (
                  <Tr>
                    <Td colSpan={7} className="py-10 text-center text-[12.5px] text-brand-500">
                      No crawl runs recorded yet.
                    </Td>
                  </Tr>
                )}
              </tbody>
            </AdminTableWrap>
          )}
        </Panel>
      )}

      {subTab === "failed" && (
        <Panel
          title="Failed BullMQ Jobs Inspector"
          subtitle="Inspect failed queue tasks, see the underlying error reason, and retry individual jobs."
        >
          <AdminTableWrap label="Failed queue jobs" minWidth={840}>
            <AdminThead>
              <tr>
                <Th>Queue / Job ID</Th>
                <Th>Target URL</Th>
                <Th>Failure Reason</Th>
                <Th align="right">Attempts</Th>
                <Th align="right">Failed</Th>
                <Th align="right">Action</Th>
              </tr>
            </AdminThead>
            <tbody>
              {failedJobs.length > 0 ? (
                failedJobs.map((job) => (
                  <Tr key={`${job.queue}:${job.id}`}>
                    <Td>
                      <Pill tone="bad">{job.queue}</Pill>
                      <span className="mt-1 block font-mono text-[10.5px] text-brand-400">
                        #{job.id}
                      </span>
                    </Td>
                    <Td>
                      <div className="max-w-[240px]">
                        <span className="block truncate font-mono text-[12px] text-brand-950" title={job.targetUrl ?? undefined}>
                          {job.targetUrl ?? job.domain ?? "—"}
                        </span>
                        {job.domain && job.targetUrl && (
                          <span className="block truncate text-[10.5px] text-brand-400">{job.domain}</span>
                        )}
                      </div>
                    </Td>
                    <Td>
                      <p className="max-w-[320px] truncate font-mono text-[11.5px] text-error-600" title={job.failedReason}>
                        {job.failedReason}
                      </p>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                        {job.attemptsMade}
                      </span>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500">
                        {relativeTime(job.timestamp)}
                      </span>
                    </Td>
                    <Td align="right">
                      <ActionButton
                        variant="secondary"
                        disabled={busyKey !== null}
                        icon={<RefreshCw size={11} />}
                        onClick={() => void retryJobs({ queue: job.queue, jobId: job.id })}
                        className="ml-auto"
                      >
                        Retry
                      </ActionButton>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center text-[12.5px] text-brand-500">
                    No failed jobs currently sitting in BullMQ queues.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>
      )}

      {subTab === "syncs" && (
        <Panel
          title="Google Data Sync Jobs"
          subtitle="Recent Search Console, GA4, and Business Profile sync runs across tenant projects."
        >
          <AdminTableWrap label="Google data sync jobs" minWidth={820}>
            <AdminThead>
              <tr>
                <Th>Provider</Th>
                <Th>Organization / Project</Th>
                <Th>Status</Th>
                <Th align="right">Rows Written</Th>
                <Th>Error</Th>
                <Th align="right">Started</Th>
              </tr>
            </AdminThead>
            <tbody>
              {recentCrawls && recentCrawls.syncJobs.length > 0 ? (
                recentCrawls.syncJobs.map((s) => (
                  <Tr key={s.id}>
                    <Td>
                      <span className="font-mono text-[12px] font-semibold text-brand-950">
                        {s.provider}
                      </span>
                    </Td>
                    <Td>
                      <span className="block text-[12.5px] font-medium text-brand-950">
                        {s.projectName ?? s.projectId.slice(0, 8)}
                      </span>
                      <span className="block text-[11px] text-brand-400">
                        {s.organizationName ?? "—"}
                      </span>
                    </Td>
                    <Td>
                      <Pill
                        tone={
                          s.status === "SUCCEEDED"
                            ? "good"
                            : s.status === "FAILED"
                              ? "bad"
                              : s.status === "PARTIAL"
                                ? "warn"
                                : "info"
                        }
                      >
                        {s.status}
                      </Pill>
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[12px] text-brand-700 tabular-nums">
                        {s.rowsWritten.toLocaleString()}
                      </span>
                    </Td>
                    <Td>
                      {s.errorMessage ? (
                        <span className="block max-w-[280px] truncate text-[11.5px] text-error-600" title={s.errorMessage}>
                          {s.errorMessage}
                        </span>
                      ) : (
                        <span className="text-[11.5px] text-brand-400">—</span>
                      )}
                    </Td>
                    <Td align="right">
                      <span className="font-mono text-[11.5px] text-brand-500">
                        {relativeTime(s.startedAt)}
                      </span>
                    </Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center text-[12.5px] text-brand-500">
                    No Google data sync runs recorded yet.
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        </Panel>
      )}

      <ConfirmModal
        open={confirmState?.kind === "pause-all"}
        title="Pause All Worker Queues?"
        description="Pausing crawl-jobs, page-fetch, and page-render stops new background crawls from executing until resumed. Active jobs finish their current step."
        confirmLabel="Pause All Queues"
        tone="warn"
        busy={busyKey !== null}
        onConfirm={() => void toggleQueue(undefined, false)}
        onClose={() => setConfirmState(null)}
      />

      <ConfirmModal
        open={confirmState?.kind === "clean-failed"}
        title="Clear Failed Queue Jobs?"
        description="This permanently removes failed job entries from Redis BullMQ history. CrawlJob rows in PostgreSQL remain untouched."
        confirmLabel="Clear Failed Jobs"
        tone="danger"
        busy={busyKey !== null}
        onConfirm={() => void cleanFailed(confirmState?.queue)}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
