import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { buildSiteProfile, ProfilePage, SiteProfile } from './site-profile';

/** How many of a crawl's pages the profile is built from. */
const PAGE_SAMPLE = 500;

/**
 * Loads a crawled site into the shape every comparison here reads.
 *
 * Written once because it was written twice: the comparison table and the
 * findings collector each carried their own copy, identical down to the page
 * `select`, and neither picked up the crawl's health score or its issues when
 * those were added to the profile. Two copies of a loader is how one of them
 * ends up describing a different site from the other.
 */
@Injectable()
export class SiteProfileLoader {
  constructor(private readonly prisma: PrismaService) {}

  /** The customer's own site, from its most recent completed crawl. */
  async forProject(projectId: string): Promise<SiteProfile | null> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    if (!website) return null;
    return this.forWebsite(website.id, website.domain);
  }

  /**
   * One site's newest completed crawl, or null when it has never had one.
   *
   * Null rather than an empty profile throughout: a site nobody has crawled
   * and a site with nothing on it are different statements, and every caller
   * here has to be able to tell them apart.
   */
  async forWebsite(websiteId: string, domain: string): Promise<SiteProfile | null> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true, healthScore: true },
    });
    if (!job) return null;

    const [pages, issues] = await Promise.all([
      this.prisma.page.findMany({
        where: { crawlJobId: job.id },
        select: {
          url: true,
          statusCode: true,
          title: true,
          metaDescription: true,
          robotsMeta: true,
          h1: true,
          pageType: true,
          crawledAt: true,
          _count: { select: { schemas: true } },
        },
        take: PAGE_SAMPLE,
      }),
      this.prisma.issue.findMany({
        where: { crawlJobId: job.id, status: 'OPEN' },
        select: { severity: true, issueType: true, affectedUrl: true, dedupKey: true },
      }),
    ]);

    const shaped: ProfilePage[] = pages.map((page) => ({
      url: page.url,
      statusCode: page.statusCode,
      title: page.title,
      metaDescription: page.metaDescription,
      robotsMeta: page.robotsMeta,
      h1: page.h1,
      pageType: page.pageType,
      crawledAt: page.crawledAt,
      schemaCount: page._count.schemas,
    }));

    return buildSiteProfile(domain, shaped, {
      healthScore: job.healthScore ?? null,
      issuesBySeverity: countBySeverity(issues),
    });
  }
}

/**
 * Counts issues by severity, once per distinct problem.
 *
 * The same key the health score deduplicates on, so a page with one broken
 * title counted once there is counted once here. Without it the crawler's own
 * repeated findings would make a site look several times worse than the score
 * that was calculated from the same rows says it is.
 */
export function countBySeverity(
  issues: Array<{ severity: string; issueType: string; affectedUrl: string; dedupKey: string | null }>,
): Record<string, number> {
  const seen = new Set<string>();
  const counts: Record<string, number> = {};

  for (const issue of issues) {
    const key = issue.dedupKey || `${issue.affectedUrl}::${issue.issueType}`;
    if (seen.has(key)) continue;
    seen.add(key);
    counts[issue.severity] = (counts[issue.severity] ?? 0) + 1;
  }

  return counts;
}
