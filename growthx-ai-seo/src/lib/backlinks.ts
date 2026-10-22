export type BacklinkReadiness = { state: 'READY' | 'NEEDS_FIX' | 'UNKNOWN'; reason: string; checkedAt: string | null };
export type BacklinkEvidence = { targetUrl: string; targetHost: string; targetKind: 'OWN' | 'COMPETITOR'; anchorText: string; rel: string[] };
export type BacklinkObservation = {
  id: string; checkedAt: string; outcome: string; statusCode: number | null; finalUrl: string | null;
  reason: string; contentHash: string | null; evidence: BacklinkEvidence[];
};
export type BacklinkSource = {
  id: string; sourceUrl: string; discovery: string; status: string; lastAttemptAt: string | null; nextCheckAt: string;
  links: Array<{
    id: string; targetUrl: string; targetKind: 'OWN' | 'COMPETITOR'; status: string; anchorText: string | null;
    rel: string[]; firstObservedAt: string | null; lastVerifiedAt: string | null; fresh: boolean; readiness: BacklinkReadiness | null;
  }>;
  observations: Array<Pick<BacklinkObservation, 'id' | 'reason'>>;
  _count: { links: number };
};
export type BacklinkReport = {
  coverage: string; ownDomains: string[]; competitorDomains: string[]; offset: number; pageSize: number;
  limits: { sources: number; importRows: number; linksPerSourceShown: number; graphRows: number; graphTruncated: boolean };
  queue: { available: boolean; workers: number; waiting: number; active: number; reason: string | null };
  summary: { totalSources: number; verifiedLinks: number; referringDomains: number; confirmedLostLinks: number; openActions: number };
  sources: BacklinkSource[];
  prospects: Array<{ targetUrl: string; targetKind: string; source: { id: string; sourceUrl: string } }>;
  opportunities: Array<{
    id: string; title: string; summary: string; recommendedAction: string; lifecycle: string; detailRef: string;
    evidence: Array<{ label: string; value: string; source: string }>;
  }>;
};
export type BacklinkHistory = { id: string; sourceUrl: string; offset: number; observations: BacklinkObservation[] };
export type BacklinkMutationResult = { message?: string; added?: number; submitted?: number; duplicates?: number; scheduled?: number; reconciled?: number };
