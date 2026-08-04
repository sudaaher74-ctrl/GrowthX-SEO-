import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgSource } from './entitlements.decorator';

/**
 * Works out which organization a request is acting on, and confirms the caller
 * is a member of it. Without this, plan gating would be trivially bypassed by
 * passing someone else's organization id.
 */
@Injectable()
export class OrgContextService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolution order:
   *   1. the resource named by `@OrgFrom(...)`, traced back to its organization
   *   2. an explicit id in the route params, body, query, or `x-organization-id`
   *   3. the caller's organization, when they belong to exactly one
   */
  async resolve(request: any, source?: OrgSource): Promise<string> {
    const userId: string | undefined = request.user?.userId;
    if (!userId) {
      throw new ForbiddenException('Authentication is required for billed operations.');
    }

    const fromResource = source ? await this.fromResource(request, source) : null;
    const organizationId = fromResource ?? this.explicitId(request) ?? (await this.soleOrganization(userId));

    if (!organizationId) {
      throw new BadRequestException(
        'Could not determine the organization for this request. Pass organizationId or the x-organization-id header.',
      );
    }

    await this.assertMembership(userId, organizationId);
    return organizationId;
  }

  private explicitId(request: any): string | null {
    return (
      request.params?.organizationId ??
      request.params?.orgId ??
      request.body?.organizationId ??
      request.query?.organizationId ??
      request.headers?.['x-organization-id'] ??
      null
    );
  }

  private async soleOrganization(userId: string): Promise<string | null> {
    const memberships = await this.prisma.organizationMember.findMany({
      where: { userId },
      select: { organizationId: true },
      take: 2,
    });
    return memberships.length === 1 ? memberships[0].organizationId : null;
  }

  private async fromResource(request: any, source: OrgSource): Promise<string | null> {
    const id = request.params?.[source.param];
    if (!id) return null;

    switch (source.resource) {
      case 'organization':
        return id;

      case 'project': {
        const project = await this.prisma.project.findUnique({ where: { id }, select: { organizationId: true } });
        if (!project) throw new NotFoundException('Project not found');
        return project.organizationId;
      }

      case 'website': {
        const website = await this.prisma.website.findUnique({
          where: { id },
          select: { project: { select: { organizationId: true } } },
        });
        if (!website) throw new NotFoundException('Website not found');
        return website.project?.organizationId ?? null;
      }

      case 'crawlJob': {
        const job = await this.prisma.crawlJob.findUnique({
          where: { id },
          select: { website: { select: { project: { select: { organizationId: true } } } } },
        });
        if (!job) throw new NotFoundException('Crawl job not found');
        return job.website.project?.organizationId ?? null;
      }

      case 'issue': {
        const issue = await this.prisma.issue.findUnique({
          where: { id },
          select: { crawlJob: { select: { website: { select: { project: { select: { organizationId: true } } } } } } },
        });
        if (!issue) throw new NotFoundException('Issue not found');
        return issue.crawlJob.website.project?.organizationId ?? null;
      }
    }
  }

  async assertMembership(userId: string, organizationId: string): Promise<void> {
    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });
    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization.');
    }
  }
}
