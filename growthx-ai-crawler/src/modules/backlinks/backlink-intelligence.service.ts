import { BadRequestException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { bareDomain, ownSite } from '../search-intelligence/own-site';
import {
  DataForSeoBacklinkItem,
  DataForSeoBacklinksService,
  DataForSeoReferringDomainItem,
  DataForSeoAnchorItem,
} from './dataforseo-backlinks.service';
import { BacklinksService } from './backlinks.service';
import { RecommendationService } from './recommendation.service';

export interface CompetitorLinkGapCompetitorMatch {
  competitorDomain: string;
  backlinksCount: number;
  dofollowCount: number;
  sampleSourceUrl: string | null;
  sampleTargetUrl: string | null;
  sampleAnchor: string | null;
  verifiedByReigel: boolean;
  sourceId: string | null;
}

export interface CompetitorLinkGapItem {
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
}

export interface CompetitorLinkGapResponse {
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
}

export interface BacklinkOverviewResponse {
  domain: string;
  targetKind: 'OWN' | 'COMPETITOR';
  provider: string;
  checkedAt: string;
  isCached: boolean;
  isStale: boolean;
  metrics: {
    rank: number;
    backlinks: number;
    referringDomains: number;
    referringMainDomains: number;
    referringIps: number;
    referringSubnets: number;
    referringPages: number;
    dofollow: number;
    nofollow: number;
    brokenBacklinks: number;
    brokenPages: number;
    spamScore: number | null;
  };
  breakdowns: {
    tldDistribution: Record<string, number>;
    linkTypes: Record<string, number>;
    attributes: Record<string, number>;
    platformTypes: Record<string, number>;
  };
  topReferringDomains: DataForSeoReferringDomainItem[];
  topAnchors: DataForSeoAnchorItem[];
  recentBacklinks: DataForSeoBacklinkItem[];
  costUsd: number | null;
  warning?: string;
}

@Injectable()
export class BacklinkIntelligenceService {
  private readonly logger = new Logger(BacklinkIntelligenceService.name);
  private readonly CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoBacklinksService,
    @Optional() private readonly backlinks?: BacklinksService,
    @Optional() private readonly recommendations?: RecommendationService,
  ) {}

  /**
   * Resolves target domain for a project.
   */
  private async resolveDomain(projectId: string, explicitDomain?: string): Promise<{ domain: string; targetKind: 'OWN' | 'COMPETITOR' }> {
    if (explicitDomain) {
      const clean = bareDomain(explicitDomain);
      if (!clean) throw new BadRequestException(`Invalid domain: ${explicitDomain}`);

      // Check if it's competitor
      const isCompetitor = await this.prisma.competitorDomain.findFirst({
        where: { projectId, domain: { contains: clean } },
      });
      return { domain: clean, targetKind: isCompetitor ? 'COMPETITOR' : 'OWN' };
    }

    const site = await ownSite(this.prisma, projectId);
    if (site?.website?.domain) {
      const clean = bareDomain(site.website.domain);
      if (clean) return { domain: clean, targetKind: 'OWN' };
    }

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { where: { scope: 'own' } } },
    });
    if (!project) throw new NotFoundException(`Project ${projectId} not found.`);

    const domain = project.websites[0]?.domain || project.name;
    const clean = bareDomain(domain);
    if (!clean) throw new BadRequestException(`No valid website configured for project ${projectId}.`);

    return { domain: clean, targetKind: 'OWN' };
  }

  /** GET the latest stored provider snapshot without starting a billable sync. */
  async getOverview(
    projectId: string,
    explicitDomain?: string,
    forceRefresh = false,
  ): Promise<BacklinkOverviewResponse | null> {
    const { domain, targetKind } = await this.resolveDomain(projectId, explicitDomain);

    const latest = await this.prisma.backlinkDomainSnapshot.findFirst({
      where: { projectId, domain },
      orderBy: { checkedAt: 'desc' },
    });

    if (!forceRefresh && latest) {
      return this.formatSnapshotResponse(latest, true);
    }

    if (!forceRefresh && !latest) {
      return null;
    }

    try {
      return await this.syncDomainIntelligence(projectId, domain, targetKind);
    } catch (err: any) {
      // If live call fails (e.g. 40104 unverified account) but we have a cached snapshot, return it with warning
      if (latest) {
        this.logger.warn(`DataForSEO sync failed for ${domain}; returning cached snapshot. Error: ${err.message}`);
        const response = this.formatSnapshotResponse(latest, true);
        response.warning = `Using cached data from ${latest.checkedAt.toISOString()}. Live DataForSEO refresh unavailable: ${err.message}`;
        return response;
      }
      throw err;
    }
  }

  /**
   * 2. SYNC DOMAIN INTELLIGENCE FROM DATAFORSEO
   * Calls DataForSEO summary, referring domains, backlinks list, and anchors in parallel.
   * Caches the provider result in BacklinkDomainSnapshot. Provider observations
   * are kept separate from direct Reigel source-page verification.
   */
  async syncDomainIntelligence(
    projectId: string,
    domain?: string,
    targetKind: 'OWN' | 'COMPETITOR' = 'OWN',
  ): Promise<BacklinkOverviewResponse> {
    const resolved = await this.resolveDomain(projectId, domain);
    const target = resolved.domain;
    const kind = domain ? targetKind : resolved.targetKind;

    // Parallel calls to DataForSEO live endpoints
    const [summaryRes, refDomainsRes, backlinksRes, anchorsRes] = await Promise.all([
      this.dataforseo.getDomainSummary(target),
      this.dataforseo.getReferringDomains(target, { limit: 50 }).catch((e) => {
        this.logger.warn(`Failed to fetch referring domains for ${target}: ${e.message}`);
        return { items: [], totalCount: 0, costUsd: null };
      }),
      this.dataforseo.getBacklinks(target, { limit: 100 }).catch((e) => {
        this.logger.warn(`Failed to fetch backlinks list for ${target}: ${e.message}`);
        return { items: [], totalCount: 0, costUsd: null };
      }),
      this.dataforseo.getAnchors(target, { limit: 50 }).catch((e) => {
        this.logger.warn(`Failed to fetch anchors for ${target}: ${e.message}`);
        return { items: [], totalCount: 0, costUsd: null };
      }),
    ]);

    const totalCostUsd =
      (summaryRes.costUsd ?? 0) +
      (refDomainsRes.costUsd ?? 0) +
      (backlinksRes.costUsd ?? 0) +
      (anchorsRes.costUsd ?? 0);

    // Save snapshot in database
    const snapshot = await this.prisma.backlinkDomainSnapshot.create({
      data: {
        projectId,
        domain: target,
        targetKind: kind,
        provider: 'dataforseo',
        rank: summaryRes.rank,
        backlinks: summaryRes.backlinks,
        referringDomains: summaryRes.referringDomains,
        referringMainDomains: summaryRes.referringMainDomains,
        referringIps: summaryRes.referringIps,
        referringSubnets: summaryRes.referringSubnets,
        referringPages: summaryRes.referringPages,
        dofollow: summaryRes.dofollow,
        nofollow: summaryRes.nofollow,
        brokenBacklinks: summaryRes.brokenBacklinks,
        brokenPages: summaryRes.brokenPages,
        spamScore: summaryRes.spamScore,
        topAnchors: anchorsRes.items as any,
        topReferringDomains: refDomainsRes.items as any,
        backlinksList: backlinksRes.items as any,
        rawSummary: {
          tldDistribution: summaryRes.referringLinksTld,
          linkTypes: summaryRes.referringLinksTypes,
          attributes: summaryRes.referringLinksAttributes,
          platformTypes: summaryRes.referringLinksPlatformTypes,
        } as any,
        costUsd: totalCostUsd > 0 ? totalCostUsd : null,
      },
    });

    return this.formatSnapshotResponse(snapshot, false);
  }

  /**
   * 3. GET REFERRING DOMAINS LIST
   */
  async getReferringDomains(
    projectId: string,
    explicitDomain?: string,
    options?: { limit?: number; offset?: number; forceRefresh?: boolean },
  ): Promise<{ domain: string; items: DataForSeoReferringDomainItem[]; totalCount: number }> {
    const { domain } = await this.resolveDomain(projectId, explicitDomain);
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (options?.forceRefresh) {
      const res = await this.dataforseo.getReferringDomains(domain, { limit, offset });
      return { domain, items: res.items, totalCount: res.totalCount };
    }

    const snapshot = await this.prisma.backlinkDomainSnapshot.findFirst({
      where: { projectId, domain },
      orderBy: { checkedAt: 'desc' },
    });

    if (snapshot && Array.isArray(snapshot.topReferringDomains) && snapshot.topReferringDomains.length > 0) {
      const list = snapshot.topReferringDomains as unknown as DataForSeoReferringDomainItem[];
      return {
        domain,
        items: list.slice(offset, offset + limit),
        totalCount: snapshot.referringDomains || list.length,
      };
    }

    const res = await this.dataforseo.getReferringDomains(domain, { limit, offset });
    return { domain, items: res.items, totalCount: res.totalCount };
  }

  /**
   * 4. GET DETAILED BACKLINKS LIST
   */
  async getBacklinksList(
    projectId: string,
    explicitDomain?: string,
    options?: { limit?: number; offset?: number; mode?: 'as_is' | 'one_per_domain'; forceRefresh?: boolean },
  ): Promise<{ domain: string; items: DataForSeoBacklinkItem[]; totalCount: number }> {
    const { domain } = await this.resolveDomain(projectId, explicitDomain);
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (options?.forceRefresh) {
      const res = await this.dataforseo.getBacklinks(domain, { limit, offset, mode: options?.mode });
      return { domain, items: res.items, totalCount: res.totalCount };
    }

    const snapshot = await this.prisma.backlinkDomainSnapshot.findFirst({
      where: { projectId, domain },
      orderBy: { checkedAt: 'desc' },
    });

    if (snapshot && Array.isArray(snapshot.backlinksList) && snapshot.backlinksList.length > 0) {
      const list = snapshot.backlinksList as unknown as DataForSeoBacklinkItem[];
      return {
        domain,
        items: list.slice(offset, offset + limit),
        totalCount: snapshot.backlinks || list.length,
      };
    }

    const res = await this.dataforseo.getBacklinks(domain, { limit, offset, mode: options?.mode });
    return { domain, items: res.items, totalCount: res.totalCount };
  }

  /**
   * 5. GET ANCHOR TEXT ANALYSIS
   */
  async getAnchors(
    projectId: string,
    explicitDomain?: string,
    options?: { limit?: number; offset?: number; forceRefresh?: boolean },
  ): Promise<{ domain: string; items: DataForSeoAnchorItem[]; totalCount: number }> {
    const { domain } = await this.resolveDomain(projectId, explicitDomain);
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    if (options?.forceRefresh) {
      const res = await this.dataforseo.getAnchors(domain, { limit, offset });
      return { domain, items: res.items, totalCount: res.totalCount };
    }

    const snapshot = await this.prisma.backlinkDomainSnapshot.findFirst({
      where: { projectId, domain },
      orderBy: { checkedAt: 'desc' },
    });

    if (snapshot && Array.isArray(snapshot.topAnchors) && snapshot.topAnchors.length > 0) {
      const list = snapshot.topAnchors as unknown as DataForSeoAnchorItem[];
      return {
        domain,
        items: list.slice(offset, offset + limit),
        totalCount: list.length,
      };
    }

    const res = await this.dataforseo.getAnchors(domain, { limit, offset });
    return { domain, items: res.items, totalCount: res.totalCount };
  }

  /**
   * Helper to format snapshot database record to BacklinkOverviewResponse.
   */
  private formatSnapshotResponse(snapshot: any, isCached: boolean): BacklinkOverviewResponse {
    const raw = (snapshot.rawSummary as any) || {};

    return {
      domain: snapshot.domain,
      targetKind: (snapshot.targetKind as any) || 'OWN',
      provider: snapshot.provider || 'dataforseo',
      checkedAt: snapshot.checkedAt.toISOString(),
      isCached,
      isStale: Date.now() - snapshot.checkedAt.getTime() >= this.CACHE_TTL_MS,
      metrics: {
        rank: snapshot.rank,
        backlinks: snapshot.backlinks,
        referringDomains: snapshot.referringDomains,
        referringMainDomains: snapshot.referringMainDomains,
        referringIps: snapshot.referringIps,
        referringSubnets: snapshot.referringSubnets,
        referringPages: snapshot.referringPages,
        dofollow: snapshot.dofollow,
        nofollow: snapshot.nofollow,
        brokenBacklinks: snapshot.brokenBacklinks,
        brokenPages: snapshot.brokenPages,
        spamScore: snapshot.spamScore,
      },
      breakdowns: {
        tldDistribution: raw.tldDistribution || {},
        linkTypes: raw.linkTypes || {},
        attributes: raw.attributes || {},
        platformTypes: raw.platformTypes || {},
      },
      topReferringDomains: (snapshot.topReferringDomains as any) || [],
      topAnchors: (snapshot.topAnchors as any) || [],
      recentBacklinks: (snapshot.backlinksList as any) || [],
      costUsd: snapshot.costUsd,
    };
  }

  /**
   * 6. COMPETITOR BACKLINK INTERSECT ("LINK GAP" FINDER)
   * Compares the project's own referring domains against tracked competitors'
   * referring domains across stored DataForSEO snapshots, Reigel verified/observed
   * backlinks, and the public archive index.
   */
  async getCompetitorLinkGap(
    projectId: string,
    options?: { forceRefresh?: boolean; competitorDomain?: string },
  ): Promise<CompetitorLinkGapResponse> {
    if (options?.forceRefresh) {
      return this.syncCompetitorLinkGap(projectId, options.competitorDomain);
    }

    const { domain: ownDomain } = await this.resolveDomain(projectId);

    const [savedCompetitors, scopedWebsites] = await Promise.all([
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { domain: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.website.findMany({
        where: { scope: `competitor:${projectId}` },
        select: { domain: true },
      }),
    ]);

    const competitorSet = new Set<string>();
    for (const row of [...savedCompetitors, ...scopedWebsites]) {
      const clean = bareDomain(row.domain);
      if (clean && clean !== ownDomain) {
        competitorSet.add(clean);
      }
    }
    if (options?.competitorDomain) {
      const explicitClean = bareDomain(options.competitorDomain);
      if (explicitClean && explicitClean !== ownDomain) {
        competitorSet.add(explicitClean);
      }
    }
    const competitorDomains = [...competitorSet];
    const allTargetDomains = [ownDomain, ...competitorDomains];

    // Fetch latest snapshots for own + competitors, monitored sources/links, and public archive edges
    const [snapshots, monitoredLinks, publicEdges, projectSources] = await Promise.all([
      this.prisma.backlinkDomainSnapshot.findMany({
        where: { projectId, domain: { in: allTargetDomains } },
        orderBy: { checkedAt: 'desc' },
      }),
      this.prisma.backlink.findMany({
        where: {
          source: { projectId },
          status: { not: 'OUT_OF_SCOPE' },
        },
        include: {
          source: {
            select: { id: true, sourceUrl: true, status: true, discovery: true },
          },
        },
        take: 3000,
      }),
      competitorDomains.length > 0
        ? this.prisma.publicBacklinkEdge.findMany({
            where: { targetRoot: { in: allTargetDomains } },
            orderBy: { indexedAt: 'desc' },
            take: 1500,
          })
        : Promise.resolve([]),
      this.prisma.backlinkSource.findMany({
        where: { projectId },
        select: { id: true, sourceUrl: true },
        take: 1000,
      }),
    ]);

    const sourceUrlToId = new Map<string, string>();
    for (const src of projectSources) {
      sourceUrlToId.set(src.sourceUrl, src.id);
    }

    // Latest snapshot per domain
    const latestSnapshotByDomain = new Map<string, any>();
    for (const snap of snapshots) {
      const d = bareDomain(snap.domain) || snap.domain;
      if (!latestSnapshotByDomain.has(d)) {
        latestSnapshotByDomain.set(d, snap);
      }
    }

    // 1. Build set of referring domains already linking to OWN domain
    const ownRefDomains = new Set<string>();
    const ownSnap = latestSnapshotByDomain.get(ownDomain);
    if (ownSnap) {
      const topRefs = Array.isArray(ownSnap.topReferringDomains)
        ? (ownSnap.topReferringDomains as DataForSeoReferringDomainItem[])
        : [];
      for (const r of topRefs) {
        const clean = bareDomain(r.domain);
        if (clean) ownRefDomains.add(clean);
      }
      const linksList = Array.isArray(ownSnap.backlinksList)
        ? (ownSnap.backlinksList as DataForSeoBacklinkItem[])
        : [];
      for (const l of linksList) {
        const clean = bareDomain(l.domainFrom || l.urlFrom);
        if (clean) ownRefDomains.add(clean);
      }
    }

    for (const link of monitoredLinks) {
      if (link.targetKind === 'OWN' && link.status !== 'LOST') {
        const clean = bareDomain(link.source.sourceUrl);
        if (clean) ownRefDomains.add(clean);
      }
    }

    for (const edge of publicEdges) {
      const targetClean = bareDomain(edge.targetRoot || edge.targetUrl);
      if (targetClean === ownDomain) {
        const clean = bareDomain(edge.sourceUrl);
        if (clean) ownRefDomains.add(clean);
      }
    }

    const excludedDomains = new Set<string>([ownDomain, ...competitorDomains]);

    // 2. Aggregate competitor referring domains
    type GapAccumulator = {
      referringDomain: string;
      maxRank: number | null;
      firstSeen: string | null;
      dataSources: Set<'DATAFORSEO' | 'REIGEL_CRAWL' | 'PUBLIC_ARCHIVE'>;
      byCompetitor: Map<string, CompetitorLinkGapCompetitorMatch>;
    };

    const gapMap = new Map<string, GapAccumulator>();
    const competitorRefCounts = new Map<string, Set<string>>();
    for (const comp of competitorDomains) {
      competitorRefCounts.set(comp, new Set<string>());
    }

    const getOrCreateAcc = (refDomain: string): GapAccumulator => {
      let acc = gapMap.get(refDomain);
      if (!acc) {
        acc = {
          referringDomain: refDomain,
          maxRank: null,
          firstSeen: null,
          dataSources: new Set(),
          byCompetitor: new Map(),
        };
        gapMap.set(refDomain, acc);
      }
      return acc;
    };

    const getOrCreateCompMatch = (
      acc: GapAccumulator,
      compDomain: string,
    ): CompetitorLinkGapCompetitorMatch => {
      let match = acc.byCompetitor.get(compDomain);
      if (!match) {
        match = {
          competitorDomain: compDomain,
          backlinksCount: 0,
          dofollowCount: 0,
          sampleSourceUrl: null,
          sampleTargetUrl: null,
          sampleAnchor: null,
          verifiedByReigel: false,
          sourceId: null,
        };
        acc.byCompetitor.set(compDomain, match);
      }
      return match;
    };

    // Source A: DataForSEO Snapshots for Competitors
    for (const compDomain of competitorDomains) {
      const snap = latestSnapshotByDomain.get(compDomain);
      if (!snap) continue;
      const compSet = competitorRefCounts.get(compDomain)!;

      const topRefs = Array.isArray(snap.topReferringDomains)
        ? (snap.topReferringDomains as DataForSeoReferringDomainItem[])
        : [];
      for (const r of topRefs) {
        const refDomain = bareDomain(r.domain);
        if (!refDomain || excludedDomains.has(refDomain)) continue;
        compSet.add(refDomain);
        if (ownRefDomains.has(refDomain)) continue;

        const acc = getOrCreateAcc(refDomain);
        acc.dataSources.add('DATAFORSEO');
        if (typeof r.rank === 'number' && (acc.maxRank === null || r.rank > acc.maxRank)) {
          acc.maxRank = r.rank;
        }
        if (r.firstSeen && (!acc.firstSeen || r.firstSeen < acc.firstSeen)) {
          acc.firstSeen = r.firstSeen;
        }
        const match = getOrCreateCompMatch(acc, compDomain);
        match.backlinksCount = Math.max(match.backlinksCount, Number(r.backlinks || 1));
        match.dofollowCount = Math.max(match.dofollowCount, Number(r.dofollowBacklinks || 0));
      }

      const linksList = Array.isArray(snap.backlinksList)
        ? (snap.backlinksList as DataForSeoBacklinkItem[])
        : [];
      for (const l of linksList) {
        const refDomain = bareDomain(l.domainFrom || l.urlFrom);
        if (!refDomain || excludedDomains.has(refDomain)) continue;
        compSet.add(refDomain);
        if (ownRefDomains.has(refDomain)) continue;

        const acc = getOrCreateAcc(refDomain);
        acc.dataSources.add('DATAFORSEO');
        const linkRank = Number(l.domainFromRank || l.rank || 0);
        if (linkRank > 0 && (acc.maxRank === null || linkRank > acc.maxRank)) {
          acc.maxRank = linkRank;
        }
        if (l.firstSeen && (!acc.firstSeen || l.firstSeen < acc.firstSeen)) {
          acc.firstSeen = l.firstSeen;
        }
        const match = getOrCreateCompMatch(acc, compDomain);
        if (match.backlinksCount === 0) match.backlinksCount = 1;
        if (l.dofollow && match.dofollowCount === 0) match.dofollowCount = 1;
        if (!match.sampleSourceUrl && l.urlFrom) {
          match.sampleSourceUrl = l.urlFrom;
          match.sourceId = sourceUrlToId.get(l.urlFrom) ?? null;
        }
        if (!match.sampleTargetUrl && l.urlTo) {
          match.sampleTargetUrl = l.urlTo;
        }
        if (!match.sampleAnchor && l.anchor) {
          match.sampleAnchor = l.anchor;
        }
      }
    }

    // Source B: Reigel Monitored / Verified Backlinks
    for (const link of monitoredLinks) {
      if (link.targetKind !== 'COMPETITOR') continue;
      const compDomain = bareDomain(link.targetHost || link.targetUrl);
      const refDomain = bareDomain(link.source.sourceUrl);
      if (!compDomain || !refDomain || excludedDomains.has(refDomain)) continue;

      if (!competitorRefCounts.has(compDomain)) {
        competitorRefCounts.set(compDomain, new Set());
      }
      competitorRefCounts.get(compDomain)!.add(refDomain);

      if (ownRefDomains.has(refDomain)) continue;

      const acc = getOrCreateAcc(refDomain);
      acc.dataSources.add('REIGEL_CRAWL');
      const firstObs = link.firstObservedAt?.toISOString() ?? null;
      if (firstObs && (!acc.firstSeen || firstObs < acc.firstSeen)) {
        acc.firstSeen = firstObs;
      }

      const match = getOrCreateCompMatch(acc, compDomain);
      match.backlinksCount = Math.max(match.backlinksCount, 1);
      if (link.followState === 'FOLLOWED') {
        match.dofollowCount = Math.max(match.dofollowCount, 1);
      }
      if (link.status === 'VERIFIED') {
        match.verifiedByReigel = true;
      }
      if (!match.sampleSourceUrl || link.status === 'VERIFIED') {
        match.sampleSourceUrl = link.source.sourceUrl;
        match.sourceId = link.source.id;
      }
      if (!match.sampleTargetUrl) {
        match.sampleTargetUrl = link.targetUrl;
      }
      if (!match.sampleAnchor && link.anchorText) {
        match.sampleAnchor = link.anchorText;
      }
    }

    // Source C: Public Backlink Archive Index
    for (const edge of publicEdges) {
      const compDomain = bareDomain(edge.targetRoot || edge.targetUrl);
      const refDomain = bareDomain(edge.sourceUrl);
      if (!compDomain || compDomain === ownDomain || !refDomain || excludedDomains.has(refDomain)) {
        continue;
      }
      if (!competitorRefCounts.has(compDomain)) {
        competitorRefCounts.set(compDomain, new Set());
      }
      competitorRefCounts.get(compDomain)!.add(refDomain);

      if (ownRefDomains.has(refDomain)) continue;

      const acc = getOrCreateAcc(refDomain);
      acc.dataSources.add('PUBLIC_ARCHIVE');
      const idxAt = edge.indexedAt?.toISOString() ?? null;
      if (idxAt && (!acc.firstSeen || idxAt < acc.firstSeen)) {
        acc.firstSeen = idxAt;
      }

      const match = getOrCreateCompMatch(acc, compDomain);
      match.backlinksCount = Math.max(match.backlinksCount, 1);
      if (!match.sampleSourceUrl) {
        match.sampleSourceUrl = edge.sourceUrl;
        match.sourceId = sourceUrlToId.get(edge.sourceUrl) ?? null;
      }
      if (!match.sampleTargetUrl) {
        match.sampleTargetUrl = edge.targetUrl;
      }
    }

    // Format and sort Link Gap items
    const items: CompetitorLinkGapItem[] = [...gapMap.values()].map((acc) => {
      const competitorsLinked = [...acc.byCompetitor.values()];
      const totalCompetitorLinks = competitorsLinked.reduce((s, c) => s + c.backlinksCount, 0);
      const dofollowCount = competitorsLinked.reduce((s, c) => s + c.dofollowCount, 0);
      const withUrl =
        competitorsLinked.find((c) => c.verifiedByReigel && c.sampleSourceUrl) ||
        competitorsLinked.find((c) => c.sampleSourceUrl) ||
        null;

      return {
        referringDomain: acc.referringDomain,
        maxRank: acc.maxRank,
        totalCompetitorLinks,
        dofollowCount,
        competitorOverlapCount: competitorsLinked.length,
        competitorsLinked,
        sampleSourceUrl: withUrl?.sampleSourceUrl ?? null,
        sampleTargetUrl: withUrl?.sampleTargetUrl ?? null,
        existingSourceId: withUrl?.sourceId ?? null,
        dataSources: [...acc.dataSources],
        firstSeen: acc.firstSeen,
      };
    });

    items.sort((a, b) => {
      if (b.competitorOverlapCount !== a.competitorOverlapCount) {
        return b.competitorOverlapCount - a.competitorOverlapCount;
      }
      const aVerified = a.competitorsLinked.some((c) => c.verifiedByReigel) ? 1 : 0;
      const bVerified = b.competitorsLinked.some((c) => c.verifiedByReigel) ? 1 : 0;
      if (bVerified !== aVerified) return bVerified - aVerified;
      const aRank = a.maxRank ?? -1;
      const bRank = b.maxRank ?? -1;
      if (bRank !== aRank) return bRank - aRank;
      return b.totalCompetitorLinks - a.totalCompetitorLinks;
    });

    const trackedCompetitors = competitorDomains.map((domain) => {
      const snap = latestSnapshotByDomain.get(domain);
      const observedCount = competitorRefCounts.get(domain)?.size ?? 0;
      return {
        domain,
        hasProviderSnapshot: Boolean(snap),
        snapshotCheckedAt: snap ? snap.checkedAt.toISOString() : null,
        referringDomainsCount: Math.max(snap?.referringDomains ?? 0, observedCount),
      };
    });

    return {
      ownDomain,
      ownReferringDomainsCount: Math.max(ownSnap?.referringDomains ?? 0, ownRefDomains.size),
      trackedCompetitors,
      totalGapDomains: items.length,
      multiCompetitorOverlapCount: items.filter((i) => i.competitorOverlapCount >= 2).length,
      verifiedGapSourcesCount: items.filter((i) =>
        i.competitorsLinked.some((c) => c.verifiedByReigel),
      ).length,
      items: items.slice(0, 200),
      checkedAt: new Date().toISOString(),
    };
  }

  /**
   * 7. SYNC COMPETITOR LINK GAP (REAL CRAWL + DATAFORSEO + CANDIDATE IMPORT)
   * Discovers external links from completed website/competitor crawls, refreshes
   * DataForSEO snapshots for own domain and tracked competitors (when configured),
   * and imports concrete competitor referring URLs into BacklinkSource for 1-click outreach.
   */
  async syncCompetitorLinkGap(
    projectId: string,
    explicitCompetitorDomain?: string,
  ): Promise<CompetitorLinkGapResponse> {
    const warnings: string[] = [];
    const { domain: ownDomain } = await this.resolveDomain(projectId);

    // Step 1: Discover external links from completed website & competitor crawls
    if (this.backlinks) {
      try {
        await this.backlinks.discover(projectId);
      } catch (err: any) {
        this.logger.warn(`Crawl backlink discovery skipped during gap sync: ${err.message}`);
      }
    }

    // Step 2: Determine competitor domains to sync
    const savedCompetitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { domain: true },
      orderBy: { createdAt: 'asc' },
      take: 5,
    });
    const targetsToSync = explicitCompetitorDomain
      ? [bareDomain(explicitCompetitorDomain)].filter((d): d is string => Boolean(d))
      : savedCompetitors
          .map((c) => bareDomain(c.domain))
          .filter((d): d is string => Boolean(d && d !== ownDomain))
          .slice(0, 3);

    // Step 3: Sync DataForSEO snapshots if configured
    if (this.dataforseo.isConfigured()) {
      const ownLatest = await this.prisma.backlinkDomainSnapshot.findFirst({
        where: { projectId, domain: ownDomain },
        orderBy: { checkedAt: 'desc' },
      });
      if (!ownLatest || Date.now() - ownLatest.checkedAt.getTime() >= this.CACHE_TTL_MS) {
        try {
          await this.syncDomainIntelligence(projectId, ownDomain, 'OWN');
        } catch (err: any) {
          warnings.push(`Own domain (${ownDomain}) live DataForSEO sync skipped: ${err.message}`);
        }
      }

      for (const compDomain of targetsToSync) {
        try {
          await this.syncDomainIntelligence(projectId, compDomain, 'COMPETITOR');
        } catch (err: any) {
          warnings.push(`Competitor (${compDomain}) live DataForSEO sync skipped: ${err.message}`);
        }
      }
    } else {
      warnings.push(
        'DataForSEO credentials are not configured; showing Link Gap from Reigel crawl evidence and public archive index.',
      );
    }

    const gap = await this.getCompetitorLinkGap(projectId, {
      competitorDomain: explicitCompetitorDomain,
    });

    // Step 4: Auto-import top concrete competitor referring URLs into BacklinkSource so they are ready for analysis
    if (this.backlinks && gap.items.length > 0) {
      const importablePairs = gap.items
        .filter((i) => i.sampleSourceUrl && i.sampleTargetUrl && !i.existingSourceId)
        .slice(0, 25);
      if (importablePairs.length > 0) {
        const csv = [
          'sourceUrl,targetUrl',
          ...importablePairs.map(
            (i) => `${JSON.stringify(i.sampleSourceUrl)},${JSON.stringify(i.sampleTargetUrl)}`,
          ),
        ].join('\n');
        try {
          await this.backlinks.import(projectId, csv, 'DATAFORSEO');
        } catch {
          // Non-fatal if source cap reached or URL rejected
        }
      }
    }

    const refreshedGap = await this.getCompetitorLinkGap(projectId, {
      competitorDomain: explicitCompetitorDomain,
    });
    if (warnings.length > 0) {
      refreshedGap.warning = warnings.join(' ');
    }
    return refreshedGap;
  }

  /**
   * 8. IMPORT & ANALYZE A LINK GAP SOURCE FOR 1-CLICK OUTREACH
   * Ensures the referring page is registered in BacklinkSource for this project,
   * runs Reigel live HTML article & gap analysis, and returns the sourceId + analysis.
   */
  async importAndAnalyzeGapSource(
    projectId: string,
    body: { sourceUrl: string; targetUrl?: string },
  ) {
    if (!body?.sourceUrl) {
      throw new BadRequestException('A valid referring page URL (sourceUrl) is required.');
    }

    if (this.backlinks) {
      const csv = body.targetUrl
        ? `sourceUrl,targetUrl\n${JSON.stringify(body.sourceUrl)},${JSON.stringify(body.targetUrl)}`
        : body.sourceUrl;
      try {
        await this.backlinks.import(projectId, csv, 'MANUAL');
      } catch (err: any) {
        this.logger.warn(`Import warning for ${body.sourceUrl}: ${err.message}`);
      }
    }

    const source = await this.prisma.backlinkSource.findFirst({
      where: {
        projectId,
        sourceUrl: body.sourceUrl,
      },
      select: { id: true, sourceUrl: true },
    });

    if (!source) {
      throw new BadRequestException(
        `Could not register referring page ${body.sourceUrl} as an external backlink source.`,
      );
    }

    if (!this.recommendations) {
      return {
        sourceId: source.id,
        sourceUrl: source.sourceUrl,
        state: 'IMPORTED',
        analysis: null,
      };
    }

    const analysisResult = await this.recommendations.analyze(projectId, source.id);
    return {
      sourceId: source.id,
      sourceUrl: source.sourceUrl,
      ...analysisResult,
    };
  }
}
