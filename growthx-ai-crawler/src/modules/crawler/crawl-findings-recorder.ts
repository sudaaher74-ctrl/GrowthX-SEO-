import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { fingerprintFor, fingerprintScope, issueGroupKey } from '../issues/fingerprint.util';
import { ProductSignal } from './product-detector';
import { writeCatalogProduct } from './catalog-write';
import { extractSocialProfiles } from './social-links';
import { FetchOutcome } from './fetch/fetch.service';
import { evaluateSite } from './issue-rules';
import { findDuplicateClusters } from './frontier/duplicate-clusters';

import { CrawlJobState } from './crawl-job-state';

/**
 * Writes what a crawl finds: issues, catalog products and social profiles.
 *
 * Each write is best-effort. A finding that fails to store costs the crawl one
 * row; it must never fail the page that carried it.
 */
export class CrawlFindingsRecorder {
  private readonly logger = new Logger(CrawlFindingsRecorder.name);
  private static readonly CATALOG_TARGETS_TTL_MS = 60_000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly state: CrawlJobState,
  ) {}

  /**
   * Raises JS_RENDER_REQUIRED, or RENDER_UNAVAILABLE when the page needed
   * rendering and we could not do it.
   *
   * The evidence is the raw-versus-rendered difference, so the claim is
   * checkable rather than asserted: this many words and links before
   * JavaScript ran, this many after.
   */
  async persistRenderFindings(crawlJobId: string, websiteId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
    if (outcome.jsRequired && outcome.renderDiff) {
      const diff = outcome.renderDiff;
      await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, {
        issueType: 'JS_RENDER_REQUIRED',
        severity: 'HIGH',
        confidence: 'CONFIRMED',
        description: 'Content is only available after JavaScript execution.',
        explanation:
          'The HTML the server sends is an empty shell. Everything that describes this page — its title, its copy and its links — is ' +
          'written by JavaScript in the browser afterwards.',
        impact:
          'Googlebot renders JavaScript, so Google will eventually see this page, though on a slower second pass. Bingbot, GPTBot, ' +
          'PerplexityBot, ClaudeBot and most social-preview scrapers largely do not, so to those engines this page is effectively blank. ' +
          'That is the difference between being ranked late and not being quotable in an AI answer at all.',
        recommendation:
          'Server-render or pre-render this route so the title, meta description, copy and navigation are present in the initial HTML response.',
        evidence:
          `Raw HTML: ${diff.rawWordCount} words, ${diff.rawLinkCount} links, title "${diff.rawTitle ?? '(none)'}". ` +
          `After rendering: ${diff.renderedWordCount} words, ${diff.renderedLinkCount} links, title "${diff.renderedTitle ?? '(none)'}". ` +
          (diff.fingerprints.length ? `Build fingerprints: ${diff.fingerprints.join(', ')}.` : ''),
      });
      return;
    }

    if (outcome.renderUnavailable && outcome.escalationReasons.length > 0) {
      await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, {
        issueType: 'RENDER_UNAVAILABLE',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        description: 'This page needs JavaScript to be read, and we could not render it on this crawl.',
        explanation: 'The static response is an empty shell and the render tier was unavailable or out of budget.',
        impact: 'Content findings for this page are incomplete and should not be trusted until it has been rendered.',
        recommendation: 'Re-run the audit with the render budget raised for this site.',
        evidence: `Escalation reasons: ${outcome.escalationReasons.join(', ')}`,
      });
    }
  }

  /**
   * Raises the findings that are about the crawl rather than about one page:
   * a sitemap on the wrong domain, sitemap URLs that do not resolve, and
   * clusters of URLs serving identical content.
   *
   * Duplicate clusters are reported once for the cluster. Reporting them as
   * one thin-content finding per copy both inflates the issue count and names
   * the wrong fix — the answer is a canonical, not more words.
   */
  async persistSiteFindings(jobId: string, websiteId: string): Promise<void> {
    try {
      const website = await this.prisma.website.findUnique({ where: { id: websiteId }, select: { url: true, domain: true } });
      const siteUrl = website?.url?.startsWith('http') ? website.url : `https://${website?.domain ?? ''}`;
      if (!siteUrl || siteUrl === 'https://') return;

      const { sitemapUrls: sitemapSet, sitemapFindings } = await this.state.loadCrawlState(jobId);

      const pages = await this.prisma.page.findMany({
        where: { crawlJobId: jobId },
        select: { url: true, statusCode: true, contentHash: true, fetchErrorKind: true },
      });

      const deadSitemapUrls = pages
        .filter((p) => sitemapSet.has(p.url) && (p.statusCode === 0 || p.statusCode >= 400))
        .map((p) => ({
          url: p.url,
          status: p.statusCode,
          reason: p.statusCode === 0 ? `${p.fetchErrorKind ?? 'unknown'}: could not be fetched` : `HTTP ${p.statusCode}`,
        }));

      const duplicateClusters = findDuplicateClusters(pages.map((p) => ({ url: p.url, contentHash: p.contentHash })));

      const findings = evaluateSite({ siteUrl, sitemapFindings, duplicateClusters, deadSitemapUrls });
      for (const finding of findings) {
        await this.persistIssue(jobId, websiteId, null, finding.affectedUrl, {
          issueType: finding.id,
          severity: finding.severity,
          confidence: finding.confidence,
          description: finding.description,
          explanation: finding.explanation,
          impact: finding.impact,
          recommendation: finding.recommendation,
          evidence: finding.evidence,
        });
      }

      if (findings.length > 0) {
        this.logger.log(`[JOB ${jobId}] Raised ${findings.length} site-level finding(s): ${findings.map((f) => f.id).join(', ')}`);
      }
    } catch (err) {
      // Site-level findings are additional to a crawl that has already
      // succeeded; failing to write one must not un-finish the job.
      this.logger.error(`[JOB ${jobId}] Could not persist site-level findings`, err);
    }
  }

  /**
   * The one finding raised for a page we could not read.
   *
   * Everything the content rules would have said about such a page is a
   * statement about a body that never arrived, so this replaces them rather
   * than joining them.
   */
  async persistFetchFailureIssue(crawlJobId: string, websiteId: string, pageId: string, pageUrl: string, outcome: FetchOutcome): Promise<void> {
    const blocked = !outcome.error && outcome.blockedSuspected;
    const issue = blocked
      ? {
          issueType: 'FETCH_BLOCKED_SUSPECTED',
          severity: 'HIGH',
          confidence: 'LIKELY',
          description: `The origin answered HTTP ${outcome.statusCode} even with a full browser request.`,
          explanation:
            'A bot-protection layer appears to be refusing automated clients. We retried with a complete browser header set and then ' +
            'through a real browser, and the refusal persisted, so this page could not be assessed.',
          impact:
            'Whatever refuses us may also refuse Bingbot, GPTBot, PerplexityBot and ClaudeBot. No content finding about this page can be ' +
            'trusted until it can be fetched.',
          recommendation: 'Allow our crawler in your WAF or CDN bot rules, then re-run the audit.',
          evidence: outcome.blockedEvidence || `HTTP ${outcome.statusCode}`,
        }
      : {
          issueType: 'FETCH_FAILED',
          severity: this.isRootUrl(pageUrl) ? 'CRITICAL' : 'HIGH',
          confidence: 'CONFIRMED',
          description: `Could not fetch page: ${outcome.error?.label ?? 'no response'}.`,
          explanation:
            'No response was obtained from the origin, so nothing about this page could be assessed. This is a report of what happened ' +
            'on our side, not a statement about the page itself.',
          impact: 'A page we cannot reach may be a page search engines cannot reach. No other finding about it would be trustworthy.',
          recommendation: `Check that ${pageUrl} resolves and responds from outside your own network.`,
          evidence: `${outcome.error?.kind ?? 'unknown'}: ${outcome.error?.message ?? 'no response'}`,
        };

    await this.persistIssue(crawlJobId, websiteId, pageId, pageUrl, issue);
  }

  /**
   * The project a website belongs to, cached for the life of the process.
   *
   * Resolved once per website rather than once per finding: a 10,000-page
   * crawl raises findings in the thousands, and every one of them would
   * otherwise repeat the same lookup. A website moving between projects
   * mid-crawl would be read stale, which costs that one crawl's findings their
   * project and is corrected by the next crawl — a trade worth making against
   * thousands of redundant queries.
   */
  private readonly projectIdByWebsite = new Map<string, string | null>();

  /**
   * (project, competitor) pairs a crawled website's product pages should be
   * written to for the Business module's catalogs.
   *
   * One entry with `competitorId: null` for the project's own site. One entry
   * per `CompetitorDomain` row for a competitor's site — there can be several,
   * because a competitor's `Website` is shared across every project tracking
   * that domain (deduped by domain), and each of those projects needs its own
   * catalog comparison.
   *
   * Cached briefly, not for the life of the process. It used to be kept
   * forever, so a competitor linked to a website after the first lookup —
   * a second project adding the same rival, or a crawl whose first page beat
   * the link being written — never had a product recorded until a restart,
   * and Business showed "No product pages found" for a site that had them.
   */
  private readonly catalogTargetsByWebsite = new Map<
    string,
    { at: number; targets: { projectId: string; competitorId: string | null; organizationId: string }[] }
  >();

  async resolveProjectId(websiteId: string): Promise<string | null> {
    const cached = this.projectIdByWebsite.get(websiteId);
    if (cached !== undefined) return cached;

    // Null is a real answer here, not a failure: competitor sites are stored
    // with no project on purpose. A lookup that fails outright gets the same
    // answer — a finding with no project is worth strictly more than a crawl
    // that died resolving one.
    try {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: { projectId: true },
      });
      const projectId = website?.projectId ?? null;
      this.projectIdByWebsite.set(websiteId, projectId);
      return projectId;
    } catch {
      // Deliberately not cached. A transient failure that poisoned the cache
      // would strip the project from every remaining finding in the crawl,
      // long after the database recovered.
      this.logger.warn(`Could not resolve the project for website ${websiteId}; findings will carry none.`);
      return null;
    }
  }

  private async resolveCatalogTargets(
    websiteId: string,
  ): Promise<{ projectId: string; competitorId: string | null; organizationId: string }[]> {
    const cached = this.catalogTargetsByWebsite.get(websiteId);
    if (cached && Date.now() - cached.at < CrawlFindingsRecorder.CATALOG_TARGETS_TTL_MS) return cached.targets;

    try {
      const website = await this.prisma.website.findUnique({
        where: { id: websiteId },
        select: {
          projectId: true,
          project: { select: { organizationId: true } },
          competitors: { select: { id: true, projectId: true, project: { select: { organizationId: true } } } },
        },
      });
      if (!website) return [];

      const targets: { projectId: string; competitorId: string | null; organizationId: string }[] = [];
      if (website.projectId && website.project) {
        targets.push({ projectId: website.projectId, competitorId: null, organizationId: website.project.organizationId });
      }
      for (const competitor of website.competitors) {
        targets.push({ projectId: competitor.projectId, competitorId: competitor.id, organizationId: competitor.project.organizationId });
      }

      this.catalogTargetsByWebsite.set(websiteId, { at: Date.now(), targets });
      return targets;
    } catch {
      // Not cached, same reasoning as resolveProjectId: a transient failure
      // must not poison every later page of this crawl.
      this.logger.warn(`Could not resolve catalog targets for website ${websiteId}; product pages on it will not be cataloged this crawl.`);
      return [];
    }
  }

  /**
   * Writes one CatalogProduct row per (project, competitor) target for a page
   * the product detector flagged. Never called for a page that isn't one —
   * a page that stops looking like a product on a later crawl keeps its old
   * row rather than being silently deleted, which the Business module's Gaps
   * tab treats as "check this one" instead of a phantom drop in the catalog.
   */
  async recordCatalogProduct(websiteId: string, pageId: string, pageUrl: string, signal: ProductSignal): Promise<void> {
    const targets = await this.resolveCatalogTargets(websiteId);
    if (targets.length === 0) return;

    for (const target of targets) {
      try {
        await writeCatalogProduct(this.prisma, target, pageId, pageUrl, signal);
      } catch (err) {
        this.logger.warn(`Could not record catalog product ${pageUrl} for project ${target.projectId}: ${(err as Error).message}`);
      }
    }
  }

  /**
   * Writes one finding, ignoring a duplicate already recorded for this crawl.
   *
   * Carries the same identity columns the issue engine writes. A finding that
   * reached the database without a fingerprint is invisible to reconciliation,
   * so it could never resolve and never regress — and the site-level findings
   * that come through here are among the longest-lived a site has.
   */
  private async persistIssue(
    crawlJobId: string,
    websiteId: string,
    pageId: string | null,
    affectedUrl: string,
    issue: { issueType: string; severity: string; confidence: string; description: string; explanation: string; impact: string; recommendation: string; evidence: string },
  ): Promise<void> {
    const dedupKey = `${affectedUrl}::${issue.issueType}`;
    const projectId = await this.resolveProjectId(websiteId);
    const scope = fingerprintScope(projectId, websiteId);
    const fingerprint = fingerprintFor(scope, issue.issueType, affectedUrl);
    const groupKey = issueGroupKey(scope, issue.issueType);
    try {
      const existing = await this.prisma.issue.findFirst({ where: { crawlJobId, dedupKey } });
      if (existing) return;
      await this.prisma.issue.create({
        data: {
          crawlJobId,
          projectId,
          fingerprint,
          groupKey,
          pageId: pageId ?? undefined,
          issueType: issue.issueType,
          severity: issue.severity as never,
          confidence: issue.confidence as never,
          category: 'TECHNICAL' as never,
          affectedUrl,
          description: issue.description,
          explanation: issue.explanation,
          impact: issue.impact,
          recommendation: issue.recommendation,
          evidence: issue.evidence,
          dedupKey,
          status: 'OPEN',
          aiFixAvailable: false,
        },
      });
      await this.prisma.crawlJob.update({ where: { id: crawlJobId }, data: { issuesFound: { increment: 1 } } });
    } catch (err) {
      this.logger.error(`[JOB ${crawlJobId}] Could not persist ${issue.issueType} for ${affectedUrl}`, err);
    }
  }

  private isRootUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  }

  /**
   * Stores the social profiles a page links to, against the site being crawled.
   *
   * Written per page rather than once at the end because the page fetches are
   * distributed across workers and no single process sees the whole crawl. The
   * per-profile page count is the point: a business's own accounts sit in the
   * footer and so arrive once per page, while a link to a partner's profile
   * arrives once, and that difference is the only honest way to pick a site's
   * own account when it publishes more than one. Counted against the job, so
   * the figure stays comparable to that crawl's own page total.
   *
   * External links are otherwise not persisted at all, and deliberately still
   * are not — a site's outbound links run to hundreds per page and none of the
   * rest is read by anything.
   */
  async recordSocialLinks(crawlJobId: string, externalLinks: { targetUrl: string }[]): Promise<void> {
    if (!crawlJobId || !externalLinks?.length) return;

    const profiles = extractSocialProfiles(externalLinks.map((link) => link.targetUrl));
    if (profiles.length === 0) return;

    for (const profile of profiles) {
      try {
        await this.prisma.siteSocialLink.upsert({
          where: {
            crawlJobId_platform_handle: {
              crawlJobId,
              platform: profile.platform,
              handle: profile.handle,
            },
          },
          update: { pageCount: { increment: 1 }, profileUrl: profile.profileUrl },
          create: {
            crawlJobId,
            platform: profile.platform,
            handle: profile.handle,
            profileUrl: profile.profileUrl,
            pageCount: 1,
          },
        });
      } catch (err) {
        // A profile that fails to store costs this site one discovery lead. It
        // must not fail the page, which carries the crawl's actual findings.
        this.logger.debug(`Could not record ${profile.platform} ${profile.handle}: ${err}`);
      }
    }
  }
}
