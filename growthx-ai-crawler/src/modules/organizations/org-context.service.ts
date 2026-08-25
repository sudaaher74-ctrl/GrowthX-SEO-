import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Confirms the caller is a member of the organization a request acts on.
 *
 * Routes across this API identify a resource by id or domain rather than by
 * organization, so the JWT guard alone only proves the caller is *someone*.
 * Without a membership check, any logged-in user can read or write any other
 * organization's records by typing their id.
 *
 * This lived in the billing module and was removed with it. Membership is not
 * a billing concern — plan gating decides what a tenant may do, tenancy decides
 * whose data they may touch — so it lives with organizations now, and does not
 * come back if billing stays gone.
 */
@Injectable()
export class OrgContextService {
  constructor(private readonly prisma: PrismaService) {}

  /** Throws unless the user belongs to the organization. */
  async assertMembership(userId: string, organizationId: string): Promise<void> {
    if (!userId) {
      throw new ForbiddenException('Authentication is required for this operation.');
    }

    const membership = await this.prisma.organizationMember.findUnique({
      where: { userId_organizationId: { userId, organizationId } },
      select: { id: true },
    });

    if (!membership) {
      throw new ForbiddenException('You do not have access to this organization.');
    }
  }

  /**
   * A resource whose owning organization cannot be traced is not a free-for-all.
   *
   * `Website.projectId` is optional, so a site registered without a project has
   * no organization above it. Treating that as "no owner, no restriction" would
   * make an unparented record readable by anyone. Refusing is the only safe
   * reading.
   */
  requireOwner(organizationId: string | null | undefined, label: string): string {
    if (!organizationId) {
      throw new ForbiddenException(
        `This ${label} is not attached to any organization, so access to it cannot be authorized.`,
      );
    }
    return organizationId;
  }

  /** Resolves a website's owning organization and checks the caller is in it. */
  async assertWebsiteAccess(userId: string, where: { id: string } | { domain: string }) {
    const website = await this.prisma.website.findUnique({
      where: where as any,
      select: {
        id: true,
        domain: true,
        verificationToken: true,
        project: { select: { organizationId: true } },
      },
    });
    if (!website) throw new NotFoundException('Website not found');

    await this.assertMembership(userId, this.requireOwner(website.project?.organizationId, 'website'));
    return website;
  }

  /** Same, for a crawl job traced back through its website's project. */
  async assertCrawlJobAccess(userId: string, jobId: string) {
    const job = await this.prisma.crawlJob.findUnique({
      where: { id: jobId },
      include: { website: { include: { project: { select: { organizationId: true } } } } },
    });
    if (!job) throw new NotFoundException('Crawl job not found');

    await this.assertMembership(userId, this.requireOwner(job.website.project?.organizationId, 'crawl job'));
    return job;
  }
}
