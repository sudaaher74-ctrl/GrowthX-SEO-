import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { extractAndParseJson } from './utils/json-extractor.util';
import { WebsiteAuditInput } from './mammouth-seo.types';

const defaultLogger = new Logger('MammouthSeoHelpers');

/**
 * Condenses repetitive crawl telemetry into dense, representative signals.
 * Strips query parameter duplicates and truncates bloated lists.
 */
export function condenseCrawlSummary(summary?: WebsiteAuditInput['crawlDataSummary']): Record<string, any> {
  if (!summary) return { note: 'Standard crawl baseline' };

  const deduplicatedUrls = Array.from(new Set(
    (summary.sampleUrls || []).map(url => {
      try {
        const u = new URL(url);
        return `${u.origin}${u.pathname}`;
      } catch {
        return url;
      }
    })
  )).slice(0, 15);

  return {
    totalUrls: summary.totalUrls,
    sampleUrls: deduplicatedUrls,
    statusCodeCounts: summary.statusCodeCounts,
    detectedIssues: (summary.detectedIssues || []).slice(0, 12).map(i => ({
      issueType: i.issueType,
      count: i.count,
      sampleUrl: i.sampleUrl,
    })),
    slowestPages: (summary.slowPages || []).slice(0, 5),
    schemaTypesFound: (summary.schemaTypesFound || []).slice(0, 8),
  };
}

/**
 * A fallback here used to invent a health score and a summary sentence, which
 * reached the dashboard indistinguishable from a real analysis. An unparseable
 * model response is an outage, not a 75/100 site: fail loudly so the caller can
 * surface a warning instead of a fabricated verdict.
 */
export function parseResilientJson<T>(rawText: string, _fallback: T, customLogger?: Logger): T {
  if (!rawText?.trim()) {
    throw new ServiceUnavailableException(
      'Mammouth AI returned an empty response. No analysis was produced.',
    );
  }
  try {
    return extractAndParseJson(rawText) as T;
  } catch (err: any) {
    (customLogger || defaultLogger).warn(`Failed to parse AI JSON response: ${err.message}`);
    throw new ServiceUnavailableException(
      'Mammouth AI returned a malformed response. No analysis was produced.',
    );
  }
}
