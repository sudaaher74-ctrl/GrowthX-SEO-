import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../database/prisma.service';

export interface PerformanceMetrics {
  performanceScore?: number;
  accessibilityScore?: number;
  bestPracticesScore?: number;
  seoScore?: number;
  lcpMs?: number;
  inpMs?: number;
  clsScore?: number;
  isSimulated?: boolean;
}

@Injectable()
export class PerformanceService {
  private readonly logger = new Logger(PerformanceService.name);
  private readonly apiKey = process.env.PAGESPEED_API_KEY;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Fetches Google PageSpeed Insights Core Web Vitals and Lighthouse scores for a URL
   */
  async fetchPageSpeedMetrics(pageId: string, targetUrl: string, strategy: 'MOBILE' | 'DESKTOP' = 'MOBILE'): Promise<PerformanceMetrics> {
    this.logger.log(`Fetching PageSpeed Insights (${strategy}) for: ${targetUrl}`);

    let metrics: PerformanceMetrics = {};

    // PageSpeed v5 accepts requests without an API key — an unkeyed call is
    // rate-limited against a shared daily pool rather than rejected — so we try
    // regardless and simply record nothing when the quota is spent. A key only
    // raises the quota; it was never required to get real numbers.
    //
    // What this must never do again is invent them. This previously derived
    // Core Web Vitals from a hash of the URL, and the `isSimulated` flag was
    // not persisted, so fabricated scores were indistinguishable from measured
    // ones in the database and in the client's report.
    {
      const hasKey = Boolean(this.apiKey && this.apiKey !== 'your_google_pagespeed_api_key');
      try {
        const params = [
          `url=${encodeURIComponent(targetUrl)}`,
          `strategy=${strategy}`,
          'category=PERFORMANCE',
          'category=ACCESSIBILITY',
          'category=BEST_PRACTICES',
          'category=SEO',
          ...(hasKey ? [`key=${this.apiKey}`] : []),
        ].join('&');
        const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${params}`;

        // Keyless calls queue behind a shared pool and are slower.
        const response = await axios.get(apiUrl, { timeout: hasKey ? 20000 : 60000 });
        if (response.status === 200 && response.data) {
          const lighthouse = response.data.lighthouseResult?.categories || {};
          const audits = response.data.lighthouseResult?.audits || {};

          metrics = {
            performanceScore: lighthouse.performance?.score !== undefined ? Math.round(lighthouse.performance.score * 100) : undefined,
            accessibilityScore: lighthouse.accessibility?.score !== undefined ? Math.round(lighthouse.accessibility.score * 100) : undefined,
            bestPracticesScore: lighthouse['best-practices']?.score !== undefined ? Math.round(lighthouse['best-practices'].score * 100) : undefined,
            seoScore: lighthouse.seo?.score !== undefined ? Math.round(lighthouse.seo.score * 100) : undefined,
            lcpMs: audits['largest-contentful-paint']?.numericValue ? parseFloat((audits['largest-contentful-paint'].numericValue).toFixed(1)) : undefined,
            inpMs: audits['interaction-to-next-paint']?.numericValue ? parseFloat((audits['interaction-to-next-paint'].numericValue).toFixed(1)) : undefined,
            clsScore: audits['cumulative-layout-shift']?.numericValue ? parseFloat((audits['cumulative-layout-shift'].numericValue).toFixed(3)) : undefined,
            isSimulated: false,
          };
        }
      } catch (error: any) {
        // A failed measurement is missing data, not average data.
        const status = error?.response?.status;
        if (status === 429) {
          this.logger.warn(
            `PageSpeed quota exhausted for ${targetUrl}` +
              (hasKey
                ? '. Nothing recorded; it resets daily.'
                : '. Set PAGESPEED_API_KEY for a private quota — unkeyed calls share one pool with every anonymous caller.'),
          );
        } else {
          this.logger.warn(`PageSpeed failed for ${targetUrl}: ${error.message}. No performance data recorded.`);
        }
        return {};
      }
    }

    // Nothing measured (for example the API returned a non-200), so there is
    // nothing to store. Writing a row of undefined scores would show the page
    // as measured with blank results.
    if (metrics.performanceScore === undefined && metrics.lcpMs === undefined) {
      this.logger.warn(`PageSpeed returned no usable metrics for ${targetUrl}; nothing recorded.`);
      return {};
    }

    // Save to Database
    try {
      await this.prisma.performance.upsert({
        where: { pageId },
        update: {
          performanceScore: metrics.performanceScore,
          accessibilityScore: metrics.accessibilityScore,
          bestPracticesScore: metrics.bestPracticesScore,
          seoScore: metrics.seoScore,
          lcpMs: metrics.lcpMs,
          inpMs: metrics.inpMs,
          clsScore: metrics.clsScore,
          fetchedAt: new Date(),
        },
        create: {
          pageId,
          performanceScore: metrics.performanceScore,
          accessibilityScore: metrics.accessibilityScore,
          bestPracticesScore: metrics.bestPracticesScore,
          seoScore: metrics.seoScore,
          lcpMs: metrics.lcpMs,
          inpMs: metrics.inpMs,
          clsScore: metrics.clsScore,
        },
      });
    } catch (dbErr) {
      this.logger.error(`Error saving Performance metrics for page ${pageId}`, dbErr);
    }

    return metrics;
  }

}
