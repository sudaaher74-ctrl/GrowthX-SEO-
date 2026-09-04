import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface GraphNode {
  url: string;
  crawlDepth: number;
  inDegree: number;
  outDegree: number;
  linkEquityScore: number;
  isOrphan: boolean;
  isExcessiveDepth: boolean;
}

export interface GraphAnalysisReport {
  jobId: string;
  totalNodes: number;
  totalEdges: number;
  orphanPages: string[];
  excessiveDepthPages: string[];
  nodes: GraphNode[];
}

@Injectable()
export class GraphService {
  private readonly logger = new Logger(GraphService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Constructs the directed internal link graph, normalizes edge targets,
   * calculates BFS crawl depth, link equity, and performs evidence-grounded orphan page analysis.
   */
  async generateGraphReport(crawlJobId: string): Promise<GraphAnalysisReport> {
    this.logger.log(`Generating internal link graph and equity analysis for Job: ${crawlJobId}`);

    // Fetch all crawled pages for this job with canonical & robots metadata
    const pages = await this.prisma.page.findMany({
      where: { crawlJobId },
      select: {
        id: true,
        url: true,
        statusCode: true,
        canonicalUrl: true,
        robotsMeta: true,
        pageType: true,
      },
    });

    if (pages.length === 0) {
      return {
        jobId: crawlJobId,
        totalNodes: 0,
        totalEdges: 0,
        orphanPages: [],
        excessiveDepthPages: [],
        nodes: [],
      };
    }

    const pageMap = new Map<string, { id: string; url: string; depth: number; pageType: string; canonicalUrl: string | null; isNoindex: boolean }>();
    for (const p of pages) {
      const isNoindex = Boolean(p.robotsMeta && p.robotsMeta.toLowerCase().includes('noindex'));
      pageMap.set(this.normalizeUrl(p.url), {
        id: p.id,
        url: p.url,
        depth: 999,
        pageType: p.pageType || 'OTHER',
        canonicalUrl: p.canonicalUrl,
        isNoindex,
      });
    }

    // Fetch all internal graph edges recorded during crawl
    const rawEdges = await this.prisma.internalGraph.findMany({
      where: { crawlJobId },
      select: { sourceUrl: true, targetUrl: true, crawlDepth: true },
    });

    // Calculate in-degree and out-degree using normalized URLs
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();
    const adjacencyList = new Map<string, string[]>();

    for (const p of pages) {
      const norm = this.normalizeUrl(p.url);
      inDegreeMap.set(norm, 0);
      outDegreeMap.set(norm, 0);
      adjacencyList.set(norm, []);
    }

    for (const edge of rawEdges) {
      const srcNorm = this.normalizeUrl(edge.sourceUrl);
      const tgtNorm = this.normalizeUrl(edge.targetUrl);

      if (!pageMap.has(srcNorm) || !pageMap.has(tgtNorm)) continue;
      if (srcNorm === tgtNorm) continue; // Ignore self-links for in-degree

      outDegreeMap.set(srcNorm, (outDegreeMap.get(srcNorm) || 0) + 1);
      inDegreeMap.set(tgtNorm, (inDegreeMap.get(tgtNorm) || 0) + 1);
      adjacencyList.get(srcNorm)?.push(tgtNorm);
    }

    // BFS from Homepage (depth 0) to compute exact minimal shortest-path depth
    const startPage = pages[0];
    const startNorm = this.normalizeUrl(startPage.url);
    if (startPage && pageMap.has(startNorm)) {
      const queue: Array<{ url: string; depth: number }> = [{ url: startNorm, depth: 0 }];
      const visited = new Set<string>([startNorm]);
      const sp = pageMap.get(startNorm);
      if (sp) sp.depth = 0;

      while (queue.length > 0) {
        const curr = queue.shift()!;
        const neighbors = adjacencyList.get(curr.url) || [];
        for (const nxt of neighbors) {
          if (!visited.has(nxt)) {
            visited.add(nxt);
            const nxtObj = pageMap.get(nxt);
            if (nxtObj) nxtObj.depth = curr.depth + 1;
            queue.push({ url: nxt, depth: curr.depth + 1 });
          }
        }
      }
    }

    // Calculate PageRank proxy link equity scores (3 iterations)
    const equityMap = new Map<string, number>();
    const d = 0.85;
    const n = pages.length || 1;
    for (const p of pages) {
      equityMap.set(this.normalizeUrl(p.url), 1.0 / n);
    }

    for (let iter = 0; iter < 3; iter++) {
      const nextEquity = new Map<string, number>();
      for (const p of pages) {
        const pNorm = this.normalizeUrl(p.url);
        let sumIn = 0;
        for (const [src, targets] of adjacencyList.entries()) {
          if (targets.includes(pNorm)) {
            const outCount = outDegreeMap.get(src) || 1;
            sumIn += (equityMap.get(src) || 0) / outCount;
          }
        }
        const newScore = (1 - d) / n + d * sumIn;
        nextEquity.set(pNorm, parseFloat((newScore * n).toFixed(4)));
      }
      for (const [k, v] of nextEquity.entries()) {
        equityMap.set(k, v);
      }
    }

    const nodes: GraphNode[] = [];
    const orphanPages: Array<{ url: string; pageId: string; reason: string; severity: 'HIGH' | 'MEDIUM' | 'LOW'; confidence: 'CONFIRMED' | 'LIKELY' | 'ADVISORY' }> = [];
    const excessiveDepthPages: string[] = [];

    for (const p of pages) {
      const pNorm = this.normalizeUrl(p.url);
      const inDeg = inDegreeMap.get(pNorm) || 0;
      const outDeg = outDegreeMap.get(pNorm) || 0;
      const meta = pageMap.get(pNorm);
      const depth = meta?.depth || 0;
      const equity = equityMap.get(pNorm) || 1.0;

      const isRoot = this.isRootPath(p.url);
      const isUtility = this.isUtilityPage(p.url);
      const isCanonicalizedAway = Boolean(meta?.canonicalUrl && this.normalizeUrl(meta.canonicalUrl) !== pNorm);

      let isOrphan = false;
      if (inDeg === 0 && !isRoot && !isUtility && !isCanonicalizedAway) {
        isOrphan = true;
        orphanPages.push({
          url: p.url,
          pageId: p.id,
          reason: `Incoming internal HTML links: 0 | Source pages checked: ${pages.length} | Canonicalized elsewhere: false`,
          severity: 'MEDIUM',
          confidence: 'CONFIRMED',
        });
      }

      const isExcessiveDepth = depth > 3 && depth < 999;
      if (isExcessiveDepth) excessiveDepthPages.push(p.url);

      nodes.push({
        url: p.url,
        crawlDepth: depth === 999 ? 4 : depth,
        inDegree: inDeg,
        outDegree: outDeg,
        linkEquityScore: equity,
        isOrphan,
        isExcessiveDepth,
      });

      this.prisma.internalGraph.updateMany({
        where: { crawlJobId, targetUrl: p.url },
        data: { crawlDepth: depth === 999 ? 4 : depth, linkEquityScore: equity },
      }).catch(() => {});
    }

    // Persist verified orphan and depth issues with deduplication
    for (const orphan of orphanPages) {
      const dedupKey = `${orphan.url}::ORPHAN_PAGE`;
      try {
        const existing = await this.prisma.issue.findFirst({
          where: { crawlJobId, dedupKey },
        });

        if (!existing) {
          await this.prisma.issue.create({
            data: {
              crawlJobId,
              pageId: orphan.pageId,
              issueType: 'ORPHAN_PAGE',
              severity: orphan.severity,
              confidence: orphan.confidence,
              category: 'LINKS',
              affectedUrl: orphan.url,
              description: 'Page has zero incoming internal links from crawlable HTML pages.',
              explanation: 'Orphan pages cannot be reached by site visitors through standard navigation and receive no internal link equity.',
              impact: 'Search engine crawlers may fail to index this page or consider it unimportant due to lack of internal link equity.',
              recommendation: 'Add contextual internal links from relevant category, blog, or navigation menus.',
              evidence: orphan.reason,
              dedupKey,
              status: 'OPEN',
              aiFixAvailable: true,
            },
          });

          await this.prisma.crawlJob.update({
            where: { id: crawlJobId },
            data: { issuesFound: { increment: 1 } },
          });
        }
      } catch (err) {
        this.logger.error(`Failed to record orphan page issue for ${orphan.url}`, err);
      }
    }

    for (const deepUrl of excessiveDepthPages) {
      const pObj = pages.find((p) => p.url === deepUrl);
      if (pObj) {
        const dedupKey = `${deepUrl}::EXCESSIVE_CRAWL_DEPTH`;
        try {
          const existing = await this.prisma.issue.findFirst({
            where: { crawlJobId, dedupKey },
          });

          if (!existing) {
            await this.prisma.issue.create({
              data: {
                crawlJobId,
                pageId: pObj.id,
                issueType: 'EXCESSIVE_CRAWL_DEPTH',
                severity: 'LOW',
                confidence: 'LIKELY',
                category: 'LINKS',
                affectedUrl: deepUrl,
                description: `Page requires ${pageMap.get(this.normalizeUrl(deepUrl))?.depth} clicks from the homepage to reach (guideline is ≤ 3).`,
                explanation: 'Deeply buried pages receive minimal PageRank and are crawled less frequently by search engines.',
                impact: 'Slower discovery of page updates and lower ranking potential for secondary keywords.',
                recommendation: 'Flatten the site architecture by introducing direct category links, breadcrumbs, or HTML sitemaps.',
                evidence: `Measured click depth from homepage: ${pageMap.get(this.normalizeUrl(deepUrl))?.depth}`,
                dedupKey,
                status: 'OPEN',
                aiFixAvailable: true,
              },
            });

            await this.prisma.crawlJob.update({
              where: { id: crawlJobId },
              data: { issuesFound: { increment: 1 } },
            });
          }
        } catch (err) {
          this.logger.error(`Failed to record excessive depth issue for ${deepUrl}`, err);
        }
      }
    }

    return {
      jobId: crawlJobId,
      totalNodes: nodes.length,
      totalEdges: rawEdges.length,
      orphanPages: orphanPages.map((o) => o.url),
      excessiveDepthPages,
      nodes,
    };
  }

  private normalizeUrl(rawUrl: string): string {
    try {
      const parsed = new URL(rawUrl);
      parsed.hash = ''; // strip fragments
      // Remove standard tracking parameters
      const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'ref'];
      for (const p of trackingParams) {
        parsed.searchParams.delete(p);
      }
      let pathname = parsed.pathname || '/';
      if (pathname.length > 1 && pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }
      return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${pathname}${parsed.search ? parsed.search : ''}`;
    } catch {
      return rawUrl.trim().toLowerCase();
    }
  }

  private isRootPath(rawUrl: string): boolean {
    try {
      const parsed = new URL(rawUrl);
      return parsed.pathname === '/' || parsed.pathname === '';
    } catch {
      return false;
    }
  }

  private isUtilityPage(rawUrl: string): boolean {
    const lower = rawUrl.toLowerCase();
    return (
      lower.includes('/login') ||
      lower.includes('/signin') ||
      lower.includes('/register') ||
      lower.includes('/signup') ||
      lower.includes('/cart') ||
      lower.includes('/checkout') ||
      lower.includes('/privacy') ||
      lower.includes('/terms') ||
      lower.includes('/cookie')
    );
  }
}
