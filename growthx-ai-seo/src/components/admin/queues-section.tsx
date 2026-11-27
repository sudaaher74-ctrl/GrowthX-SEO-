"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Database,
  Loader2,
  Pause,
  Play,
  RefreshCw,
  Server,
  Trash2,
  X,
} from "lucide-react";
import { Pill, StatusNote, Td, Th, Tr, relativeTime } from "@/components/ui/console";
import { api } from "@/lib/api-client";
import type {
  AdminDataSyncRun,
  AdminQueueJobDetail,
  QueueStat,
} from "@/lib/api-types";
import { errorMessage } from "@/lib/error-message";
import {
  AdminSkeletonRows,
  AdminTableWrap,
  AdminThead,
  ConfirmModal,
  FilterChipGroup,
  NocButton,
  NocPanel,
} from "./admin-primitives";

interface QueuesSectionProps {
  queues: QueueStat[];
  syncJobs: AdminDataSyncRun[];
  loading: boolean;
  onRefresh: () => Promise<void> | void;
}

type QueueJobState = "failed" | "active" | "waiting" | "delayed" | "completed";

export function QueuesSection({
  queues,
  syncJobs,
  loading,
  onRefresh,
}: QueuesSectionProps) {
  const [selectedQueue, setSelectedQueue] = useState<string>("page-fetch");
  const [selectedState, setSelectedState] = useState<QueueJobState>("failed");
  const [jobs, setJobs] = useState<AdminQueueJobDetail[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ tone: "good" | "bad" | "warn"; text: string } | null>(null);
  const [confirmState, setConfirmState] = useState<{
    kind: "pause-all" | "clean-failed" | "drain";
    queue?: string;
  } | null>(null);

  const allPaused = queues.length > 0 && queues.every((q) => q.paused);
  const totalFailed = queues.reduce((sum, q) => sum + q.failed, 0);

  const fetchJobs = useCallback(async (q: string, s: QueueJobState) => {
    setJobsLoading(true);
    try {
      const list = await api.getAdminQueueJobs(q, s, 30);
      setJobs(list);
    } catch {
      setJobs([]);
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => void fetchJobs(selectedQueue, selectedState), 0);
    return () => clearTimeout(timer);
  }, [selectedQueue, selectedState, fetchJobs]);

  async function toggleQueue(queueName?: string, shouldResume?: boolean) {
    setBusyKey(`toggle-${queueName ?? "all"}`);
    setFeedback(null);
    try {
      if (shouldResume) {
        await api.resumeAdminQueues(queueName);
        setFeedback({ tone: "good", text: queueName ? `Resumed ${queueName}.` : "Resumed all BullMQ queues." });
      } else {
        await api.pauseAdminQueues(queueName);
        setFeedback({ tone: "warn", text: queueName ? `Paused ${queueName}.` : "Paused all BullMQ queues." });
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
    setBusyKey(`retry-${opts?.jobId ?? opts?.queue ?? "all"}`);
    setFeedback(null);
    try {
      const res = await api.retryAdminFailedJobs(opts);
      setFeedback({ tone: "good", text: `Re-queued ${res.retriedCount} failed job(s).` });
      await Promise.all([onRefresh(), fetchJobs(selectedQueue, selectedState)]);
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function removeJob(queueName: string, jobId: string) {
    setBusyKey(`remove-${jobId}`);
    setFeedback(null);
    try {
      await api.removeAdminQueueJob(queueName, jobId);
      setFeedback({ tone: "warn", text: `Removed job #${jobId} from ${queueName}.` });
      await Promise.all([onRefresh(), fetchJobs(selectedQueue, selectedState)]);
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function cleanFailed(queueName?: string) {
    setBusyKey(`clean-${queueName ?? "all"}`);
    setFeedback(null);
    try {
      const res = await api.cleanAdminFailedJobs(queueName);
      setFeedback({ tone: "good", text: `Cleared ${res.cleanedCount} failed job(s).` });
      setConfirmState(null);
      await Promise.all([onRefresh(), fetchJobs(selectedQueue, selectedState)]);
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  async function drainQueue(queueName: string) {
    setBusyKey(`drain-${queueName}`);
    setFeedback(null);
    try {
      await api.drainAdminQueue(queueName, true);
      setFeedback({ tone: "warn", text: `Drained waiting and delayed jobs from ${queueName}.` });
      setConfirmState(null);
      await Promise.all([onRefresh(), fetchJobs(selectedQueue, selectedState)]);
    } catch (err) {
      setFeedback({ tone: "bad", text: errorMessage(err) });
    } finally {
      setBusyKey(null);
    }
  }

  return (
    <div className="space-y-4">
      {feedback && <StatusNote tone={feedback.tone}>{feedback.text}</StatusNote>}

      {/* BullMQ Queue Control Matrix */}
      <NocPanel
        code="MQ"
        title="BULLMQ_QUEUE_CONTROL_MATRIX"
        subtitle="Real-time Redis queue state with pause/resume, retry, clean, and drain switches."
        actions={
          <>
            <NocButton
              variant={allPaused ? "primary" : "warn"}
              disabled={busyKey !== null}
              icon={allPaused ? <Play size={11} /> : <Pause size={11} />}
              onClick={() => {
                if (allPaused) void toggleQueue(undefined, true);
                else setConfirmState({ kind: "pause-all" });
              }}
            >
              {allPaused ? "RESUME_ALL" : "PAUSE_ALL"}
            </NocButton>
            <NocButton
              disabled={busyKey !== null || totalFailed === 0}
              icon={<RefreshCw size={11} className={busyKey === "retry-all" ? "animate-spin" : ""} />}
              onClick={() => void retryJobs()}
            >
              RETRY_FAILED ({totalFailed})
            </NocButton>
            {totalFailed > 0 && (
              <NocButton
                variant="danger"
                disabled={busyKey !== null}
                icon={<Trash2 size={11} />}
                onClick={() => setConfirmState({ kind: "clean-failed" })}
              >
                CLEAR_FAILED
              </NocButton>
            )}
          </>
        }
      >
        {loading && queues.length === 0 ? (
          <AdminSkeletonRows rows={3} cols={8} />
        ) : (
          <AdminTableWrap label="BullMQ queues" minWidth={820}>
            <AdminThead>
              <tr>
                <Th>Queue</Th>
                <Th align="right">Active</Th>
                <Th align="right">Waiting</Th>
                <Th align="right">Delayed</Th>
                <Th align="right">Completed</Th>
                <Th align="right">Failed</Th>
                <Th align="right">State</Th>
                <Th align="right">Controls</Th>
              </tr>
            </AdminThead>
            <tbody>
              {queues.map((q) => (
                <Tr key={q.name}>
                  <Td>
                    <button
                      type="button"
                      onClick={() => setSelectedQueue(q.name)}
                      className="flex items-center gap-2 font-mono text-[12px] font-bold text-brand-950 hover:text-signal-400 cursor-pointer"
                    >
                      <Server size={12} className="text-signal-400" />
                      {q.name}
                    </button>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] font-bold text-signal-400 tabular-nums">{q.active}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] text-brand-600 tabular-nums">{q.waiting}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] text-brand-400 tabular-nums">{q.delayed ?? 0}</span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[12px] font-semibold text-success-700 tabular-nums">
                      {q.completed.toLocaleString()}
                    </span>
                  </Td>
                  <Td align="right">
                    <span
                      className={`font-mono text-[12px] font-bold tabular-nums ${q.failed > 0 ? "text-error-700" : "text-brand-400"}`}
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
                      <NocButton
                        disabled={busyKey !== null || q.status === "idle"}
                        icon={q.paused ? <Play size={10} /> : <Pause size={10} />}
                        onClick={() => void toggleQueue(q.name, Boolean(q.paused))}
                      >
                        {q.paused ? "RESUME" : "PAUSE"}
                      </NocButton>
                      {q.waiting + (q.delayed ?? 0) > 0 && (
                        <NocButton
                          variant="danger"
                          disabled={busyKey !== null}
                          onClick={() => setConfirmState({ kind: "drain", queue: q.name })}
                        >
                          DRAIN
                        </NocButton>
                      )}
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </AdminTableWrap>
        )}
      </NocPanel>

      {/* Deep BullMQ Job Payload & Stacktrace Inspector */}
      <NocPanel
        code="INSPECT"
        title="RAW_BULLMQ_JOB_EXPLORER"
        subtitle="Inspect raw JSON job payloads, attempt counters, and exception stacktraces across any queue state."
        actions={
          <>
            <FilterChipGroup<string>
              value={selectedQueue}
              onChange={setSelectedQueue}
              options={[
                { id: "crawl-jobs", label: "crawl-jobs" },
                { id: "page-fetch", label: "page-fetch" },
                { id: "page-render", label: "page-render" },
              ]}
            />
            <FilterChipGroup<QueueJobState>
              value={selectedState}
              onChange={setSelectedState}
              options={[
                { id: "failed", label: "FAILED" },
                { id: "active", label: "ACTIVE" },
                { id: "waiting", label: "WAITING" },
                { id: "delayed", label: "DELAYED" },
                { id: "completed", label: "COMPLETED" },
              ]}
            />
            <NocButton
              icon={<RefreshCw size={11} className={jobsLoading ? "animate-spin" : ""} />}
              onClick={() => void fetchJobs(selectedQueue, selectedState)}
            >
              FETCH
            </NocButton>
          </>
        }
      >
        {jobsLoading ? (
          <div className="flex items-center justify-center gap-2 py-12 font-mono text-[12px] text-brand-400">
            <Loader2 size={14} className="animate-spin text-signal-400" />
            READING_REDIS_JOBS…
          </div>
        ) : (
          <AdminTableWrap label="BullMQ job inspector" minWidth={880} maxHeightClass="max-h-[440px]">
            <AdminThead>
              <tr>
                <Th>Job ID</Th>
                <Th>Target / Domain</Th>
                <Th>Failure / State</Th>
                <Th align="right">Attempts</Th>
                <Th align="right">Timestamp</Th>
                <Th align="right">Actions</Th>
              </tr>
            </AdminThead>
            <tbody>
              {jobs.length > 0 ? (
                jobs.map((job) => {
                  const open = expandedJobId === `${job.queue}:${job.id}`;
                  return (
                    <React.Fragment key={`${job.queue}:${job.id}`}>
                      <Tr>
                        <Td>
                          <div className="flex items-center gap-1.5 font-mono text-[11.5px]">
                            <button
                              type="button"
                              onClick={() => setExpandedJobId(open ? null : `${job.queue}:${job.id}`)}
                              aria-expanded={open}
                              aria-label="Toggle job JSON payload"
                              className="flex h-5 w-5 items-center justify-center rounded-xs text-brand-400 hover:bg-surface-2 hover:text-signal-400 cursor-pointer"
                            >
                              {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                            </button>
                            <span className="font-bold text-brand-950">#{job.id}</span>
                          </div>
                        </Td>
                        <Td>
                          <div className="max-w-[280px] font-mono">
                            <span className="block truncate text-[11.5px] text-brand-900" title={job.targetUrl ?? undefined}>
                              {job.targetUrl ?? job.domain ?? job.name}
                            </span>
                            {job.crawlJobId && (
                              <span className="block text-[10px] text-brand-400">crawl:{job.crawlJobId.slice(0, 8)}</span>
                            )}
                          </div>
                        </Td>
                        <Td>
                          {job.failedReason ? (
                            <p className="max-w-[300px] truncate font-mono text-[11px] text-error-700" title={job.failedReason}>
                              {job.failedReason}
                            </p>
                          ) : (
                            <Pill tone={job.state === "completed" ? "good" : job.state === "active" ? "info" : "default"}>
                              {job.state.toUpperCase()}
                            </Pill>
                          )}
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11.5px] text-brand-600 tabular-nums">
                            {job.attemptsMade}
                          </span>
                        </Td>
                        <Td align="right">
                          <span className="font-mono text-[11px] text-brand-400">
                            {relativeTime(job.finishedOn ?? job.processedOn ?? job.timestamp)}
                          </span>
                        </Td>
                        <Td align="right">
                          <div className="flex items-center justify-end gap-1.5">
                            {job.state === "failed" && (
                              <NocButton
                                disabled={busyKey !== null}
                                icon={<RefreshCw size={10} />}
                                onClick={() => void retryJobs({ queue: job.queue, jobId: job.id })}
                              >
                                RETRY
                              </NocButton>
                            )}
                            <NocButton
                              variant="danger"
                              disabled={busyKey !== null}
                              icon={<X size={10} />}
                              onClick={() => void removeJob(job.queue, job.id)}
                            >
                              RM
                            </NocButton>
                          </div>
                        </Td>
                      </Tr>
                      {open && (
                        <tr className="border-b border-brand-200 bg-surface-2/60">
                          <td colSpan={6} className="px-5 py-3 space-y-2">
                            <div>
                              <span className="block font-mono text-[9.5px] font-bold uppercase tracking-wider text-signal-400 mb-1">
                                JOB_PAYLOAD_JSON
                              </span>
                              <pre className="overflow-x-auto rounded-sm border border-brand-200 bg-surface-1 p-2.5 font-mono text-[11px] text-brand-700">
                                {JSON.stringify(job.data, null, 2)}
                              </pre>
                            </div>
                            {job.stacktrace.length > 0 && (
                              <div>
                                <span className="block font-mono text-[9.5px] font-bold uppercase tracking-wider text-error-700 mb-1">
                                  STACKTRACE
                                </span>
                                <pre className="overflow-x-auto rounded-sm border border-error-200 bg-error-50/40 p-2.5 font-mono text-[10.5px] text-error-700">
                                  {job.stacktrace.join("\n")}
                                </pre>
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <Tr>
                  <Td colSpan={6} className="py-10 text-center font-mono text-[11.5px] text-brand-400">
                    0_{selectedState.toUpperCase()}_JOBS_IN_{selectedQueue.toUpperCase()}
                  </Td>
                </Tr>
              )}
            </tbody>
          </AdminTableWrap>
        )}
      </NocPanel>

      {/* Google Data Sync Runs */}
      <NocPanel
        code="SYNC"
        title="GOOGLE_DATA_SYNC_JOBS"
        subtitle="Cross-tenant Search Console, GA4, and GBP ingestion runs."
      >
        <AdminTableWrap label="Google data sync jobs" minWidth={800} maxHeightClass="max-h-[340px]">
          <AdminThead>
            <tr>
              <Th>Provider</Th>
              <Th>Organization / Project</Th>
              <Th>Status</Th>
              <Th align="right">Rows</Th>
              <Th>Error</Th>
              <Th align="right">Started</Th>
            </tr>
          </AdminThead>
          <tbody>
            {syncJobs.length > 0 ? (
              syncJobs.map((s) => (
                <Tr key={s.id}>
                  <Td>
                    <span className="flex items-center gap-1.5 font-mono text-[11.5px] font-bold text-brand-950">
                      <Database size={11} className="text-signal-400" />
                      {s.provider}
                    </span>
                  </Td>
                  <Td>
                    <span className="block text-[12px] font-semibold text-brand-900">
                      {s.projectName ?? s.projectId.slice(0, 8)}
                    </span>
                    <span className="block font-mono text-[10.5px] text-brand-400">
                      {s.organizationName ?? "—"}
                    </span>
                  </Td>
                  <Td>
                    <Pill tone={s.status === "SUCCEEDED" ? "good" : s.status === "FAILED" ? "bad" : "warn"}>
                      {s.status}
                    </Pill>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[11.5px] text-brand-600 tabular-nums">
                      {s.rowsWritten.toLocaleString()}
                    </span>
                  </Td>
                  <Td>
                    <span className="block max-w-[260px] truncate font-mono text-[11px] text-error-700" title={s.errorMessage ?? undefined}>
                      {s.errorMessage ?? "—"}
                    </span>
                  </Td>
                  <Td align="right">
                    <span className="font-mono text-[11px] text-brand-400">{relativeTime(s.startedAt)}</span>
                  </Td>
                </Tr>
              ))
            ) : (
              <Tr>
                <Td colSpan={6} className="py-8 text-center font-mono text-[11.5px] text-brand-400">
                  NO_SYNC_RUNS_RECORDED
                </Td>
              </Tr>
            )}
          </tbody>
        </AdminTableWrap>
      </NocPanel>

      <ConfirmModal
        open={confirmState?.kind === "pause-all"}
        title="PAUSE_ALL_WORKER_QUEUES"
        description="Pausing crawl-jobs, page-fetch, and page-render halts all new crawler processing across tenants until resumed."
        confirmLabel="PAUSE_QUEUES"
        tone="warn"
        busy={busyKey !== null}
        onConfirm={() => void toggleQueue(undefined, false)}
        onClose={() => setConfirmState(null)}
      />

      <ConfirmModal
        open={confirmState?.kind === "clean-failed"}
        title="CLEAR_FAILED_BULLMQ_JOBS"
        description="Removes failed job entries from Redis BullMQ history. PostgreSQL CrawlJob history is preserved."
        confirmLabel="CLEAR_FAILED"
        tone="danger"
        busy={busyKey !== null}
        onConfirm={() => void cleanFailed(confirmState?.queue)}
        onClose={() => setConfirmState(null)}
      />

      <ConfirmModal
        open={confirmState?.kind === "drain"}
        title={`DRAIN_QUEUE // ${confirmState?.queue ?? ""}`}
        description={`This permanently removes ALL waiting and delayed jobs currently queued in "${confirmState?.queue}". Active jobs keep running.`}
        confirmLabel="DRAIN_QUEUE"
        tone="danger"
        busy={busyKey !== null}
        onConfirm={() => (confirmState?.queue ? void drainQueue(confirmState.queue) : undefined)}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
}
