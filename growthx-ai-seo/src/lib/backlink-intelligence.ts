export type DataForSeoBacklinkItem = {
  urlFrom: string; urlTo: string; domainFrom: string; tldFrom: string; anchor: string | null;
  textPre: string | null; textPost: string | null; dofollow: boolean; rank: number; pageFromRank: number;
  domainFromRank: number; spamScore: number | null; firstSeen: string | null; lastSeen: string | null;
  isBroken: boolean; isNew: boolean; isLost: boolean; linkType: string;
};
export type DataForSeoReferringDomainItem = {
  domain: string; rank: number; backlinks: number; dofollowBacklinks: number; firstSeen: string | null;
  lostDate: string | null; spamScore: number | null; brokenBacklinks: number; brokenPages: number;
};
export type DataForSeoAnchorItem = {
  anchor: string; backlinks: number; referringDomains: number; referringPages: number;
  firstSeen: string | null; lastSeen: string | null; spamScore: number | null; brokenBacklinks: number;
};

export type BacklinkOverviewResponse = {
  domain: string;
  targetKind: 'OWN' | 'COMPETITOR';
  provider: string;
  checkedAt: string;
  isCached: boolean;
  isStale: boolean;
  metrics: {
    rank: number; backlinks: number; referringDomains: number; referringMainDomains: number;
    referringIps: number; referringSubnets: number; referringPages: number; dofollow: number;
    nofollow: number; brokenBacklinks: number; brokenPages: number; spamScore: number | null;
  };
  breakdowns: { tldDistribution: Record<string, number>; linkTypes: Record<string, number>; attributes: Record<string, number>; platformTypes: Record<string, number> };
  topReferringDomains: DataForSeoReferringDomainItem[];
  topAnchors: DataForSeoAnchorItem[];
  recentBacklinks: DataForSeoBacklinkItem[];
  costUsd: number | null;
  warning?: string;
};

export type CompetitorLinkGapCompetitorMatch = {
  competitorDomain: string;
  backlinksCount: number;
  dofollowCount: number;
  sampleSourceUrl: string | null;
  sampleTargetUrl: string | null;
  sampleAnchor: string | null;
  verifiedByReigel: boolean;
  sourceId: string | null;
};

export type CompetitorLinkGapItem = {
  referringDomain: string;
  maxRank: number | null;
  totalCompetitorLinks: number;
  dofollowCount: number;
  competitorOverlapCount: number;
  competitorsLinked: CompetitorLinkGapCompetitorMatch[];
  sampleSourceUrl: string | null;
  sampleTargetUrl: string | null;
  existingSourceId: string | null;
  dataSources: Array<'DATAFORSEO' | 'REIGEL_CRAWL' | 'PUBLIC_ARCHIVE'>;
  firstSeen: string | null;
};

export type CompetitorLinkGapResponse = {
  ownDomain: string;
  ownReferringDomainsCount: number;
  trackedCompetitors: Array<{
    domain: string;
    hasProviderSnapshot: boolean;
    snapshotCheckedAt: string | null;
    referringDomainsCount: number;
  }>;
  totalGapDomains: number;
  multiCompetitorOverlapCount: number;
  verifiedGapSourcesCount: number;
  items: CompetitorLinkGapItem[];
  checkedAt: string;
  warning?: string;
};
