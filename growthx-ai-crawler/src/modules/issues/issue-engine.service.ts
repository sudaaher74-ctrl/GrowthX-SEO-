import { Injectable, Logger } from '@nestjs/common';
import * as cheerio from 'cheerio';
import * as url from 'url';
import { PrismaService } from '../../database/prisma.service';
import { ExtractedHtmlData } from '../extractor/html-extractor.service';
import { ExtractedImage } from '../analyzer/image-analyzer.service';
import { LinkAnalysisResult } from '../analyzer/link-analyzer.service';
import { ContentMetrics } from '../analyzer/content-analyzer.service';
import { ValidatedSchema } from '../analyzer/schema-validator.service';

export interface DetectedIssueInput {
  issueType: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY';
  category: 'TECHNICAL' | 'CONTENT' | 'SCHEMA' | 'LINKS' | 'PERFORMANCE';
  affectedUrl: string;
  description: string;
  explanation: string;
  impact: string;
  recommendation: string;
  evidence?: string;
  dedupKey: string;
  aiFixAvailable: boolean;
}

@Injectable()
export class IssueEngineService {
  private readonly logger = new Logger(IssueEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Executes 30+ automated Technical SEO checks for a crawled page, applies rigorous
   * severity/confidence grading, deduplicates findings, and persists unique issues to PostgreSQL.
   */
  async evaluateAndPersistIssues(
    crawlJobId: string,
    pageId: string,
    pageUrl: string,
    statusCode: number,
    redirectChain: string[],
    html: string,
    htmlData: ExtractedHtmlData,
    images: ExtractedImage[],
    links: LinkAnalysisResult,
    content: ContentMetrics,
    schemas: ValidatedSchema[],
    inSitemap: boolean,
    robotsTxtExists: boolean,
    pageType: string = 'OTHER'
  ): Promise<DetectedIssueInput[]> {
    const issues: DetectedIssueInput[] = [];
    const isHomePage = this.isRootUrl(pageUrl);

    // 1. Missing Title
    if (!htmlData.title || htmlData.title.trim() === '') {
      issues.push({
        issueType: 'MISSING_TITLE',
        severity: isHomePage ? 'CRITICAL' : 'HIGH',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: 'Page does not have an HTML <title> tag.',
        explanation: 'The title tag is one of the most critical on-page ranking signals and provides the clickable headline in search results.',
        impact: 'Search engines cannot identify the topic of this page and will synthesize an arbitrary title, hurting organic CTR.',
        recommendation: 'Add a unique, descriptive <title> tag between 30 and 60 characters containing targeted keywords.',
        evidence: 'HTML head contains no <title> element.',
        dedupKey: `${pageUrl}::MISSING_TITLE`,
        aiFixAvailable: true,
      });
    } else {
      const titleLen = htmlData.title.trim().length;
      // 2. Long Title
      if (titleLen > 65) {
        issues.push({
          issueType: 'LONG_TITLE',
          severity: titleLen > 80 ? 'MEDIUM' : 'LOW',
          confidence: 'LIKELY',
          category: 'CONTENT',
          affectedUrl: pageUrl,
          description: `Title tag is too long (${titleLen} characters, exceeds 60 character guideline).`,
          explanation: 'Google typically truncates titles longer than 600 pixels (~60-65 characters) with an ellipsis.',
          impact: 'Cut-off titles can lower search snippet readability and decrease organic click-through rates.',
          recommendation: 'Condense title to under 60 characters while placing the most important keywords at the beginning.',
          evidence: `Title: "${htmlData.title.trim()}" (${titleLen} characters)`,
          dedupKey: `${pageUrl}::LONG_TITLE`,
          aiFixAvailable: true,
        });
      }
      // 3. Short Title
      else if (titleLen < 30) {
        issues.push({
          issueType: 'SHORT_TITLE',
          severity: 'LOW',
          confidence: 'ADVISORY',
          category: 'CONTENT',
          affectedUrl: pageUrl,
          description: `Title tag is very short (${titleLen} characters).`,
          explanation: 'Short titles under 30 characters miss opportunities to target descriptive primary and secondary search queries.',
          impact: 'Suboptimal keyword relevance and missed organic traffic potential.',
          recommendation: 'Expand title to 30-60 characters with relevant brand or modifier keywords.',
          evidence: `Title: "${htmlData.title.trim()}" (${titleLen} characters)`,
          dedupKey: `${pageUrl}::SHORT_TITLE`,
          aiFixAvailable: true,
        });
      }
    }

    // 4. Missing Meta Description
    if (!htmlData.metaDescription || htmlData.metaDescription.trim() === '') {
      issues.push({
        issueType: 'MISSING_META_DESCRIPTION',
        severity: 'MEDIUM',
        confidence: 'LIKELY',
        category: 'CONTENT',
        affectedUrl: pageUrl,
        description: 'Page is missing a meta description tag.',
        explanation: 'A compelling meta description gives searchers a clear preview of page content in search results.',
        impact: 'Search engines will automatically extract arbitrary copy from the page body, which may not be conversion-focused.',
        recommendation: 'Add a concise meta description between 120 and 160 characters with targeted keywords and a clear call to action.',
        evidence: 'No <meta name="description"> tag found in page head.',
        dedupKey: `${pageUrl}::MISSING_META_DESCRIPTION`,
        aiFixAvailable: true,
      });
    } else {
      const descLen = htmlData.metaDescription.trim().length;
      if (descLen > 165) {
        issues.push({
          issueType: 'LONG_META_DESCRIPTION',
          severity: 'LOW',
          confidence: 'ADVISORY',
          category: 'CONTENT',
          affectedUrl: pageUrl,
          description: `Meta description is long (${descLen} characters, guideline is 120-160).`,
          explanation: 'Descriptions exceeding ~160 characters will be truncated in search results.',
          impact: 'Key messaging or calls to action may be cut off in snippets.',
          recommendation: 'Keep meta descriptions between 120 and 160 characters.',
          evidence: `Length: ${descLen} characters. Text: "${htmlData.metaDescription.trim()}"`,
          dedupKey: `${pageUrl}::LONG_META_DESCRIPTION`,
          aiFixAvailable: true,
        });
      }
    }

    // 5. Canonical checks
    if (!htmlData.canonicalUrl) {
      issues.push({
        issueType: 'MISSING_CANONICAL',
        severity: 'HIGH',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: 'Page does not specify a self-referencing or preferred canonical URL.',
        explanation: 'Canonical tags instruct search engines which URL version is authoritative when duplicate or parameterised URLs exist.',
        impact: 'Without a canonical, tracking parameters, sorting filters, or HTTP/HTTPS variations can create duplicate content issues.',
        recommendation: 'Add a self-referencing <link rel="canonical" href="..." /> tag in the <head>.',
        evidence: 'No <link rel="canonical"> tag detected.',
        dedupKey: `${pageUrl}::MISSING_CANONICAL`,
        aiFixAvailable: true,
      });
    } else {
      const canonical = htmlData.canonicalUrl.trim();
      // Broken protocol
      if (canonical.startsWith('http://') && pageUrl.startsWith('https://')) {
        issues.push({
          issueType: 'BROKEN_CANONICAL',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `Canonical URL specifies insecure HTTP protocol (${canonical}) on an HTTPS page.`,
          explanation: 'A canonical pointing to HTTP causes indexation conflicts on secure sites.',
          impact: 'Search engines may downgrade the page or index the insecure version.',
          recommendation: 'Update canonical URL to use secure https:// protocol.',
          evidence: `Page: ${pageUrl} -> Canonical: ${canonical}`,
          dedupKey: `${pageUrl}::BROKEN_CANONICAL`,
          aiFixAvailable: true,
        });
      }

      // Canonical points to external unrelated domain
      try {
        const pageHost = new URL(pageUrl).hostname.replace(/^www\./, '');
        const canonicalHost = new URL(canonical).hostname.replace(/^www\./, '');
        if (pageHost !== canonicalHost) {
          issues.push({
            issueType: 'CANONICAL_CROSS_DOMAIN',
            severity: 'CRITICAL',
            confidence: 'CONFIRMED',
            category: 'TECHNICAL',
            affectedUrl: pageUrl,
            description: `Canonical points to an external domain (${canonicalHost}).`,
            explanation: 'Cross-domain canonicals transfer ranking signals and instruct search engines not to index this domain.',
            impact: 'This page may be completely dropped from search results in favor of the external destination.',
            recommendation: 'Verify whether this cross-domain canonical is intentional, or replace with a self-referencing canonical.',
            evidence: `Page host: ${pageHost} | Canonical host: ${canonicalHost}`,
            dedupKey: `${pageUrl}::CANONICAL_CROSS_DOMAIN`,
            aiFixAvailable: false,
          });
        }
      } catch {}
    }

    // 6. Heading 1 (H1) checks
    if (!htmlData.h1 || htmlData.h1.length === 0) {
      issues.push({
        issueType: 'MISSING_H1',
        severity: 'MEDIUM',
        confidence: 'LIKELY',
        category: 'CONTENT',
        affectedUrl: pageUrl,
        description: 'Page does not contain any H1 heading element.',
        explanation: 'An H1 heading introduces the primary subject of the page for human readers and search crawlers.',
        impact: 'Weakened topical relevance signals for primary keywords.',
        recommendation: 'Add a single H1 heading prominently at the top of the main content region.',
        evidence: '0 <h1> elements found in DOM.',
        dedupKey: `${pageUrl}::MISSING_H1`,
        aiFixAvailable: true,
      });
    } else if (htmlData.h1.length > 1) {
      // HTML5 allows multiple H1s; classify as LOW or MEDIUM advisory
      issues.push({
        issueType: 'MULTIPLE_H1',
        severity: htmlData.h1.length > 3 ? 'MEDIUM' : 'LOW',
        confidence: 'ADVISORY',
        category: 'CONTENT',
        affectedUrl: pageUrl,
        description: `Page contains ${htmlData.h1.length} H1 headings. HTML5 allows this, but SEO best practice prefers a single primary H1.`,
        explanation: 'Multiple H1s can dilute the primary topical focus if used as generic section dividers.',
        impact: 'Minor dilution of heading hierarchy structure.',
        recommendation: 'Maintain a single primary H1 for the page title, and demote secondary section headings to H2 or H3.',
        evidence: JSON.stringify(htmlData.h1),
        dedupKey: `${pageUrl}::MULTIPLE_H1`,
        aiFixAvailable: true,
      });
    }

    // 7. Context-Aware Thin Content Detection
    if (statusCode === 200) {
      const thinThreshold = this.getThinContentThreshold(pageType, pageUrl);
      if (thinThreshold > 0 && content.wordCount < thinThreshold) {
        issues.push({
          issueType: 'THIN_CONTENT',
          severity: 'MEDIUM',
          confidence: 'LIKELY',
          category: 'CONTENT',
          affectedUrl: pageUrl,
          description: `Page has low meaningful word count (${content.wordCount} words; recommended threshold for ${pageType.toLowerCase()} is ${thinThreshold}).`,
          explanation: 'Pages with minimal unique body copy risk being classified as low-value or doorway pages by search quality algorithms.',
          impact: 'Reduced search visibility and lower likelihood of ranking for competitive search terms.',
          recommendation: 'Enrich page copy with detailed, high-quality information addressing search intent.',
          evidence: `Word count: ${content.wordCount} | Threshold: ${thinThreshold} | Extracted via: ${content.extractionMethod} (${content.mainContentSelector}) | Boilerplate: ${content.boilerplatePercentage}%`,
          dedupKey: `${pageUrl}::THIN_CONTENT`,
          aiFixAvailable: true,
        });
      }
    }

    // 8. Large HTML (> 150 KB)
    const htmlSizeKb = Buffer.byteLength(html || '', 'utf8') / 1024;
    if (htmlSizeKb > 150) {
      issues.push({
        issueType: 'LARGE_HTML',
        severity: htmlSizeKb > 300 ? 'MEDIUM' : 'LOW',
        confidence: 'CONFIRMED',
        category: 'PERFORMANCE',
        affectedUrl: pageUrl,
        description: `Raw HTML document size is ${htmlSizeKb.toFixed(1)} KB (exceeds 150 KB guideline).`,
        explanation: 'Bulky HTML payloads slow down time to first byte (TTFB) and consume unnecessary mobile bandwidth.',
        impact: 'Delays DOM parsing and increases crawl budget consumption.',
        recommendation: 'Minify HTML, inline critical CSS only, and remove redundant embedded SVG or JSON data.',
        evidence: `Document size: ${htmlSizeKb.toFixed(1)} KB`,
        dedupKey: `${pageUrl}::LARGE_HTML`,
        aiFixAvailable: false,
      });
    }

    // 9. Missing Image Alt Text
    const missingAltImages = images.filter((i) => i.isMissingAlt);
    if (missingAltImages.length > 0) {
      issues.push({
        issueType: 'MISSING_ALT_TEXT',
        severity: 'MEDIUM',
        confidence: 'CONFIRMED',
        category: 'CONTENT',
        affectedUrl: pageUrl,
        description: `${missingAltImages.length} image(s) lack descriptive alt text attributes.`,
        explanation: 'Alt text is required for web accessibility (screen readers) and helps search engines understand image contents.',
        impact: 'Missed opportunities for Google Images rankings and potential ADA accessibility compliance issues.',
        recommendation: 'Add concise, descriptive alt attributes to informative images.',
        evidence: `${missingAltImages.length} image(s) missing alt text. Samples: ${missingAltImages.slice(0, 3).map((img) => img.imageUrl).join(', ')}`,
        dedupKey: `${pageUrl}::MISSING_ALT_TEXT`,
        aiFixAvailable: true,
      });
    }

    // 10. Broken Images (4xx/5xx)
    const brokenImages = images.filter((i) => i.isBroken);
    if (brokenImages.length > 0) {
      issues.push({
        issueType: 'BROKEN_IMAGE',
        severity: 'HIGH',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: `${brokenImages.length} image(s) returned 4xx or 5xx HTTP errors.`,
        explanation: 'Broken image references cause visible layout glitches and broken user experiences.',
        impact: 'Harms user trust and wastes client bandwidth.',
        recommendation: 'Fix image source URLs or replace missing files on the media server.',
        evidence: brokenImages.slice(0, 3).map((img) => img.imageUrl).join(', '),
        dedupKey: `${pageUrl}::BROKEN_IMAGE`,
        aiFixAvailable: false,
      });
    }

    // 11. Status Code Errors
    if (statusCode >= 500) {
      issues.push({
        issueType: 'SERVER_ERROR_5XX',
        severity: 'CRITICAL',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: `Page returned HTTP status code ${statusCode} (Server Error).`,
        explanation: '5xx status codes indicate backend failure, application crash, or gateway timeouts.',
        impact: 'Search engines will de-index the page if 5xx errors persist, and users cannot access content.',
        recommendation: 'Inspect web server and application logs to resolve internal server error.',
        evidence: `HTTP Status Code: ${statusCode}`,
        dedupKey: `${pageUrl}::SERVER_ERROR_5XX`,
        aiFixAvailable: false,
      });
    } else if (statusCode >= 400) {
      issues.push({
        issueType: 'BROKEN_LINK_4XX',
        severity: isHomePage ? 'CRITICAL' : 'HIGH',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: `Page returned HTTP status code ${statusCode} (Client Error).`,
        explanation: '4xx errors occur when a page has been deleted, moved without a redirect, or linked with an incorrect URL.',
        impact: 'Dead ends for visitors and wasted search engine crawl budget.',
        recommendation: 'Restore missing content or establish a 301 permanent redirect to a relevant live page.',
        evidence: `HTTP Status Code: ${statusCode}`,
        dedupKey: `${pageUrl}::BROKEN_LINK_4XX`,
        aiFixAvailable: false,
      });
    }

    // 12. Redirect Chains and Loops
    if (redirectChain.length > 2) {
      const isLoop = new Set(redirectChain).size < redirectChain.length;
      if (isLoop) {
        issues.push({
          issueType: 'REDIRECT_LOOP',
          severity: 'CRITICAL',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `Infinite redirect loop detected: ${redirectChain.join(' -> ')}`,
          explanation: 'Browsers and search crawlers abort navigation when encountering cyclical redirects.',
          impact: 'Page is completely inaccessible to users and crawlers.',
          recommendation: 'Fix server redirect rules to point directly to the destination URL.',
          evidence: `Redirect sequence: ${redirectChain.join(' -> ')}`,
          dedupKey: `${pageUrl}::REDIRECT_LOOP`,
          aiFixAvailable: false,
        });
      } else {
        issues.push({
          issueType: 'REDIRECT_CHAIN',
          severity: redirectChain.length > 4 ? 'HIGH' : 'MEDIUM',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `Page involves a redirect chain of ${redirectChain.length - 1} hops.`,
          explanation: 'Each redirect hop adds latency, degrades Core Web Vitals, and risks loss of link equity.',
          impact: 'Slower page loads and inefficient crawl budget usage.',
          recommendation: 'Update internal links to target the final destination URL directly.',
          evidence: `Hops: ${redirectChain.join(' -> ')}`,
          dedupKey: `${pageUrl}::REDIRECT_CHAIN`,
          aiFixAvailable: true,
        });
      }
    }

    // 13. Robots Meta Directives
    if (htmlData.robotsMeta) {
      const lower = htmlData.robotsMeta.toLowerCase();
      if (lower.includes('noindex')) {
        issues.push({
          issueType: 'NOINDEX_DETECTED',
          severity: isHomePage ? 'CRITICAL' : 'HIGH',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `Page contains robots meta directive "noindex".`,
          explanation: 'The noindex tag explicitly tells search engines not to display this URL in search results.',
          impact: 'Complete removal from organic search index if intended to be public.',
          recommendation: 'If this page is meant for search indexation, remove the noindex directive.',
          evidence: `robots meta: "${htmlData.robotsMeta}"`,
          dedupKey: `${pageUrl}::NOINDEX_DETECTED`,
          aiFixAvailable: true,
        });
      }

      if (lower.includes('index') && lower.includes('noindex')) {
        issues.push({
          issueType: 'INCORRECT_ROBOTS',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `Conflicting robots meta directives detected: "${htmlData.robotsMeta}".`,
          explanation: 'When both index and noindex are present, search engines default to the most restrictive directive (noindex).',
          impact: 'Unintended de-indexing of public pages.',
          recommendation: 'Clean up robots meta tag to state unambiguous instructions (e.g., "index, follow").',
          evidence: `robots meta: "${htmlData.robotsMeta}"`,
          dedupKey: `${pageUrl}::INCORRECT_ROBOTS`,
          aiFixAvailable: true,
        });
      }
    }

    // 14. HTTPS & Mixed Content
    if (pageUrl.startsWith('http://')) {
      issues.push({
        issueType: 'HTTPS_ISSUE',
        severity: 'CRITICAL',
        confidence: 'CONFIRMED',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: 'Page is served over unencrypted HTTP protocol.',
        explanation: 'HTTPS is a confirmed Google ranking factor and essential for web security and user privacy.',
        impact: 'Browsers display "Not Secure" warning badges, reducing conversions and organic rankings.',
        recommendation: 'Install SSL/TLS certificate and configure a site-wide 301 redirect to HTTPS.',
        evidence: `URL protocol: http://`,
        dedupKey: `${pageUrl}::HTTPS_ISSUE`,
        aiFixAvailable: false,
      });
    } else if (pageUrl.startsWith('https://')) {
      const $ = cheerio.load(html || '');
      let mixedCount = 0;
      $('img[src^="http://"], script[src^="http://"], link[rel="stylesheet"][href^="http://"]').each(() => {
        mixedCount++;
      });
      if (mixedCount > 0) {
        issues.push({
          issueType: 'MIXED_CONTENT',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'TECHNICAL',
          affectedUrl: pageUrl,
          description: `HTTPS page loads ${mixedCount} insecure HTTP resource(s).`,
          explanation: 'Modern browsers block active mixed content (scripts/styles) and warn users about passive mixed content.',
          impact: 'Asset loading blocks and visual security warnings.',
          recommendation: 'Update resource URLs to use relative paths or https://.',
          evidence: `${mixedCount} HTTP asset(s) on HTTPS page.`,
          dedupKey: `${pageUrl}::MIXED_CONTENT`,
          aiFixAvailable: true,
        });
      }
    }

    // 15. URL Hygiene
    if (pageUrl.length > 120 || /[A-Z]/.test(pageUrl) || pageUrl.includes('_')) {
      issues.push({
        issueType: 'URL_STRUCTURE_ISSUE',
        severity: 'LOW',
        confidence: 'ADVISORY',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: 'URL contains uppercase letters, underscores, or excessive length.',
        explanation: 'Google recommends using lowercase letters and hyphens rather than underscores in URL paths.',
        impact: 'Potential duplicate URL indexing if server is case-sensitive.',
        recommendation: 'Use lowercase URLs with hyphens as word delimiters.',
        evidence: `URL: ${pageUrl}`,
        dedupKey: `${pageUrl}::URL_STRUCTURE_ISSUE`,
        aiFixAvailable: false,
      });
    }

    // 16. XML Sitemap check
    if (!inSitemap && statusCode === 200 && !isHomePage) {
      issues.push({
        issueType: 'NOT_IN_SITEMAP',
        severity: 'LOW',
        confidence: 'ADVISORY',
        category: 'TECHNICAL',
        affectedUrl: pageUrl,
        description: 'Page is discoverable via internal links but missing from sitemap.xml.',
        explanation: 'XML sitemaps provide an authoritative inventory for search engines to schedule crawls.',
        impact: 'May take longer for new content or updates on this page to be indexed.',
        recommendation: 'Add this canonical URL to sitemap.xml.',
        evidence: 'URL not found in discovered XML sitemap.',
        dedupKey: `${pageUrl}::NOT_IN_SITEMAP`,
        aiFixAvailable: true,
      });
    }

    // 17. Structured Data / Schema Checks
    for (const schema of schemas) {
      if (schema.findings && schema.findings.length > 0) {
        for (const finding of schema.findings) {
          // Avoid creating multiple low severity noise rows
          issues.push({
            issueType: `SCHEMA_${schema.schemaType}_${finding.property.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`,
            severity: finding.severity,
            confidence: finding.confidence,
            category: 'SCHEMA',
            affectedUrl: pageUrl,
            description: finding.message,
            explanation: `Structured data for ${schema.schemaType} does not conform to Schema.org standards.`,
            impact: finding.isRequired
              ? 'Prevents eligibility for Google rich snippets.'
              : 'May limit enhanced rich snippet features in search results.',
            recommendation: finding.recommendation,
            evidence: `Schema: ${schema.schemaType} | Property: ${finding.property}`,
            dedupKey: `${pageUrl}::SCHEMA_${schema.schemaType}::${finding.property}`,
            aiFixAvailable: true,
          });
        }
      } else if (!schema.isValid) {
        issues.push({
          issueType: `SCHEMA_ERROR_${schema.schemaType}`,
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'SCHEMA',
          affectedUrl: pageUrl,
          description: `Structured data validation error in ${schema.schemaType}: ${schema.errors.join('; ')}`,
          explanation: 'Invalid JSON-LD schema syntax or structure.',
          impact: 'Search engines ignore invalid structured data blocks.',
          recommendation: `Correct JSON-LD properties for ${schema.schemaType}.`,
          evidence: schema.errors.join('; '),
          dedupKey: `${pageUrl}::SCHEMA_ERROR_${schema.schemaType}`,
          aiFixAvailable: true,
        });
      }
    }

    // 18. Duplicate Title check across crawl job
    if (htmlData.title && statusCode === 200) {
      const dupTitle = await this.prisma.page.findFirst({
        where: { crawlJobId, title: htmlData.title, NOT: { id: pageId } },
      });
      if (dupTitle) {
        issues.push({
          issueType: 'DUPLICATE_TITLE',
          severity: 'HIGH',
          confidence: 'CONFIRMED',
          category: 'CONTENT',
          affectedUrl: pageUrl,
          description: `Title tag is identical to another page on this website (${dupTitle.url}).`,
          explanation: 'Unique title tags differentiate pages for search algorithms and prevent internal keyword cannibalization.',
          impact: 'Search engines struggle to decide which URL to rank, diluting search impressions.',
          recommendation: 'Rewrite title tag to uniquely reflect the distinct topic of this specific page.',
          evidence: `Duplicate title: "${htmlData.title}" shared with ${dupTitle.url}`,
          dedupKey: `${pageUrl}::DUPLICATE_TITLE`,
          aiFixAvailable: true,
        });
      }
    }

    // Persist unique issues using stable deduplication keys
    const persistedIssues: DetectedIssueInput[] = [];
    const seenInBatch = new Set<string>();

    for (const issue of issues) {
      if (seenInBatch.has(issue.dedupKey)) continue;
      seenInBatch.add(issue.dedupKey);

      try {
        const existing = await this.prisma.issue.findFirst({
          where: { crawlJobId, dedupKey: issue.dedupKey },
        });

        if (!existing) {
          await this.prisma.issue.create({
            data: {
              crawlJobId,
              pageId,
              issueType: issue.issueType,
              severity: issue.severity,
              confidence: issue.confidence,
              category: issue.category,
              affectedUrl: issue.affectedUrl,
              description: issue.description,
              explanation: issue.explanation,
              impact: issue.impact,
              recommendation: issue.recommendation,
              evidence: issue.evidence,
              dedupKey: issue.dedupKey,
              status: 'OPEN',
              aiFixAvailable: issue.aiFixAvailable,
            },
          });

          await this.prisma.crawlJob.update({
            where: { id: crawlJobId },
            data: { issuesFound: { increment: 1 } },
          });

          persistedIssues.push(issue);
        }
      } catch (err) {
        this.logger.error(`Failed to persist issue ${issue.issueType} for ${pageUrl}`, err);
      }
    }

    return persistedIssues;
  }

  private isRootUrl(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  }

  private getThinContentThreshold(pageType: string, pageUrl: string): number {
    const urlLower = pageUrl.toLowerCase();

    // Contact pages are naturally short
    if (pageType === 'CONTACT' || urlLower.includes('/contact') || urlLower.includes('/get-in-touch')) {
      return 30; // Do not classify contact pages with minimal copy as thin content
    }

    // Product detail pages
    if (pageType === 'PRODUCT' || urlLower.includes('/product/')) {
      return 100;
    }

    // Category / index pages
    if (pageType === 'CATEGORY' || urlLower.includes('/category/') || urlLower.includes('/collections/')) {
      return 150;
    }

    // Legal / Privacy / Terms
    if (pageType === 'LEGAL' || urlLower.includes('/privacy') || urlLower.includes('/terms')) {
      return 200;
    }

    // General informational / blog pages
    return 250;
  }
}
