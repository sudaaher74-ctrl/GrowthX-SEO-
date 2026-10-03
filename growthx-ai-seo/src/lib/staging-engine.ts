"use client";

import { api, ApiError } from "@/lib/api-client";

/**
 * Staging Engine for Reigel SEO Platform
 *
 * Bridges the gap between Competitor Intelligence / AI Visibility and the Fix Engine.
 * Staged items (keyword gaps, content briefs, schema fixes, prompt gaps) are persisted
 * per project and merged into the Fix Engine's 30-day autonomous execution plan.
 *
 * Kept on the server (`/api/projects/:id/saved-plans`). They used to live only
 * in this browser's storage, so a new phone, a cleared browser or a colleague
 * logging in saw none of them. The browser still keeps a copy — the screen
 * answers instantly and works offline — and every change is queued and sent
 * in order, kept and retried when the server cannot be reached. Plans saved
 * in this browser before the move are uploaded the first time it syncs.
 *
 * The synchronous API is unchanged, so the screens that call it did not change.
 */

export type StagedSourceType =
  | "COMPETITOR_KEYWORD"
  | "COMPETITOR_CONTENT"
  | "COMPETITOR_INTERCEPT"
  | "INTERNAL_LINK"
  | "AI_VISIBILITY"
  | "TECHNICAL_AUDIT"
  | "AUTHORITY_GAP"
  | "LOCAL_SEO_GEO"
  | "BUSINESS_CATALOG_GAP"
  | "BUSINESS_MARKETING_SIGNAL";

export interface StagedFixItem {
  id: string;
  projectId: string;
  title: string;
  category: string;
  source: StagedSourceType;
  priority: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  impact: string;
  effortHours: number;
  deliverable: string;
  evidence?: string;
  affectedUrl?: string;
  stagedAt: string;
  status: "STAGED" | "APPROVED" | "EXECUTED";
}

/** A change not yet confirmed by the server. */
type PendingOp = { kind: "save"; item: StagedFixItem } | { kind: "remove"; id: string };

const STORAGE_KEY_PREFIX = "growthx_staged_fixes_";
const OPS_KEY_PREFIX = "growthx_staged_ops_";
const MIGRATED_KEY_PREFIX = "growthx_staged_migrated_";

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

/**
 * Referentially stable snapshot cache.
 *
 * `useStagedFixItems` reads this store through `useSyncExternalStore`, which
 * requires `getStaged()` to return the *same* array reference until the store
 * actually changes. Returning a freshly parsed / freshly allocated array on
 * every call makes React re-render forever ("Maximum update depth exceeded")
 * and crashes the Fix Engine page.
 */
const memoryStore = new Map<string, StagedFixItem[]>();
const listeners = new Map<string, Set<() => void>>();
const pendingOps = new Map<string, PendingOp[]>();
/** Projects whose server copy has been read on this page load. */
const synced = new Set<string>();
const syncing = new Map<string, Promise<void>>();
const flushing = new Map<string, Promise<void>>();

export const EMPTY_STAGED_ITEMS: StagedFixItem[] = [];

function readJson<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore (private mode / quota)
  }
}

function readFromStorage(projectId: string): StagedFixItem[] | null {
  const parsed = readJson<unknown>(getStorageKey(projectId));
  return Array.isArray(parsed) ? (parsed as StagedFixItem[]) : null;
}

/** The browser's copy: what the screen shows now, and on the next load before the server answers. */
function writeToStorage(projectId: string, items: StagedFixItem[]) {
  memoryStore.set(projectId, items);
  writeJson(getStorageKey(projectId), items);
}

function notify(projectId: string) {
  const set = listeners.get(projectId);
  if (set) {
    set.forEach((cb) => {
      try {
        cb();
      } catch {
        // ignore
      }
    });
  }
}

// ── the queue of changes waiting for the server ─────────────────────────

function opsFor(projectId: string): PendingOp[] {
  let ops = pendingOps.get(projectId);
  if (!ops) {
    const stored = readJson<PendingOp[]>(`${OPS_KEY_PREFIX}${projectId}`);
    ops = Array.isArray(stored) ? stored : [];
    pendingOps.set(projectId, ops);
  }
  return ops;
}

function setOps(projectId: string, ops: PendingOp[]) {
  pendingOps.set(projectId, ops);
  writeJson(`${OPS_KEY_PREFIX}${projectId}`, ops);
}

const opId = (op: PendingOp) => (op.kind === "save" ? op.item.id : op.id);

/** Adds a change; a later change to the same plan replaces an earlier one still waiting. */
function enqueue(projectId: string, op: PendingOp) {
  setOps(projectId, [...opsFor(projectId).filter((o) => opId(o) !== opId(op)), op]);
}

/** A failure the server will give again on retry: drop it rather than block the queue behind it. */
function isPermanent(err: unknown): boolean {
  return err instanceof ApiError && err.status >= 400 && err.status < 500 && ![401, 408, 429].includes(err.status);
}

/** Sends waiting changes in order. Stops at the first that cannot be sent now, to retry later. */
function flush(projectId: string): Promise<void> {
  const running = flushing.get(projectId);
  if (running) return running;
  const run = (async () => {
    for (;;) {
      const [op] = opsFor(projectId);
      if (!op) return;
      try {
        if (op.kind === "save") await api.savedPlans.save(projectId, op.item);
        else await api.savedPlans.remove(projectId, op.id);
      } catch (err) {
        if (!isPermanent(err)) return;
      }
      // Only this op: another may have been queued for the same plan meanwhile.
      setOps(projectId, opsFor(projectId).filter((o) => o !== op));
    }
  })().finally(() => flushing.delete(projectId));
  flushing.set(projectId, run);
  return run;
}

/** The server's list with the changes it has not confirmed yet laid on top. */
function withPending(server: StagedFixItem[], ops: PendingOp[]): StagedFixItem[] {
  let items = server;
  for (const op of ops) {
    items = items.filter((i) => i.id !== opId(op));
    if (op.kind === "save") items = [op.item, ...items];
  }
  return [...items].sort((a, b) => b.stagedAt.localeCompare(a.stagedAt));
}

/**
 * Reads the server's copy, after uploading anything this browser saved before
 * plans lived on the server and sending changes still waiting. Once per page
 * load per project; a failure leaves the browser's copy in place.
 */
function sync(projectId: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  const running = syncing.get(projectId);
  if (running) return running;
  const run = (async () => {
    const migratedKey = `${MIGRATED_KEY_PREFIX}${projectId}`;
    if (!readJson<boolean>(migratedKey)) {
      const waiting = new Set(opsFor(projectId).map(opId));
      for (const item of readFromStorage(projectId) ?? []) {
        if (!waiting.has(item.id)) enqueue(projectId, { kind: "save", item: { ...item, projectId } });
      }
      writeJson(migratedKey, true);
    }
    await flush(projectId);
    try {
      const server = await api.savedPlans.list(projectId);
      writeToStorage(projectId, withPending(server, opsFor(projectId)));
      synced.add(projectId);
      notify(projectId);
    } catch {
      // Offline or signed out: the browser's copy stands until the next load.
    }
  })().finally(() => syncing.delete(projectId));
  syncing.set(projectId, run);
  return run;
}

function ensureSynced(projectId: string) {
  if (!synced.has(projectId)) void sync(projectId);
}

/** Records a change: on screen now, on the server as soon as it can be sent. */
function commit(projectId: string, items: StagedFixItem[], ops: PendingOp[]) {
  writeToStorage(projectId, items);
  for (const op of ops) enqueue(projectId, op);
  notify(projectId);
  void flush(projectId);
  ensureSynced(projectId);
}

let stagedIdCounter = 0;

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `staged_${Date.now()}_${++stagedIdCounter}`;
}

if (typeof window !== "undefined") {
  // Back online: send whatever waited.
  window.addEventListener("online", () => {
    for (const projectId of pendingOps.keys()) void flush(projectId);
  });
}

export const stagingEngine = {
  getStaged(projectId: string | null | undefined): StagedFixItem[] {
    if (!projectId) return EMPTY_STAGED_ITEMS;

    const cached = memoryStore.get(projectId);
    if (cached) return cached;

    // Server render: nothing is persisted, always the same empty reference.
    if (typeof window === "undefined") return EMPTY_STAGED_ITEMS;

    // First client read: the browser's copy, with changes still waiting for
    // the server applied, then served from the cache so every later call
    // returns an identical reference. The server's copy replaces it when
    // `subscribe` syncs.
    const hydrated = withPending(readFromStorage(projectId) ?? EMPTY_STAGED_ITEMS, opsFor(projectId));
    memoryStore.set(projectId, hydrated.length ? hydrated : EMPTY_STAGED_ITEMS);
    return memoryStore.get(projectId)!;
  },

  stage(projectId: string | null | undefined, item: Omit<StagedFixItem, "id" | "projectId" | "stagedAt" | "status">): StagedFixItem {
    if (!projectId) throw new Error("projectId required to stage item");
    const fullItem: StagedFixItem = {
      ...item,
      id: newId(),
      projectId,
      stagedAt: new Date().toISOString(),
      status: "STAGED",
    };

    const current = this.getStaged(projectId);
    // Deduplicate by title
    const exists = current.find((c) => c.title.toLowerCase() === fullItem.title.toLowerCase());
    if (exists) return exists;

    commit(projectId, [fullItem, ...current], [{ kind: "save", item: fullItem }]);
    return fullItem;
  },

  stageBatch(projectId: string | null | undefined, items: Array<Omit<StagedFixItem, "id" | "projectId" | "stagedAt" | "status">>): StagedFixItem[] {
    if (!projectId) return [];
    const now = new Date().toISOString();
    const current = this.getStaged(projectId);
    const existingTitles = new Set(current.map((c) => c.title.toLowerCase()));

    const created: StagedFixItem[] = [];
    for (const item of items) {
      if (existingTitles.has(item.title.toLowerCase())) continue;
      existingTitles.add(item.title.toLowerCase());
      created.push({ ...item, id: newId(), projectId, stagedAt: now, status: "STAGED" });
    }

    if (created.length === 0) return created;

    commit(
      projectId,
      [...created, ...current],
      created.map((item) => ({ kind: "save" as const, item })),
    );
    return created;
  },

  remove(projectId: string | null | undefined, id: string) {
    if (!projectId) return;
    const current = this.getStaged(projectId);
    const next = current.filter((c) => c.id !== id);
    if (next.length === current.length) return;

    commit(projectId, next, [{ kind: "remove", id }]);
  },

  /** Moves an item between to-do and done. */
  setStatus(projectId: string | null | undefined, id: string, status: StagedFixItem["status"]) {
    if (!projectId) return;
    const current = this.getStaged(projectId);
    const target = current.find((c) => c.id === id);
    if (!target || target.status === status) return;
    const updated = { ...target, status };
    commit(
      projectId,
      current.map((c) => (c.id === id ? updated : c)),
      [{ kind: "save", item: updated }],
    );
  },

  clear(projectId: string | null | undefined) {
    if (!projectId) return;
    const current = this.getStaged(projectId);
    commit(
      projectId,
      EMPTY_STAGED_ITEMS,
      current.map((c) => ({ kind: "remove" as const, id: c.id })),
    );
  },

  subscribe(projectId: string | null | undefined, callback: () => void): () => void {
    if (!projectId) return () => {};
    if (!listeners.has(projectId)) {
      listeners.set(projectId, new Set());
    }
    const set = listeners.get(projectId)!;
    set.add(callback);
    // The first screen to show a project's plans brings in the server's copy.
    ensureSynced(projectId);
    return () => {
      set.delete(callback);
    };
  },

  /** Reads the server's copy now, after sending anything waiting. For tests and a manual refresh. */
  sync,
};
