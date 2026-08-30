import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Manages competitor social accounts and the normalized content database.
 *
 * Data collection from actual platform APIs (Instagram Graph API, Facebook
 * Graph API, YouTube Data API v3) is scaffolded here as an integration
 * abstraction layer. Each platform method is a stub that will activate when
 * the corresponding API credentials are configured.
 */
@Injectable()
export class CompetitorContentService {
  private readonly logger = new Logger(CompetitorContentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** List all competitor accounts for a project. */
  async listAccounts(organizationId: string, projectId: string) {
    return this.prisma.competitorAccount.findMany({
      where: {
        projectId,
        ...(organizationId ? { organizationId } : {}),
      },
      include: { competitor: true, _count: { select: { content: true } } },
      orderBy: { createdAt: 'desc' },
    });
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
   * Manually ingest a content item (for cases where API access is not yet
   * configured). The customer provides the URL and basic metadata.
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
    return this.prisma.competitorContent.create({
      data: {
        organizationId,
        projectId,
        accountId,
        platform: data.platform,
        contentType: data.contentType,
        caption: data.caption,
        title: data.title,
        contentUrl: data.contentUrl,
        thumbnailUrl: data.thumbnailUrl,
        publishedAt: data.publishedAt,
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
      this.prisma.competitorAccount.count({ where: { organizationId, projectId, isActive: true } }),
      this.prisma.competitorContent.count({ where: { organizationId, projectId } }),
      this.prisma.contentClassification.count({
        where: { content: { organizationId, projectId } },
      }),
      this.prisma.competitorContent.groupBy({
        by: ['platform'],
        where: { organizationId, projectId },
        _count: { id: true },
      }),
    ]);
    return { totalAccounts, totalContent, classified, platforms };
  }
}
