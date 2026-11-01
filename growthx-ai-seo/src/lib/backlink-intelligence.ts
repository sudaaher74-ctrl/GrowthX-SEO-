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
