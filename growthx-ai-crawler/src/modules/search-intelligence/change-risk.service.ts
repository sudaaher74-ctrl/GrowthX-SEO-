import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { assessRisk, CHANGE_LABEL, ChangeKind, TargetFacts } from './change-risk';
import { urlSpellings } from './keyword-diagnosis.service';
import { onDomain, ownSite } from './own-site';
import { pageInSearchConsole, queriesForPage, searchConsoleConnected } from './search-console-facts';

const DAY = 24 * 60 * 60 * 1000;
const KINDS: ChangeKind[] = ['DELETE', 'REDIRECT', 'CANONICAL', 'URL_CHANGE', 'NOINDEX'];

/**
 * What would break if a page were deleted, redirected, canonicalised, moved or
 * hidden — asked before the change, from the page's own search traffic,
 * rankings, visits and the site's references to it.
 */
@Injectable()
export class ChangeRiskService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(projectId: string, input: { url: string; change: string; target?: string }) {
    const change = String(input.change ?? '').toUpperCase() as ChangeKind;
    if (!KINDS.includes(change)) throw new BadRequestException(`Choose a change: ${KINDS.join(', ')}.`);
    const url = (input.url ?? '').trim();
    const site = await ownSite(this.prisma, projectId);
    if (!site) throw new NotFoundException('Add your website to this project first.');
    if (!url || !onDomain(url, site.website.domain)) throw new BadRequestException(`Give a page on ${site.website.domain}.`);
    const targetUrl = input.target?.trim() || null;
    if ((change === 'REDIRECT' || change === 'CANONICAL' || change === 'URL_CHANGE') && !targetUrl) {
      throw new BadRequestException('Give the page this should point to.');
    }

    const now = new Date();
    const since = new Date(now.getTime() - 90 * DAY);
    const spellings = urlSpellings(url);
    const crawlId = site.crawl?.id ?? null;

    const [connected, totals, queries, analytics, page, inlinkRows, frontier, canonicalRows, rankings, inspection, target] = await Promise.all([
      searchConsoleConnected(this.prisma, projectId),
      pageInSearchConsole(this.prisma, projectId, url, since, now),
      queriesForPage(this.prisma, projectId, url, 90, 25),
      this.analytics(projectId, url, since),
      crawlId ? this.prisma.page.findFirst({ where: { crawlJobId: crawlId, url: { in: spellings } }, select: { title: true } }) : null,
      crawlId
        ? this.prisma.internalGraph.findMany({ where: { crawlJobId: crawlId, targetUrl: { in: spellings } }, select: { sourceUrl: true }, take: 500 })
        : ([] as Array<{ sourceUrl: string }>),
      crawlId
        ? this.prisma.crawlFrontier.findMany({ where: { crawlJobId: crawlId, url: { in: spellings } }, select: { sources: true } })
        : ([] as Array<{ sources: string[] }>),
      crawlId
        ? this.prisma.page.findMany({ where: { crawlJobId: crawlId, canonicalUrl: { in: spellings }, NOT: { url: { in: spellings } } }, select: { url: true }, take: 50 })
        : ([] as Array<{ url: string }>),
      this.rankings(projectId, url),
      this.prisma.urlIndexInspection.findFirst({ where: { projectId, url: { in: spellings }, error: null }, orderBy: { inspectedAt: 'desc' }, select: { verdict: true } }),
      targetUrl ? this.target(crawlId, targetUrl, site.website.domain) : null,
    ]);

    const self = canonicalUrl(url);
    const inlinks = [...new Set(inlinkRows.map((r) => r.sourceUrl))].filter((s) => canonicalUrl(s) !== self);

    const assessment = assessRisk({
      change,
      url,
      title: page?.title ?? null,
      searchConsole: { connected, clicks: totals.clicks, impressions: totals.impressions, queries },
      analytics,
      inlinks,
      inSitemap: frontier.some((f) => f.sources.includes('sitemap')),
      canonicalFrom: canonicalRows.map((r) => r.url),
      rankings,
      indexed: inspection ? inspection.verdict === 'PASS' : null,
      target,
    });

    return {
      url,
      change,
      changeLabel: CHANGE_LABEL[change],
      target: targetUrl,
      checkedAt: now,
      crawlUsed: site.crawl ? { id: site.crawl.id, at: site.crawl.finishedAt ?? site.crawl.createdAt } : null,
      ...assessment,
      affected: {
        searchClicks90d: connected ? totals.clicks : null,
        searchImpressions90d: connected ? totals.impressions : null,
        searches: queries,
        internalLinks: inlinks.length,
        inSitemap: frontier.some((f) => f.sources.includes('sitemap')),
        canonicalReferences: canonicalRows.length,
        trackedRankings: rankings,
        visits90d: analytics?.sessions ?? null,
      },
    };
  }

  private async analytics(projectId: string, url: string, since: Date) {
    const connected = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'analytics' } },
      select: { selectedResourceId: true },
    });
    if (!connected?.selectedResourceId) return null;
    let path: string;
    try {
      path = new URL(url).pathname.replace(/\/+$/, '') || '/';
    } catch {
      return null;
    }
    const rows = await this.prisma.ga4DailyMetric.findMany({
      where: { projectId, grain: 'LANDING_PAGE', date: { gte: since }, landingPage: { startsWith: path } },
      select: { landingPage: true, sessions: true, conversions: true },
    });
    const mine = rows.filter((r) => (r.landingPage?.split('?')[0].replace(/\/+$/, '') || '/') === path);
    return { sessions: mine.reduce((s, r) => s + r.sessions, 0), conversions: mine.reduce((s, r) => s + (r.conversions ?? 0), 0) };
  }

  /** Tracked keywords where Google ranked this page in the latest check of each. */
  private async rankings(projectId: string, url: string) {
    const recent = await this.prisma.serpSnapshot.findMany({
      where: { projectId, error: null, checkedAt: { gte: new Date(Date.now() - 60 * DAY) } },
      orderBy: { checkedAt: 'desc' },
      select: { keyword: true, ownUrl: true, ownPosition: true },
      take: 1000,
    });
    const seen = new Set<string>();
    const out: Array<{ keyword: string; position: number }> = [];
    const self = canonicalUrl(url);
    for (const s of recent) {
      if (seen.has(s.keyword)) continue;
      seen.add(s.keyword);
      if (s.ownUrl && s.ownPosition && canonicalUrl(s.ownUrl) === self) out.push({ keyword: s.keyword, position: s.ownPosition });
    }
    return out.sort((a, b) => a.position - b.position);
  }

  private async target(crawlId: string | null, targetUrl: string, domain: string): Promise<TargetFacts> {
    const onSite = onDomain(targetUrl, domain);
    const page =
      crawlId && onSite
        ? await this.prisma.page.findFirst({
            where: { crawlJobId: crawlId, url: { in: urlSpellings(targetUrl) } },
            select: { statusCode: true, indexability: true, canonicalUrl: true, robotsMeta: true, title: true },
          })
        : null;
    return {
      url: targetUrl,
      onSite,
      statusCode: page?.statusCode ?? null,
      indexability: page?.indexability ?? null,
      canonicalUrl: page?.canonicalUrl ?? null,
      noindex: Boolean(page?.robotsMeta && /noindex/i.test(page.robotsMeta)),
      title: page?.title ?? null,
    };
  }
}
