"use client";

/**
 * Staging Engine for GrowthX-SEO Platform
 *
 * Bridges the gap between Competitor Intelligence / AI Visibility and the Fix Engine.
 * Staged items (keyword gaps, content briefs, schema fixes, prompt gaps) are persisted
 * per project and merged into the Fix Engine's 30-day autonomous execution plan.
 */

export type StagedSourceType =
  | "COMPETITOR_KEYWORD"
  | "COMPETITOR_CONTENT"
  | "COMPETITOR_INTERCEPT"
  | "AI_VISIBILITY"
  | "TECHNICAL_AUDIT"
  | "AUTHORITY_GAP";

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

const STORAGE_KEY_PREFIX = "growthx_staged_fixes_";

function getStorageKey(projectId: string): string {
  return `${STORAGE_KEY_PREFIX}${projectId}`;
}

const memoryStore = new Map<string, StagedFixItem[]>();
const listeners = new Map<string, Set<() => void>>();

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

let stagedIdCounter = 0;

export const stagingEngine = {
  getStaged(projectId: string | null | undefined): StagedFixItem[] {
    if (!projectId) return [];
    if (typeof window === "undefined") {
      return memoryStore.get(projectId) || [];
    }
    try {
      const raw = localStorage.getItem(getStorageKey(projectId));
      if (!raw) return memoryStore.get(projectId) || [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return memoryStore.get(projectId) || [];
    }
  },

  stage(projectId: string | null | undefined, item: Omit<StagedFixItem, "id" | "projectId" | "stagedAt" | "status">): StagedFixItem {
    if (!projectId) throw new Error("projectId required to stage item");
    const id = `staged_${Date.now()}_${++stagedIdCounter}`;
    const fullItem: StagedFixItem = {
      ...item,
      id,
      projectId,
      stagedAt: new Date().toISOString(),
      status: "STAGED",
    };

    const current = this.getStaged(projectId);
    // Deduplicate by title
    const exists = current.find((c) => c.title.toLowerCase() === fullItem.title.toLowerCase());
    const next = exists ? current : [fullItem, ...current];

    memoryStore.set(projectId, next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    notify(projectId);
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
      const fullItem: StagedFixItem = {
        ...item,
        id: `staged_${Date.now()}_${++stagedIdCounter}`,
        projectId,
        stagedAt: now,
        status: "STAGED",
      };
      created.push(fullItem);
    }

    const next = [...created, ...current];
    memoryStore.set(projectId, next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    notify(projectId);
    return created;
  },

  remove(projectId: string | null | undefined, id: string) {
    if (!projectId) return;
    const current = this.getStaged(projectId);
    const next = current.filter((c) => c.id !== id);
    memoryStore.set(projectId, next);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(getStorageKey(projectId), JSON.stringify(next));
      } catch {
        // ignore
      }
    }
    notify(projectId);
  },

  clear(projectId: string | null | undefined) {
    if (!projectId) return;
    memoryStore.delete(projectId);
    if (typeof window !== "undefined") {
      try {
        localStorage.removeItem(getStorageKey(projectId));
      } catch {
        // ignore
      }
    }
    notify(projectId);
  },

  subscribe(projectId: string | null | undefined, callback: () => void): () => void {
    if (!projectId) return () => {};
    if (!listeners.has(projectId)) {
      listeners.set(projectId, new Set());
    }
    const set = listeners.get(projectId)!;
    set.add(callback);
    return () => {
      set.delete(callback);
    };
  },
};
