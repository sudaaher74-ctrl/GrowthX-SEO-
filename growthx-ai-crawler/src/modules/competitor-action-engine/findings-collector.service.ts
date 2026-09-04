import { Injectable, Logger } from '@nestjs/common';
import { FindingCategory, FindingConfidence, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { SiteProfile, ProfilePage, buildSiteProfile, countOf, EMPTY_PROFILE } from './site-profile';

/** A finding before it is written, so the comparison logic stays pure. */
export interface DraftFinding {
  competitorId?: string | null;
  category: FindingCategory;
  summary: string;
  detail: string;
  sourceUrl?: string | null;
  sourcePlatform: string;
  metricName?: string;
  metricValue?: number;
  customerValue?: number;
  confidence: FindingConfidence;
  observedAt: Date;
}

/** Page kinds a comparison is worth drawing, and what to call them. */
const COVERAGE_TYPES: Array<{ type: string; label: string; category: FindingCategory }> = [
  { type: 'LOCATION', label: 'location or city page', category: 'LOCAL_SEO' },
  { type: 'SERVICE', label: 'service page', category: 'CONTENT_GAP' },
  { type: 'FAQ', label: 'FAQ page', category: 'CONTENT_GAP' },
  { type: 'BLOG', label: 'blog or article page', category: 'CONTENT_GAP' },
  { type: 'CASE_STUDY', label: 'case study page', category: 'CONTENT_GAP' },
];

/**
 * Turns what has already been collected into evidence a recommendation can
 * stand on.
 *
 * Everything here is a comparison of things actually crawled or fetched — page
 * counts by kind, missing meta descriptions, structured data, YouTube
 * publishing cadence. Nothing is estimated and nothing is generated: if a
 * competitor has never been crawled they produce no findings, which is why the
 * strategy run reports its coverage gaps rather than quietly planning around
 * an absence.
 *
 * Findings about the customer's own site are first-class. "You have no city
 * pages" is as actionable as "they have six", and a plan built only from what
 * rivals do would miss every problem the customer has on their own.
 */
@Injectable()
export class FindingsCollectorService {
  private readonly logger = new Logger(FindingsCollectorService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Collects findings for a project and replaces the previous set.
   *
   * Replaced rather than appended: a finding is a statement about how things
   * stand today, and keeping last month's "they have three city pages"
   * alongside this month's "they have nine" would let a stale number argue
   * with a current one. History lives in strategy runs, which are immutable.
   */
  async collect(organizationId: string, projectId: string): Promise<{
    findings: number;
    coverageGaps: string[];
  }> {
    const [customerProfile, competitors] = await Promise.all([
      this.customerProfile(projectId),
      this.competitorProfiles(projectId),
    ]);

    const drafts: DraftFinding[] = [];
    const coverageGaps: string[] = [];

    if (!customerProfile || customerProfile.totalPages === 0) {
      coverageGaps.push(
        'Your own website has not been crawled yet, so nothing can be compared against it. Run a site crawl first.',
      );
    } else {
      drafts.push(...technicalFindings(customerProfile));
    }

    const crawledRivals = competitors.filter((entry) => entry.profile.totalPages > 0);
    if (crawledRivals.length === 0) {
      coverageGaps.push(
        competitors.length === 0
          ? 'No competitors are being tracked, so there is nothing to compare against.'
          : 'None of your tracked competitors have been crawled yet, so no website comparison was possible.',
      );
    } else if (customerProfile) {
      drafts.push(...coverageFindings(customerProfile, crawledRivals));
    }

    const youtube = await this.socialFindings(projectId, 'YOUTUBE');
    if (youtube.length === 0) {
      coverageGaps.push('No competitor YouTube content has been collected, so video strategy is not covered.');
    }
    drafts.push(...youtube);

    const instagram = await this.socialFindings(projectId, 'INSTAGRAM');
    drafts.push(...instagram);

    const local = await this.localFindings(projectId);
    if (local.length === 0) {
      coverageGaps.push('No Google Business Profile data is connected, so local visibility is not covered.');
    }
    drafts.push(...local);

    // Instagram is designed but not enabled; saying so is more useful than an
    // absent section the operator has to notice for themselves.
    if (!process.env.INSTAGRAM_ACCESS_TOKEN || !process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID) {
      coverageGaps.push('Instagram is not connected, so no Instagram signals were included.');
    }

    await this.replaceFindings(organizationId, projectId, drafts);
    return { findings: drafts.length, coverageGaps };
  }

  /** The customer's own site, from its most recent crawl. */
  private async customerProfile(projectId: string): Promise<SiteProfile | null> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    if (!website) return null;
    return this.profileForWebsite(website.id, website.domain);
  }

  private async competitorProfiles(
    projectId: string,
  ): Promise<Array<{ id: string; name: string; profile: SiteProfile }>> {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, domain: true, name: true, label: true, websiteId: true },
      take: 5,
    });

    const results: Array<{ id: string; name: string; profile: SiteProfile }> = [];
    for (const competitor of competitors) {
      const name = competitor.name || competitor.label || competitor.domain;
      const profile = competitor.websiteId
        ? await this.profileForWebsite(competitor.websiteId, competitor.domain)
        : null;
      results.push({
        id: competitor.id,
        name,
        profile: profile ?? { domain: competitor.domain, ...EMPTY_PROFILE },
      });
    }
    return results;
  }

  /** Pages from the newest completed crawl of one website. */
  private async profileForWebsite(websiteId: string, domain: string): Promise<SiteProfile | null> {
    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId, status: 'COMPLETED' },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return null;

    const pages = await this.prisma.page.findMany({
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
      take: 500,
    });

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

    return buildSiteProfile(domain, shaped);
  }

  /**
   * Competitor publishing cadence, from content already ingested.
   *
   * One path for both platforms: the shape of the question — how often do they
   * publish, and how does it land — is identical, and a second near-copy would
   * be the place the two quietly drifted apart.
   */
  private async socialFindings(
    projectId: string,
    platform: 'YOUTUBE' | 'INSTAGRAM',
  ): Promise<DraftFinding[]> {
    const content = await this.prisma.competitorContent.findMany({
      where: { projectId, platform },
      select: {
        publishedAt: true,
        viewsCount: true,
        likesCount: true,
        contentUrl: true,
        account: { select: { competitorId: true, handle: true, displayName: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 500,
    });
    if (content.length === 0) return [];

    const byCompetitor = new Map<string, typeof content>();
    for (const item of content) {
      const key = item.account?.competitorId ?? 'unknown';
      const list = byCompetitor.get(key) ?? [];
      list.push(item);
      byCompetitor.set(key, list);
    }

    const findings: DraftFinding[] = [];
    for (const [competitorId, items] of byCompetitor) {
      const dated = items.filter((item) => item.publishedAt).map((item) => item.publishedAt as Date);
      if (dated.length < 2) continue;

      const newest = dated[0];
      const oldest = dated[dated.length - 1];
      const days = Math.max(1, (newest.getTime() - oldest.getTime()) / 86_400_000);
      const perMonth = Math.round((dated.length / days) * 30 * 10) / 10;

      const name = items[0].account?.displayName || items[0].account?.handle || 'A competitor';
      const noun = platform === 'YOUTUBE' ? 'video' : 'post';

      // Instagram Business Discovery reports no views at all, so engagement is
      // described from whatever the platform actually gave us rather than
      // assumed to be views everywhere.
      const engagement =
        platform === 'YOUTUBE'
          ? items.map((item) => item.viewsCount ?? 0).filter((count) => count > 0)
          : items.map((item) => item.likesCount ?? 0).filter((count) => count > 0);
      const engagementLabel = platform === 'YOUTUBE' ? 'views' : 'likes';
      const medianEngagement = engagement.length ? median(engagement) : undefined;

      findings.push({
        competitorId: competitorId === 'unknown' ? null : competitorId,
        category: platform,
        summary: `${name} publishes about ${perMonth} ${noun}${perMonth === 1 ? '' : 's'} a month`,
        detail:
          `${dated.length} ${noun}s observed between ${oldest.toISOString().slice(0, 10)} and ` +
          `${newest.toISOString().slice(0, 10)}` +
          (medianEngagement
            ? `, with a median of ${medianEngagement.toLocaleString()} ${engagementLabel}.`
            : '.'),
        sourceUrl: items[0].contentUrl,
        sourcePlatform: platform,
        metricName: platform === 'YOUTUBE' ? 'videos_per_month' : 'posts_per_month',
        metricValue: perMonth,
        // Counted from real timestamps on real posts.
        confidence: 'HIGH',
        observedAt: newest,
      });
    }
    return findings;
  }

  /** Local visibility, from a connected Google Business Profile. */
  private async localFindings(projectId: string): Promise<DraftFinding[]> {
    const location = await this.prisma.localLocation.findFirst({
      where: { projectId },
      select: { businessName: true, rating: true, reviewCount: true, updatedAt: true },
    });
    if (!location) return [];

    const findings: DraftFinding[] = [];
    if (location.rating != null && location.reviewCount != null) {
      findings.push({
        category: 'GOOGLE_BUSINESS_PROFILE',
        summary: `Your Google listing shows ${location.rating} stars from ${location.reviewCount} reviews`,
        detail:
          `Read from the connected Google Business Profile for ${location.businessName}. ` +
          'Review volume and rating are among the strongest local ranking signals.',
        sourcePlatform: 'GOOGLE_MAPS',
        metricName: 'review_count',
        customerValue: location.reviewCount,
        confidence: 'HIGH',
        observedAt: location.updatedAt,
      });
    }
    return findings;
  }

  /** Writes the new set, clearing the old one in the same transaction. */
  private async replaceFindings(
    organizationId: string,
    projectId: string,
    drafts: DraftFinding[],
  ): Promise<void> {
    const rows: Prisma.CompetitorFindingCreateManyInput[] = drafts.map((draft) => ({
      organizationId,
      projectId,
      competitorId: draft.competitorId ?? null,
      category: draft.category,
      summary: draft.summary,
      detail: draft.detail,
      sourceUrl: draft.sourceUrl ?? null,
      sourcePlatform: draft.sourcePlatform,
      metricName: draft.metricName ?? null,
      metricValue: draft.metricValue ?? null,
      customerValue: draft.customerValue ?? null,
      confidence: draft.confidence,
      observedAt: draft.observedAt,
    }));

    await this.prisma.$transaction([
      this.prisma.competitorFinding.deleteMany({ where: { projectId } }),
      ...(rows.length ? [this.prisma.competitorFinding.createMany({ data: rows })] : []),
    ]);
  }
}

/**
 * Problems on the customer's own site.
 *
 * Only counted where the crawl actually looked, so a thin crawl produces few
 * findings rather than a clean bill of health.
 */
export function technicalFindings(customer: SiteProfile): DraftFinding[] {
  const findings: DraftFinding[] = [];
  const observedAt = customer.crawledAt ?? new Date();

  if (customer.pagesMissingMetaDescription > 0) {
    const count = customer.pagesMissingMetaDescription;
    findings.push({
      category: 'TECHNICAL_SEO',
      summary: `${count} ${plural(count, 'page has', 'pages have')} no meta description`,
      detail:
        'Google writes its own snippet when a description is missing, which usually reads worse than one you ' +
        `control. Counted across ${customer.totalPages} crawled pages on ${customer.domain}.`,
      sourcePlatform: 'WEBSITE',
      metricName: 'pages_missing_meta_description',
      customerValue: customer.pagesMissingMetaDescription,
      confidence: 'HIGH',
      observedAt,
    });
  }

  if (customer.pagesMissingH1 > 0) {
    const count = customer.pagesMissingH1;
    findings.push({
      category: 'TECHNICAL_SEO',
      summary: `${count} ${plural(count, 'page has', 'pages have')} no H1 heading`,
      detail: `A page with no H1 leaves both search engines and screen readers without its main subject.`,
      sourcePlatform: 'WEBSITE',
      metricName: 'pages_missing_h1',
      customerValue: customer.pagesMissingH1,
      confidence: 'HIGH',
      observedAt,
    });
  }

  if (customer.brokenLinks > 0) {
    const count = customer.brokenLinks;
    findings.push({
      category: 'TECHNICAL_SEO',
      summary: `${count} ${plural(count, 'URL on your site returned', 'URLs on your site returned')} an error`,
      detail: 'Pages returning 4xx or 5xx waste crawl budget and lose any links pointing at them.',
      sourcePlatform: 'WEBSITE',
      metricName: 'broken_urls',
      customerValue: customer.brokenLinks,
      confidence: 'HIGH',
      observedAt,
    });
  }

  if (customer.pagesNoindex > 0) {
    findings.push({
      category: 'TECHNICAL_SEO',
      summary: `${customer.pagesNoindex} ${plural(customer.pagesNoindex, 'page tells', 'pages tell')} search engines not to index ${plural(customer.pagesNoindex, 'it', 'them')}`,
      detail:
        'These pages carry a noindex directive, so they cannot appear in search however good they are. ' +
        'Sometimes that is intentional — a thank-you page, a staging leftover — and sometimes it is a ' +
        'staging setting that shipped. Each one is worth a look.',
      sourcePlatform: 'WEBSITE',
      metricName: 'pages_noindex',
      customerValue: customer.pagesNoindex,
      confidence: 'HIGH',
      observedAt,
    });
  }

  // Structured data is what lets an assistant quote a page rather than
  // paraphrase around it, so its absence is an AI-search finding.
  const schemaShare = customer.totalPages > 0 ? customer.pagesWithSchema / customer.totalPages : 0;
  if (customer.totalPages >= 5 && schemaShare < 0.5) {
    findings.push({
      category: 'AI_SEARCH',
      summary: `Only ${customer.pagesWithSchema} of ${customer.totalPages} pages carry structured data`,
      detail:
        'Schema markup is how a page states plainly what it is about. Without it, AI answers and rich results ' +
        'have to infer, and often infer wrong or skip the page.',
      sourcePlatform: 'WEBSITE',
      metricName: 'pages_with_schema',
      customerValue: customer.pagesWithSchema,
      metricValue: customer.totalPages,
      confidence: 'HIGH',
      observedAt,
    });
  }

  return findings;
}

/**
 * Where rivals cover ground the customer does not.
 *
 * A gap counts only when at least one competitor genuinely has more of a page
 * kind than the customer. Two sites with none each is not a gap, it is a
 * market nobody serves — different advice entirely, and not something to
 * present as a competitor lead.
 */
export function coverageFindings(
  customer: SiteProfile,
  competitors: Array<{ id: string; name: string; profile: SiteProfile }>,
): DraftFinding[] {
  const findings: DraftFinding[] = [];

  for (const { type, label, category } of COVERAGE_TYPES) {
    const mine = countOf(customer, type);
    const ahead = competitors
      .filter((entry) => countOf(entry.profile, type) > mine)
      .sort((a, b) => countOf(b.profile, type) - countOf(a.profile, type));

    if (ahead.length === 0) continue;

    const leader = ahead[0];
    const leaderCount = countOf(leader.profile, type);

    findings.push({
      competitorId: leader.id,
      category,
      summary:
        ahead.length === 1
          ? `${leader.name} has ${leaderCount} ${label}${leaderCount === 1 ? '' : 's'} and you have ${mine}`
          : `${ahead.length} competitors publish more ${label}s than you`,
      detail:
        `${leader.name} has ${leaderCount}; you have ${mine}. ` +
        (ahead.length > 1
          ? `Also ahead: ${ahead.slice(1).map((entry) => `${entry.name} (${countOf(entry.profile, type)})`).join(', ')}. `
          : '') +
        'Counted from crawled, reachable pages only.',
      sourceUrl: leader.profile.exampleUrlByType[type] ?? null,
      sourcePlatform: 'WEBSITE',
      metricName: `${type.toLowerCase()}_pages`,
      metricValue: leaderCount,
      customerValue: mine,
      // Page counts are read directly; what they imply about intent is not,
      // so a single competitor ahead is weaker evidence than several.
      confidence: ahead.length > 1 ? 'HIGH' : 'MEDIUM',
      observedAt: leader.profile.crawledAt ?? new Date(),
    });
  }

  return findings;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

/** Singular and plural wording, because "1 URLs" reads as a broken number. */
function plural(count: number, one: string, many: string): string {
  return count === 1 ? one : many;
}
