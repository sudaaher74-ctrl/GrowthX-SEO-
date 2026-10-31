import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { bareDomain, ownSite } from '../search-intelligence/own-site';
import {
  DataForSeoBacklinkItem,
  DataForSeoBacklinksError,
  DataForSeoBacklinksService,
  DataForSeoReferringDomainItem,
  DataForSeoAnchorItem,
} from './dataforseo-backlinks.service';
import { hostOf, kindOf } from './backlink-evidence';

export interface BacklinkOverviewResponse {
  domain: string;
  targetKind: 'OWN' | 'COMPETITOR';
  provider: string;
  checkedAt: string;
  isCached: boolean;
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

  /**
   * 1. GET TARGET DOMAIN OVERVIEW
   * Returns cached snapshot if available within TTL, otherwise calls DataForSEO.
   */
  async getOverview(
    projectId: string,
    explicitDomain?: string,
    forceRefresh = false,
  ): Promise<BacklinkOverviewResponse> {
    const { domain, targetKind } = await this.resolveDomain(projectId, explicitDomain);

    const latest = await this.prisma.backlinkDomainSnapshot.findFirst({
      where: { projectId, domain },
      orderBy: { checkedAt: 'desc' },
    });

    const isFresh = latest && Date.now() - latest.checkedAt.getTime() < this.CACHE_TTL_MS;

    if (!forceRefresh && latest && isFresh) {
      return this.formatSnapshotResponse(latest, true);
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
   * Caches results in BacklinkDomainSnapshot and syncs links into BacklinkSource & Backlink.
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

    // Synchronize newly discovered backlinks into BacklinkSource and Backlink
    this.ingestBacklinksToProjectDatabase(projectId, backlinksRes.items, targetKind).catch((err) => {
      this.logger.warn(`Background ingestion of DataForSEO backlinks for ${target} failed: ${err.message}`);
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
   * Ingests DataForSEO discovered backlinks into the project's native BacklinkSource and Backlink tables.
   */
  private async ingestBacklinksToProjectDatabase(
    projectId: string,
    items: DataForSeoBacklinkItem[],
    targetKind: 'OWN' | 'COMPETITOR',
  ): Promise<void> {
    if (!items.length) return;

    for (const item of items.slice(0, 50)) {
      if (!item.urlFrom || !item.urlTo) continue;

      try {
        let origin: string;
        try {
          origin = new URL(item.urlFrom).origin;
        } catch {
          origin = `https://${item.domainFrom}`;
        }

        const source = await this.prisma.backlinkSource.upsert({
          where: { projectId_sourceUrl: { projectId, sourceUrl: item.urlFrom } },
          create: {
            projectId,
            sourceUrl: item.urlFrom,
            origin,
            discovery: 'DATAFORSEO',
            status: 'VERIFIED',
            lastAttemptAt: item.lastSeen ? new Date(item.lastSeen) : new Date(),
          },
          update: {
            lastAttemptAt: item.lastSeen ? new Date(item.lastSeen) : new Date(),
          },
        });

        await this.prisma.backlink.upsert({
          where: { sourceId_targetUrl: { sourceId: source.id, targetUrl: item.urlTo } },
          create: {
            sourceId: source.id,
            targetUrl: item.urlTo,
            targetHost: hostOf(item.urlTo),
            targetKind,
            status: item.isBroken ? 'LOST' : 'VERIFIED',
            anchorText: item.anchor,
            followState: item.dofollow ? 'FOLLOW' : 'NOFOLLOW',
            firstObservedAt: item.firstSeen ? new Date(item.firstSeen) : new Date(),
            lastVerifiedAt: item.lastSeen ? new Date(item.lastSeen) : new Date(),
          },
          update: {
            anchorText: item.anchor,
            followState: item.dofollow ? 'FOLLOW' : 'NOFOLLOW',
            lastVerifiedAt: item.lastSeen ? new Date(item.lastSeen) : new Date(),
            status: item.isBroken ? 'LOST' : 'VERIFIED',
          },
        });
      } catch (err: any) {
        // Continue processing other rows
      }
    }
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
}
