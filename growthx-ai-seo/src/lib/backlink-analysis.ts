import type { BacklinkReadiness } from './backlinks';

export type BacklinkFilters = { offset?: number; targetKind?: string; status?: string; followState?: string; linkType?: string; placement?: string; freshness?: string; sort?: string; search?: string };
export type ExploredBacklink = {
  id: string; targetUrl: string; targetKind: string; status: string; anchorText: string | null; rel: string[];
  followState: string; linkTypes: string[]; placements: string[]; firstObservedAt: string | null; lastVerifiedAt: string | null;
  lastChangedAt: string | null; lostConfirmedAt: string | null; referringDomain: string; fresh: boolean;
  readiness: BacklinkReadiness | null; source: { id: string; sourceUrl: string; discovery: string; lastAttemptAt: string | null };
};
export type BacklinkExplorer = { total: number; offset: number; pageSize: number; links: ExploredBacklink[] };
export type BacklinkExport = { filename: string; csv: string; total: number; exported: number; truncated: boolean; coverage: string };
export type BacklinkChanges = {
  total: number; offset: number; pageSize: number;
  events: Array<{ id: string; kind: string; occurredAt: string; before: Record<string, unknown>; after: Record<string, unknown>;
    backlink: { targetUrl: string; targetKind: string; source: { sourceUrl: string } } }>;
};
type Aggregate = { links: number; firstObservedAt: string | null; lastVerifiedAt: string | null };
export type BacklinkProfile = {
  days: number; since: string; measuredAt: string; coverage: string; historyLimited: boolean;
  authority: { available: boolean; reason: string };
  counts: { tracked: number; observed: number; verified: number; referringDomains: number; confirmedLost: number; newlyObserved: number; followed: number; qualified: number; mixed: number; unclassified: number };
  anchors: Array<Aggregate & { anchor: string; referringDomains: number; share: number }>;
  topPages: Array<Aggregate & { targetUrl: string; referringDomains: number; followed: number; readiness: BacklinkReadiness }>;
  referringDomains: Array<Aggregate & { domain: string; sourcePages: number; followed: number }>;
  competitors: string[];
  intersectionLimited: boolean;
  intersection: Array<{ domain: string; ownLinks: number; competitorsCount: number; competitors: Record<string, number> }>;
  timeline: Array<{ date: string; found: number; lost: number; recovered: number; changed: number }>;
  limits: { tableRows: number; exportRows: number; eventRetentionDays: number; eventsPerSource: number };
};
