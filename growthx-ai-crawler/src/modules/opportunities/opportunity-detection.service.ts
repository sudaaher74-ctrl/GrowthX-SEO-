import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SearchConsoleInsightsService } from '../integrations/google/search-console-insights.service';
import { AnalyticsInsightsService } from '../integrations/google/analytics-insights.service';
import { canonicalUrl } from '../crawler/canonical-url';
import { closestMatch, distinctiveTokens, MATCH_THRESHOLD, siteBoilerplate, topicTokens } from '../content-intelligence/topic-match';

/** What a detector produces before it is stored. */
interface Detected {
  fingerprint: string;
  source: string;
  category: string;
  title: string;
  summary: string;
  evidence: { label: string; value: string; source: string }[];
  recommendedAction: string;
  potential: 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number;
  affectedPages?: string[];
}

/**
 * Turns stored data into things the customer could do.
 *
 * Not an engine and not a new analysis layer: every input here was already
 * collected by an existing engine — the crawler's pages, the competitor
 * crawls, Search Console. What this adds is the join, which is the only place
 * the interesting findings live. "They rank for this" is a fact. "They rank
 * for this, you have no page for it, and your own Search Console shows people
 * already searching it" is a reason to do something today.
 *
 * Everything written carries its evidence. A recommendation nobody can check
 * is a guess with better formatting, and the failure mode of a tool like this
 * is that one wrong confident row teaches the customer to ignore the rest.
 */
@Injectable()
export class OpportunityDetectionService {
  private readonly logger = new Logger(OpportunityDetectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly search: SearchConsoleInsightsService,
    private readonly analytics: AnalyticsInsightsService,
  ) {}

  /**
   * Runs every detector and reconciles the results with what is stored.
   *
   * Detectors are independent and one failing must not lose the others: a
   * project with no Search Console connection should still get its competitor
   * findings.
   */
  async detect(organizationId: string, projectId: string) {
    const detectors: { name: string; run: () => Promise<Detected[]> }[] = [
      { name: 'competitor-gap-with-demand', run: () => this.competitorGapsWithSearchDemand(projectId) },
      { name: 'striking-distance', run: () => this.strikingDistance(projectId) },
      { name: 'ctr-shortfall', run: () => this.ctrShortfall(projectId) },
      { name: 'declining-queries', run: () => this.decliningQueries(projectId) },
      { name: 'high-value-pages', run: () => this.highValuePages(projectId) },
      { name: 'traffic-without-conversion', run: () => this.trafficWithoutConversion(projectId) },
    ];

    const found: Detected[] = [];
    const failed: string[] = [];
    for (const detector of detectors) {
      try {
        found.push(...(await detector.run()));
      } catch (error: any) {
        this.logger.warn(`[${projectId}] detector ${detector.name} failed: ${error.message}`);
        failed.push(detector.name);
      }
    }

    for (const item of found) {
      await this.upsert(organizationId, projectId, item);
    }

    return { detected: found.length, failedDetectors: failed };
  }

  /**
   * Writes a finding without losing what the customer already decided about it.
   *
   * A dismissed opportunity that comes back OPEN tomorrow is the fastest way
   * to make the list worthless, so status is never overwritten — only the
   * evidence and the timestamp, since the numbers behind it do move.
   */
  private async upsert(organizationId: string, projectId: string, item: Detected) {
    const shared = {
      source: item.source,
      category: item.category,
      title: item.title,
      summary: item.summary,
      evidence: item.evidence as any,
      recommendedAction: item.recommendedAction,
      potential: item.potential,
      effort: item.effort,
      confidence: item.confidence,
      priority: priorityOf(item),
      affectedPages: item.affectedPages ?? [],
    };

    await this.prisma.growthOpportunity.upsert({
      where: { projectId_fingerprint: { projectId, fingerprint: item.fingerprint } },
      update: { ...shared, lastSeenAt: new Date() },
      create: { ...shared, organizationId, projectId, fingerprint: item.fingerprint },
    });
  }

  /**
   * The join the whole product is for.
   *
   * A competitor covers a topic, the customer has no page close to it, and the
   * customer's own Search Console shows people already searching for it. Any
   * one of those alone is weak — a competitor page proves nothing about
   * demand, and search demand alone says nothing about whether it is winnable.
   * Together they are a specific page worth writing this week.
   *
   * The Search Console half is optional on purpose. Before a customer connects
   * Google, the competitor gap is still worth surfacing; it just carries lower
   * confidence and says so, rather than being withheld or dressed up.
   */
  private async competitorGapsWithSearchDemand(projectId: string): Promise<Detected[]> {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId, websiteId: { not: null } },
      select: { id: true, domain: true, websiteId: true },
    });
    if (competitors.length === 0) return [];

    // Scoped by projectId, which is exactly what a competitor's Website row
    // does not have — that is what keeps their pages out of "ours".
    const ourPages = await this.latestPages({ projectId });
    if (ourPages.length === 0) return [];
    const ourBoilerplate = siteBoilerplate(ourPages);

    // Search demand, where it is available. Keyed by canonical topic words so
    // a query can be matched against a competitor page's subject.
    const demand = await this.searchDemand(projectId);

    const found: Detected[] = [];

    for (const competitor of competitors) {
      const theirPages = await this.latestPages({ id: competitor.websiteId! });
      if (theirPages.length === 0) continue;
      const theirBoilerplate = siteBoilerplate(theirPages);

      for (const page of theirPages) {
        // Structural pages are not opportunities — everyone has an about page.
        if (['HOME', 'ABOUT', 'CONTACT', 'LEGAL'].includes(page.pageType)) continue;
        const topic = distinctiveTokens(page, theirBoilerplate);
        if (topic.size === 0) continue;

        const match = closestMatch(page, ourPages, { theirs: theirBoilerplate, ours: ourBoilerplate });
        if (match && match.score >= MATCH_THRESHOLD) continue;

        const related = matchDemand(topic, demand);
        const evidence: Detected['evidence'] = [
          {
            label: 'Competitor coverage',
            value: `${competitor.domain} publishes ${page.title || page.url}`,
            source: 'Competitor site crawl',
          },
          {
            label: 'Your coverage',
            value: match
              ? `Nothing close — the nearest page on your site is ${match.page.url} (${Math.round(match.score * 100)}% topic overlap)`
              : 'No page on your site shares a topic word with this',
            source: 'Your site crawl',
          },
        ];

        // Confidence is built from what is actually known, not asserted.
        // Topic matching on URLs and titles is right often enough to act on
        // and wrong often enough that a high number without search evidence
        // would be overclaiming.
        let confidence = 55;
        let potential: Detected['potential'] = 'MEDIUM';

        if (related.impressions > 0) {
          evidence.push({
            label: 'Your existing search demand',
            value: `${related.impressions.toLocaleString()} impressions across ${related.queries.length} related ${
              related.queries.length === 1 ? 'query' : 'queries'
            } (${related.queries.slice(0, 3).join(', ')})`,
            source: 'Google Search Console',
          });
          // Real impressions on the customer's own property are the strongest
          // signal available here: it is their audience, not an estimate.
          confidence = related.impressions >= 1000 ? 88 : 74;
          potential = related.impressions >= 1000 ? 'HIGH' : 'MEDIUM';
        } else {
          evidence.push({
            label: 'Your existing search demand',
            value: 'Not known — Search Console is not connected, or has no impressions for this topic',
            source: 'Google Search Console',
          });
        }

        found.push({
          fingerprint: fingerprint('competitor-gap', competitor.domain, canonicalUrl(page.url)),
          source: 'COMPETITOR',
          category: 'CONTENT',
          title: `Cover "${page.title || topicLabel(topic)}" — ${competitor.domain} does and you do not`,
          summary: related.impressions
            ? `${competitor.domain} has a page for this and your site has nothing close, while your own Search Console already records ${related.impressions.toLocaleString()} impressions on related searches.`
            : `${competitor.domain} has a page for this and your site has nothing close to it.`,
          evidence,
          recommendedAction: `Create a page covering ${topicLabel(topic)}. Review ${page.url} for what they cover, then write something better — not a copy.`,
          potential,
          effort: 'MEDIUM',
          confidence,
          affectedPages: [],
        });
      }
    }

    // Strongest first, and capped: a list of two hundred is not a task list.
    return found.sort((a, b) => b.confidence - a.confidence).slice(0, 25);
  }

  /** Queries ranking just outside the clicks. */
  private async strikingDistance(projectId: string): Promise<Detected[]> {
    const rows = await this.search.strikingDistance(projectId, { limit: 15 });
    return rows.map((row) => ({
      fingerprint: fingerprint('striking-distance', row.key),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `Push "${row.key}" from position ${row.position.toFixed(1)} onto page one`,
      summary: `This query already puts you in front of ${row.impressions.toLocaleString()} people and returns ${row.clicks.toLocaleString()} clicks. Ranking is the constraint, not visibility.`,
      evidence: [
        { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
        { label: 'Clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
        {
          label: 'Selected by',
          value: `positions ${row.criteria.minPosition}–${row.criteria.maxPosition}, at least ${row.criteria.minImpressions.toLocaleString()} impressions over ${row.criteria.days} days`,
          source: 'GrowthX threshold',
        },
      ],
      recommendedAction: 'Find the page ranking for this query and strengthen it: depth, internal links, and a title that matches the search.',
      // Measured on the customer's own property, so the evidence is direct.
      // The uncertainty is in whether the ranking will move, which is effort,
      // not confidence in the finding.
      potential: row.impressions >= 5000 ? 'HIGH' : 'MEDIUM',
      effort: 'MEDIUM',
      confidence: 90,
    }));
  }

  /** Pages seen often and clicked rarely for where they rank. */
  private async ctrShortfall(projectId: string): Promise<Detected[]> {
    const rows = await this.search.ctrOpportunities(projectId, { limit: 15 });
    return rows.map((row) => ({
      fingerprint: fingerprint('ctr-shortfall', canonicalUrl(row.key)),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `Rewrite the title and description for ${shortPath(row.key)}`,
      summary: `This page ranks at ${row.position.toFixed(1)} and is seen ${row.impressions.toLocaleString()} times, but is clicked far less than pages usually are at that position.`,
      evidence: [
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
        { label: 'Click-through rate', value: `${(row.ctr * 100).toFixed(2)}%`, source: 'Google Search Console' },
        { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        {
          label: 'Clicks the gap represents',
          value: `about ${row.estimatedMissedClicks.toLocaleString()} over this period`,
          // Named as an estimate from a generic curve, because that is what it
          // is — click-through varies enormously by intent and by how much of
          // the results page Google fills before the first organic result.
          source: 'Estimated from a generic position curve, not your industry',
        },
      ],
      recommendedAction: 'Rewrite the page title and meta description to match what people are searching for, then re-check in a fortnight.',
      potential: row.estimatedMissedClicks >= 500 ? 'HIGH' : 'MEDIUM',
      // The cheapest thing on this list: two fields, no new content.
      effort: 'LOW',
      confidence: 75,
      affectedPages: [row.key],
    }));
  }

  /** Queries whose ranking fell between two equal periods. */
  private async decliningQueries(projectId: string): Promise<Detected[]> {
    const rows = await this.search.declining(projectId, { limit: 10 });
    return rows.map((row) => ({
      fingerprint: fingerprint('declining', row.query),
      source: 'SEARCH_CONSOLE',
      category: 'SEO',
      title: `"${row.query}" fell from position ${row.previousPosition.toFixed(1)} to ${row.currentPosition.toFixed(1)}`,
      summary: `Clicks went from ${row.previousClicks.toLocaleString()} to ${row.currentClicks.toLocaleString()} across two equal periods.`,
      evidence: [
        { label: 'Previous position', value: row.previousPosition.toFixed(1), source: 'Google Search Console' },
        { label: 'Current position', value: row.currentPosition.toFixed(1), source: 'Google Search Console' },
        { label: 'Impressions', value: row.impressions.toLocaleString(), source: 'Google Search Console' },
      ],
      // No cause is offered. Search Console cannot say why a ranking fell, and
      // naming a reason here would be a guess presented as a finding.
      recommendedAction: 'Open the page that ranks for this query and check what changed: content, internal links, and whether a competitor has published something newer.',
      potential: row.impressions >= 2000 ? 'HIGH' : 'MEDIUM',
      effort: 'MEDIUM',
      confidence: 85,
    }));
  }

  /**
   * Pages that already earn, and still rank below where they could.
   *
   * The most valuable thing in the product: a page with proven conversions and
   * a position outside the top few is a known-good asset with headroom, which
   * is a far safer bet than writing something new and hoping.
   *
   * Requires measured conversions. A page with traffic and unknown conversions
   * is not evidence of value, and calling it high-value would be a guess
   * wearing the same badge as a measured finding.
   */
  private async highValuePages(projectId: string): Promise<Detected[]> {
    const { rows, hasAnalyticsData } = await this.analytics.pageValue(projectId, 28, 200);
    if (!hasAnalyticsData) return [];

    return rows
      .filter((row) => row.conversions != null && row.conversions > 0 && row.position > 3)
      .sort((a, b) => (b.conversions ?? 0) - (a.conversions ?? 0))
      .slice(0, 10)
      .map((row) => ({
        fingerprint: fingerprint('high-value-page', canonicalUrl(row.page)),
        source: 'ANALYTICS',
        category: 'SEO',
        title: `Improve the ranking of ${shortPath(row.page)} — it already converts`,
        summary: `This page converts ${row.conversions} of ${row.sessions?.toLocaleString()} sessions and ranks at ${row.position.toFixed(1)}. Moving it up puts more people in front of something already known to work.`,
        evidence: [
          { label: 'Conversions', value: String(row.conversions), source: 'Google Analytics' },
          {
            label: 'Conversion rate',
            value: row.conversionRate != null ? `${(row.conversionRate * 100).toFixed(1)}%` : 'unknown',
            source: 'Google Analytics',
          },
          { label: 'Organic clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
          { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        ],
        recommendedAction: 'Strengthen this page for the queries it already ranks for: depth, internal links from related pages, and a title matching the search.',
        // The rarest combination on this list — measured revenue-adjacent
        // outcome plus measured headroom.
        potential: 'HIGH',
        effort: 'MEDIUM',
        confidence: 92,
        affectedPages: [row.page],
      }));
  }

  /**
   * Pages with real traffic and no conversions.
   *
   * Only where conversions are actually tracked. Without that, every page on
   * the site would qualify and the list would be a report about the customer's
   * Analytics configuration dressed up as a finding about their pages.
   */
  private async trafficWithoutConversion(projectId: string): Promise<Detected[]> {
    const { rows, hasAnalyticsData } = await this.analytics.pageValue(projectId, 28, 200);
    if (!hasAnalyticsData) return [];

    return rows
      .filter((row) => row.conversions === 0 && (row.sessions ?? 0) >= 200)
      .sort((a, b) => (b.sessions ?? 0) - (a.sessions ?? 0))
      .slice(0, 10)
      .map((row) => ({
        fingerprint: fingerprint('no-conversion', canonicalUrl(row.page)),
        source: 'ANALYTICS',
        category: 'CONTENT',
        title: `${shortPath(row.page)} gets ${row.sessions?.toLocaleString()} sessions and converts none of them`,
        summary: `Search is doing its job for this page — it is found and clicked. What happens after the click is not.`,
        evidence: [
          { label: 'Sessions', value: (row.sessions ?? 0).toLocaleString(), source: 'Google Analytics' },
          { label: 'Conversions', value: '0', source: 'Google Analytics' },
          { label: 'Organic clicks', value: row.clicks.toLocaleString(), source: 'Google Search Console' },
          { label: 'Average position', value: row.position.toFixed(1), source: 'Google Search Console' },
        ],
        recommendedAction: 'Check what this page asks the visitor to do. A page that ranks and is read but has no clear next step converts nobody however much traffic it gets.',
        potential: (row.sessions ?? 0) >= 1000 ? 'HIGH' : 'MEDIUM',
        effort: 'MEDIUM',
        // Lower than the high-value finding: the numbers are certain, but
        // whether the page is *meant* to convert is not something Analytics
        // can say. A guide that informs and sends people elsewhere is working.
        confidence: 70,
        affectedPages: [row.page],
      }));
  }

  /** Pages from the most recent completed crawl of a website. */
  private async latestPages(websiteWhere: any) {
    const job = await this.prisma.crawlJob.findFirst({
      where: { status: 'COMPLETED', website: websiteWhere },
      orderBy: { finishedAt: 'desc' },
      select: { id: true },
    });
    if (!job) return [];

    const rows = await this.prisma.page.findMany({
      where: { crawlJobId: job.id, statusCode: { gte: 200, lt: 300 } },
      select: { url: true, title: true, pageType: true },
    });

    // Deduplicated the same way coverage counts, so a page linked as www. in
    // one place is not treated as two.
    const seen = new Map<string, (typeof rows)[number]>();
    for (const row of rows) {
      const key = canonicalUrl(row.url);
      if (!seen.has(key)) seen.set(key, row);
    }
    return [...seen.values()];
  }

  /** The customer's own queries with impressions, for matching topics against. */
  private async searchDemand(projectId: string) {
    try {
      const rows = await this.search.top(projectId, 'QUERY', { days: 28, limit: 500 });
      return rows.map((row) => ({ query: row.key, impressions: row.impressions, tokens: topicTokens(row.key) }));
    } catch {
      // Search Console not connected. The competitor gaps are still worth
      // finding; they just carry the lower confidence set above.
      return [];
    }
  }
}

/**
 * Search demand related to a topic.
 *
 * A query counts when it shares most of the topic's words. Requiring an exact
 * phrase would find almost nothing — nobody searches the words in a page slug
 * in that order — and requiring one shared word would attach "mango" demand to
 * every page mentioning mango.
 */
function matchDemand(topic: Set<string>, demand: { query: string; impressions: number; tokens: Set<string> }[]) {
  const queries: string[] = [];
  let impressions = 0;

  for (const row of demand) {
    if (topic.size === 0) continue;
    let shared = 0;
    for (const word of topic) if (row.tokens.has(word)) shared += 1;
    if (shared / topic.size >= 0.5) {
      queries.push(row.query);
      impressions += row.impressions;
    }
  }

  return { queries: queries.sort(), impressions };
}

/**
 * Ordering for the list.
 *
 * Potential and confidence raise it, effort lowers it — the spec's formula.
 * Deliberately no currency figure anywhere: without revenue data attached to a
 * page, a rupee amount would be invented precision, and one invented number
 * discredits every real one next to it.
 */
function priorityOf(item: Detected): number {
  const band = { HIGH: 3, MEDIUM: 2, LOW: 1 } as const;
  return band[item.potential] * 10 + (item.confidence / 100) * 5 - band[item.effort] * 2;
}

/** Stable across runs, so a dismissal survives re-detection. */
function fingerprint(...parts: string[]): string {
  return crypto.createHash('sha1').update(parts.join('|').toLowerCase()).digest('hex').slice(0, 24);
}

function topicLabel(topic: Set<string>): string {
  return [...topic].slice(0, 4).join(' ');
}

function shortPath(url: string): string {
  try {
    return new URL(url).pathname || url;
  } catch {
    return url;
  }
}
