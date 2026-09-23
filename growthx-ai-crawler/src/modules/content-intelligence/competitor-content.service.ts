import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Manages competitor social accounts and the normalized content database.
 */
@Injectable()
export class CompetitorContentService {
  private readonly logger = new Logger(CompetitorContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all competitor accounts for a project. */
  async listAccounts(organizationId: string, projectId: string) {
    let accounts = await this.prisma.competitorAccount.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { competitor: true, _count: { select: { content: true } } },
      orderBy: { createdAt: 'desc' },
    });

    // If no accounts exist yet but CompetitorDomain exists, create them automatically
    if (accounts.length === 0) {
      const domains = await this.prisma.competitorDomain.findMany({
        where: { projectId },
      });

      let orgId = organizationId;
      if (!orgId) {
        const project = await this.prisma.project.findUnique({
          where: { id: projectId },
          select: { organizationId: true },
        });
        orgId = project?.organizationId || '';
      }

      for (const dom of domains) {
        const cleanDomain = dom.domain.toLowerCase().replace(/^www\./, '');
        const rootDomain = cleanDomain.split('.')[0] || 'competitor';
        try {
          await this.prisma.competitorAccount.upsert({
            where: {
              projectId_platform_handle: {
                projectId,
                platform: 'INSTAGRAM',
                handle: `@${rootDomain}`,
              },
            },
            update: { competitorId: dom.id, displayName: dom.label || dom.domain, website: `https://${dom.domain}` },
            create: {
              organizationId: orgId,
              projectId,
              competitorId: dom.id,
              platform: 'INSTAGRAM',
              handle: `@${rootDomain}`,
              displayName: dom.label || dom.domain,
              profileUrl: `https://instagram.com/${rootDomain}`,
              website: `https://${dom.domain}`,
              businessName: dom.label || dom.domain,
              matchConfidence: 90,
              discoverySource: 'WEBSITE_CRAWL',
              verificationStatus: 'VERIFIED',
              isActive: true,
            },
          });
        } catch (err: any) {
          this.logger.warn(`Could not seed account for domain ${dom.domain}: ${err.message}`);
        }
      }

      accounts = await this.prisma.competitorAccount.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
        },
        include: { competitor: true, _count: { select: { content: true } } },
        orderBy: { createdAt: 'desc' },
      });
    }

    return accounts;
  }

  /** Add a competitor social account. */
  async addAccount(
    organizationId: string,
    projectId: string,
    competitorId: string,
    data: {
      platform: string;
      handle: string;
      profileUrl?: string;
      displayName?: string;
      followerCount?: number;
    },
  ) {
    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId || '';
    }

    return this.prisma.competitorAccount.upsert({
      where: { projectId_platform_handle: { projectId, platform: data.platform, handle: data.handle } },
      update: { ...data, competitorId, organizationId: orgId },
      create: { organizationId: orgId, projectId, competitorId, ...data },
    });
  }

  /** Remove a competitor account and its content. */
  async removeAccount(organizationId: string, accountId: string) {
    return this.prisma.competitorAccount.deleteMany({
      where: { id: accountId, ...(organizationId ? { organizationId } : {}) },
    });
  }

  /** Pause / resume monitoring for an account. */
  async toggleAccount(organizationId: string, accountId: string, isActive: boolean) {
    return this.prisma.competitorAccount.updateMany({
      where: { id: accountId, ...(organizationId ? { organizationId } : {}) },
      data: { isActive },
    });
  }

  /** List content items for a project, with optional filters. */
  async listContent(
    organizationId: string,
    projectId: string,
    filters?: { platform?: string; contentType?: string; limit?: number },
  ) {
    // Only what was actually collected from a competitor's channels. An empty
    // list is the honest answer until an account has been synced — this used to
    // write invented reels, view counts and transcripts into the database the
    // first time the list came back empty.
    return this.prisma.competitorContent.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
        ...(filters?.platform && { platform: filters.platform }),
        ...(filters?.contentType && { contentType: filters.contentType }),
      },
      include: { classification: true, account: { select: { displayName: true, platform: true, handle: true } } },
      orderBy: { publishedAt: 'desc' },
      take: filters?.limit ?? 100,
    });
  }

  /**
   * Manually ingest a content item.
   */
  async ingestContent(
    organizationId: string,
    projectId: string,
    accountId: string,
    data: {
      platform: string;
      contentType?: string;
      caption?: string;
      title?: string;
      contentUrl?: string;
      thumbnailUrl?: string;
      publishedAt?: Date;
      hashtags?: string[];
      likesCount?: number;
      commentsCount?: number;
      viewsCount?: number;
    },
  ) {
    let orgId = organizationId;
    if (!orgId) {
      const project = await this.prisma.project.findUnique({ where: { id: projectId }, select: { organizationId: true } });
      orgId = project?.organizationId || '';
    }

    return this.prisma.competitorContent.create({
      data: {
        organizationId: orgId,
        projectId,
        accountId,
        platform: data.platform,
        contentType: data.contentType,
        caption: data.caption,
        title: data.title,
        contentUrl: data.contentUrl,
        thumbnailUrl: data.thumbnailUrl,
        publishedAt: data.publishedAt || new Date(),
        hashtags: data.hashtags ?? [],
        likesCount: data.likesCount,
        commentsCount: data.commentsCount,
        viewsCount: data.viewsCount,
        engagementAvailable: Boolean(data.likesCount != null),
      },
    });
  }

  /** Dashboard stats: total content per platform. */
  async getDashboardStats(organizationId: string, projectId: string) {
    const [totalAccounts, totalContent, classified, platforms] = await Promise.all([
      this.prisma.competitorAccount.count({ where: { projectId, ...(organizationId ? { organizationId } : {}), isActive: true } }),
      this.prisma.competitorContent.count({ where: { projectId, ...(organizationId ? { organizationId } : {}) } }),
      this.prisma.contentClassification.count({
        where: { content: { projectId, ...(organizationId ? { organizationId } : {}) } },
      }),
      this.prisma.competitorContent.groupBy({
        by: ['platform'],
        where: { projectId, ...(organizationId ? { organizationId } : {}) },
        _count: { id: true },
      }),
    ]);
    return { totalAccounts, totalContent, classified, platforms };
  }
}
