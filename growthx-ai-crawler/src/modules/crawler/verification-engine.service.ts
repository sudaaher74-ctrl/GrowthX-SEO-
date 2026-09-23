import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FetcherService } from './fetcher.service';
import * as cheerio from 'cheerio';
import { createHash } from 'crypto';
import { verdictFor } from './verification-verdict';

export interface VerificationCertificateItem {
  id: string;
  issueId?: string;
  url: string;
  issueType: string;
  beforeMetric: string;
  afterMetric: string;
  status: 'VERIFIED' | 'FAILED' | 'PARTIAL';
  httpStatus: number;
  responseTimeMs: number;
  detectedSchemas: string[];
  hasCanonical: boolean;
  hasMetaDescription: boolean;
  title: string | null;
  proofSummary: string;
}

export interface VerificationCertificate {
  certificateId: string;
  projectId: string;
  domain: string;
  verifiedAt: string;
  verifiedBy: string;
  auditMethod: string;
  status: 'PASSED' | 'PARTIAL' | 'FAILED';
  passedCount: number;
  failedCount: number;
  totalTested: number;
  avgLatencyMs: number;
  checksum: string;
  items: VerificationCertificateItem[];
}

export interface RunVerificationOptions {
  issueIds?: string[];
  urls?: string[];
  sprintWeek?: number;
}

@Injectable()
export class VerificationEngineService {
  private readonly logger = new Logger(VerificationEngineService.name);
  private readonly certificateCache = new Map<string, VerificationCertificate>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly fetcher: FetcherService,
  ) {}

  /**
   * Re-crawls target URLs or issues with Googlebot simulation, verifies resolution,
   * updates database state in Prisma, and generates a signed Verification Certificate.
   */
  async runVerification(
    organizationId: string,
    projectId: string,
    options: RunVerificationOptions = {},
  ): Promise<VerificationCertificate> {
    this.logger.log(`Starting live re-crawl verification for project ${projectId}`);

    // 1. Resolve target website for the project
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      include: { project: true },
    });

    if (!website) {
      throw new NotFoundException(`No website associated with project ${projectId}`);
    }

    const domain = website.domain;
    const baseOrigin = website.url.startsWith('http') ? website.url : `https://${domain}`;

    // 2. Resolve target issues
    let issuesToVerify: Array<{
      id: string;
      issueType: string;
      severity: string;
      affectedUrl: string;
      description: string;
      recommendation: string;
      status: string;
      evidence: string | null;
    }> = [];

    if (options.issueIds && options.issueIds.length > 0) {
      issuesToVerify = await this.prisma.issue.findMany({
        where: { id: { in: options.issueIds } },
        select: {
          id: true,
          issueType: true,
          severity: true,
          affectedUrl: true,
          description: true,
          recommendation: true,
          status: true,
          evidence: true,
        },
      });
    } else {
      // Find latest crawl job for website
      const latestJob = await this.prisma.crawlJob.findFirst({
        where: { websiteId: website.id },
        orderBy: { createdAt: 'desc' },
      });

      if (latestJob) {
        issuesToVerify = await this.prisma.issue.findMany({
          where: { crawlJobId: latestJob.id },
          take: 25,
          orderBy: { severity: 'desc' },
          select: {
            id: true,
            issueType: true,
            severity: true,
            affectedUrl: true,
            description: true,
            recommendation: true,
            status: true,
            evidence: true,
          },
        });
      }
    }

    // 3. Collect list of URLs to verify
    const urlTargets: Array<{
      url: string;
      issue?: (typeof issuesToVerify)[number];
    }> = [];

    if (issuesToVerify.length > 0) {
      for (const issue of issuesToVerify) {
        let fullUrl = issue.affectedUrl;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${baseOrigin}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }
        urlTargets.push({ url: fullUrl, issue });
      }
    } else if (options.urls && options.urls.length > 0) {
      for (const u of options.urls) {
        let fullUrl = u;
        if (!fullUrl.startsWith('http')) {
          fullUrl = `${baseOrigin}${fullUrl.startsWith('/') ? '' : '/'}${fullUrl}`;
        }
        urlTargets.push({ url: fullUrl });
      }
    } else {
      urlTargets.push({ url: baseOrigin });
    }

    // 4. Perform live re-crawl on each target URL
    const items: VerificationCertificateItem[] = [];
    let totalLatency = 0;
    let latencySamples = 0;
    const resolvedIssueIds: string[] = [];

    for (let i = 0; i < urlTargets.length; i++) {
      const target = urlTargets[i];
      const issue = target.issue;
      const targetUrl = target.url;

      // A fetch that threw has no status and no latency. It used to be
      // recorded as HTTP 200 in 85ms.
      const fetchResult = await this.fetcher.fetchPage(targetUrl).catch((err) => ({
        url: targetUrl,
        finalUrl: targetUrl,
        statusCode: 0,
        responseTimeMs: 0,
        html: '',
        redirectChain: [targetUrl],
        engine: 'cheerio' as const,
        errorMessage: err.message as string,
      }));

      if (fetchResult.statusCode > 0) {
        totalLatency += fetchResult.responseTimeMs;
        latencySamples++;
      }

      // Parse HTML with Cheerio if available
      const $ = cheerio.load(fetchResult.html || '');
      const title = $('title').text().trim() || null;
      const metaDescription = $('meta[name="description"]').attr('content')?.trim() || null;
      const canonical = $('link[rel="canonical"]').attr('href')?.trim() || null;

      // Extract JSON-LD schemas
      const detectedSchemas: string[] = [];
      $('script[type="application/ld+json"]').each((_, el) => {
        try {
          const raw = $(el).html();
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed['@type']) {
              if (Array.isArray(parsed['@type'])) {
                detectedSchemas.push(...parsed['@type']);
              } else {
                detectedSchemas.push(parsed['@type']);
              }
            } else if (Array.isArray(parsed)) {
              parsed.forEach((item) => {
                if (item['@type']) detectedSchemas.push(item['@type']);
              });
            }
          }
        } catch {}
      });

      const issueType = issue?.issueType || 'Technical SEO Compliance';
      const beforeMetric = issue?.description || `${(issue?.severity || 'MEDIUM').toUpperCase()} defect detected during previous audit`;

      let status: 'VERIFIED' | 'FAILED' | 'PARTIAL';
      let afterMetric: string;
      let proofSummary: string;

      if (fetchResult.statusCode === 0 || fetchResult.statusCode >= 400 || !fetchResult.html) {
        status = 'FAILED';
        afterMetric = fetchResult.statusCode ? `HTTP ${fetchResult.statusCode} Error` : 'Page could not be fetched';
        proofSummary = fetchResult.errorMessage || `Target URL returned HTTP ${fetchResult.statusCode} during re-fetch.`;
      } else if (!issue) {
        // No issue to prove: this is only a reachability check.
        status = 'VERIFIED';
        afterMetric = `HTTP ${fetchResult.statusCode} · ${fetchResult.responseTimeMs}ms TTFB`;
        proofSummary = `Page re-fetched and answered HTTP ${fetchResult.statusCode}.`;
      } else {
        ({ status, afterMetric, proofSummary } = verdictFor(issue.issueType, {
          url: fetchResult.finalUrl || targetUrl,
          title,
          metaDescription,
          canonical,
          h1Count: $('h1').length,
          imagesMissingAlt: $('img:not([alt])').length,
          metaRobots: $('meta[name="robots"]').attr('content')?.trim() || null,
          schemaTypes: detectedSchemas,
        }));
      }

      if (issue && status === 'VERIFIED') {
        resolvedIssueIds.push(issue.id);
      }

      items.push({
        id: `cert-item-${i + 1}-${Date.now().toString(36)}`,
        issueId: issue?.id,
        url: targetUrl,
        issueType,
        beforeMetric,
        afterMetric,
        status,
        httpStatus: fetchResult.statusCode,
        responseTimeMs: fetchResult.responseTimeMs,
        detectedSchemas,
        hasCanonical: Boolean(canonical),
        hasMetaDescription: Boolean(metaDescription),
        title,
        proofSummary,
      });
    }

    // 5. Update resolved issues in Prisma database
    if (resolvedIssueIds.length > 0) {
      await this.prisma.issue.updateMany({
        where: { id: { in: resolvedIssueIds } },
        data: { status: 'RESOLVED' },
      });

      // Update CrawlJob counts if available
      const latestJob = await this.prisma.crawlJob.findFirst({
        where: { websiteId: website.id },
        orderBy: { createdAt: 'desc' },
      });

      if (latestJob) {
        await this.prisma.crawlJob.update({
          where: { id: latestJob.id },
          data: {
            resolvedIssuesCount: {
              increment: resolvedIssueIds.length,
            },
          },
        }).catch(() => {});
      }
    }

    // 6. Generate cryptographic checksum
    const passedCount = items.filter((i) => i.status === 'VERIFIED').length;
    const failedCount = items.filter((i) => i.status === 'FAILED').length;
    const totalTested = items.length;
    const avgLatencyMs = latencySamples > 0 ? Math.round(totalLatency / latencySamples) : 0;

    const certId = `CERT-GX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const verifiedAt = new Date().toISOString();

    const rawPayload = `${certId}:${domain}:${verifiedAt}:${passedCount}:${failedCount}:${items.map((i) => i.proofSummary).join('|')}`;
    const checksum = createHash('sha256').update(rawPayload).digest('hex');

    const certificate: VerificationCertificate = {
      certificateId: certId,
      projectId,
      domain,
      verifiedAt,
      verifiedBy: 'GrowthX crawler (live re-fetch)',
      auditMethod: 'Live HTTP re-fetch with HTML and JSON-LD inspection',
      // PASSED only when every item was actually proven; an item that one
      // fetch cannot settle keeps the certificate PARTIAL.
      status: passedCount === totalTested && totalTested > 0 ? 'PASSED' : passedCount > 0 ? 'PARTIAL' : 'FAILED',
      passedCount,
      failedCount,
      totalTested,
      avgLatencyMs,
      checksum,
      items,
    };

    // Cache the certificate for fast retrieval
    this.certificateCache.set(projectId, certificate);

    this.logger.log(
      `Live verification completed for ${domain}. ${passedCount}/${totalTested} passed. Checksum: ${checksum.slice(0, 12)}...`,
    );

    return certificate;
  }

  /**
   * Retrieves the most recent verification certificate for the project.
   */
  async getLatestCertificate(_organizationId: string, projectId: string): Promise<VerificationCertificate | null> {
    // Only a certificate a verification run actually produced. With none, the
    // answer is null: this used to assemble a PASSED certificate from issues
    // merely marked resolved, with HTTP 200, 64ms and detected schemas that
    // no request had observed.
    return this.certificateCache.get(projectId) ?? null;
  }
}
