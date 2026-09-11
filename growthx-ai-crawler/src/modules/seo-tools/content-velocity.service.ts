import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface TopicClusterNode {
  url: string;
  title: string;
  h1: string;
  pageType: string;
  wordCount: number;
  role: 'PILLAR' | 'CLUSTER' | 'ORPHAN';
}

export interface TopicCluster {
  id: string;
  /** Representative topic label derived from shared keyword stem */
  topic: string;
  pillar: TopicClusterNode | null;
  clusterPages: TopicClusterNode[];
  orphanPages: TopicClusterNode[];
  /** Estimated cluster depth score 0–100 */
  depthScore: number;
  /** Missing spoke topics that competitors likely cover */
  contentGaps: string[];
}

export interface TopicClusterAnalysis {
  scoreboard: {
    totalPages: number;
    clusteredPages: number;
    orphanPages: number;
    pillarCount: number;
    avgClusterDepth: number;
  };
  clusters: TopicCluster[];
}

export interface CannibalizationGroup {
  keyword: string;
  pages: {
    url: string;
    title: string;
    wordCount: number;
    pageType: string;
    similarityScore: number;
  }[];
  recommendation: 'MERGE' | 'REDIRECT' | 'DIFFERENTIATE' | 'CANONICALIZE';
  primaryUrl: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  fix: string;
}

export interface CannibalizationReport {
  scoreboard: {
    totalGroups: number;
    highImpactGroups: number;
    affectedPages: number;
    estimatedEquityLoss: string;
  };
  groups: CannibalizationGroup[];
}

export interface ContentCalendarItem {
  id: string;
  week: number;
  phase: '30-day' | '60-day' | '90-day';
  contentType: 'PILLAR' | 'CLUSTER_SPOKE' | 'FAQ' | 'CASE_STUDY' | 'LANDING_PAGE';
  topic: string;
  targetCluster: string;
  suggestedTitle: string;
  suggestedSlug: string;
  targetWordCount: number;
  priorityScore: number;
  priorityReason: string;
  estimatedImpact: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ContentVelocityCalendar {
  scoreboard: {
    thirtyDayItems: number;
    sixtyDayItems: number;
    ninetyDayItems: number;
    totalItems: number;
    estimatedMonthlyTrafficLift: string;
  };
  calendar: ContentCalendarItem[];
}

type RawPage = {
  url: string;
  title: string | null;
  h1: string[];
  h2: string[];
  pageType: string;
  wordCount: number;
};

@Injectable()
export class ContentVelocityService {
  private readonly logger = new Logger(ContentVelocityService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Shared page fetcher (mirrors the pattern in InternalLinkingService)
  // ─────────────────────────────────────────────────────────────────────────

  private async fetchPages(projectId: string): Promise<RawPage[]> {
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true },
    });

    const select = {
      url: true,
      title: true,
      h1: true,
      h2: true,
      pageType: true,
      wordCount: true,
    };

    if (website?.id) {
      const pages = await this.prisma.page.findMany({
        where: {
          crawlJob: { websiteId: website.id, status: 'COMPLETED' },
          statusCode: { gte: 200, lt: 400 },
        },
        select,
        take: 500,
      });
      if (pages.length > 0) return pages as RawPage[];
    }

    // Fallback: any COMPLETED crawl for this project via website relation
    return this.prisma.page.findMany({
      where: {
        crawlJob: { website: { projectId } },
        statusCode: { gte: 200, lt: 400 },
      },
      select,
      distinct: ['url'],
      take: 500,
    }) as Promise<RawPage[]>;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Topic Cluster Engine
  // ─────────────────────────────────────────────────────────────────────────

  async getTopicClusters(projectId: string): Promise<TopicClusterAnalysis> {
    const pages = await this.fetchPages(projectId);

    if (pages.length === 0) {
      return {
        scoreboard: { totalPages: 0, clusteredPages: 0, orphanPages: 0, pillarCount: 0, avgClusterDepth: 0 },
        clusters: [],
      };
    }

    // Build keyword stems from title/h1 for each page
    const pageTerms = pages.map((p) => ({
      url: p.url,
      title: p.title ?? '',
      h1: (p.h1?.[0] ?? p.title ?? ''),
      h2: p.h2 ?? [],
      pageType: p.pageType,
      wordCount: p.wordCount,
      stems: extractStems(p.title ?? '', p.h1?.[0] ?? ''),
    }));

    // Group pages by shared keyword stems (Jaccard similarity)
    const clusterMap = new Map<string, typeof pageTerms>();

    for (const page of pageTerms) {
      let assigned = false;
      for (const [topic, clusterPages] of clusterMap.entries()) {
        const overlap = stemOverlap(page.stems, extractStemsFromTopic(topic));
        if (overlap >= 0.3) {
          clusterPages.push(page);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        const topicKey = topicFromStems(page.stems) || page.h1.slice(0, 40);
        clusterMap.set(topicKey, [page]);
      }
    }

    // Build cluster objects
    const clusters: TopicCluster[] = [];

    for (const [topic, clusterPages] of clusterMap.entries()) {
      if (clusterPages.length < 1) continue;

      // Sort: pillar pages have highest wordCount & are SERVICE/PRODUCT/HOME
      const sorted = [...clusterPages].sort((a, b) => {
        const aPillar = ['SERVICE', 'PRODUCT', 'HOME'].includes(a.pageType) ? 1 : 0;
        const bPillar = ['SERVICE', 'PRODUCT', 'HOME'].includes(b.pageType) ? 1 : 0;
        if (aPillar !== bPillar) return bPillar - aPillar;
        return b.wordCount - a.wordCount;
      });

      const pillarCandidate = sorted[0];
      const pillar: TopicClusterNode = {
        url: pillarCandidate.url,
        title: pillarCandidate.title,
        h1: pillarCandidate.h1,
        pageType: pillarCandidate.pageType,
        wordCount: pillarCandidate.wordCount,
        role: 'PILLAR',
      };

      const spokes: TopicClusterNode[] = sorted.slice(1).map((p) => ({
        url: p.url,
        title: p.title,
        h1: p.h1,
        pageType: p.pageType,
        wordCount: p.wordCount,
        role: 'CLUSTER' as const,
      }));

      // Content gaps: suggest missing spoke types based on h2s not covered
      const existingH2s = new Set(
        clusterPages.flatMap((p) => p.h2).map((h) => h.toLowerCase()),
      );
      const standardSpokes = ['how to', 'benefits', 'examples', 'guide', 'tips', 'vs ', 'review', 'price', 'near me', 'best'];
      const contentGaps = standardSpokes
        .filter((spoke) => !Array.from(existingH2s).some((h2) => h2.includes(spoke)))
        .slice(0, 4)
        .map((gap) => `${topic} — ${gap} article`);

      const depthScore = Math.min(100, Math.round((spokes.length / 6) * 60 + (pillarCandidate.wordCount > 1500 ? 40 : 20)));

      clusters.push({
        id: `cluster-${clusters.length}`,
        topic,
        pillar,
        clusterPages: spokes,
        orphanPages: [],
        depthScore,
        contentGaps,
      });
    }

    // Isolated clusters (0 spokes) → orphan pages
    const orphanPages = clusters
      .filter((c) => c.clusterPages.length === 0)
      .flatMap((c) => (c.pillar ? [{ ...c.pillar, role: 'ORPHAN' as const }] : []));

    const realClusters = clusters.filter((c) => c.clusterPages.length > 0);
    const totalPages = pages.length;
    const clusteredPages = realClusters.reduce((sum, c) => sum + c.clusterPages.length + 1, 0);
    const avgDepth = realClusters.length
      ? Math.round(realClusters.reduce((s, c) => s + c.depthScore, 0) / realClusters.length)
      : 0;

    return {
      scoreboard: {
        totalPages,
        clusteredPages,
        orphanPages: orphanPages.length,
        pillarCount: realClusters.length,
        avgClusterDepth: avgDepth,
      },
      clusters: realClusters.slice(0, 20),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Keyword Cannibalization Detector
  // ─────────────────────────────────────────────────────────────────────────

  async detectCannibalization(projectId: string): Promise<CannibalizationReport> {
    const pages = await this.fetchPages(projectId);

    if (pages.length === 0) {
      return {
        scoreboard: { totalGroups: 0, highImpactGroups: 0, affectedPages: 0, estimatedEquityLoss: '0%' },
        groups: [],
      };
    }

    const groups: CannibalizationGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < pages.length; i++) {
      if (processed.has(pages[i].url)) continue;
      const pageA = pages[i];
      const stemA = extractStems(pageA.title ?? '', pageA.h1?.[0] ?? '');
      if (stemA.length < 2) continue;

      const siblings: RawPage[] = [];
      for (let j = i + 1; j < pages.length; j++) {
        const pageB = pages[j];
        if (processed.has(pageB.url)) continue;
        const stemB = extractStems(pageB.title ?? '', pageB.h1?.[0] ?? '');
        const similarity = stemOverlap(stemA, stemB);
        if (similarity >= 0.45) {
          siblings.push(pageB);
        }
      }

      if (siblings.length > 0) {
        const all = [pageA, ...siblings];
        all.forEach((p) => processed.add(p.url));

        const primary = all.reduce((best, p) => (p.wordCount > best.wordCount ? p : best), all[0]);
        const keyword = topicFromStems(stemA) || (pageA.title ?? '').split(' ').slice(0, 4).join(' ');

        let recommendation: CannibalizationGroup['recommendation'] = 'DIFFERENTIATE';
        if (all.every((p) => p.pageType === primary.pageType)) recommendation = 'MERGE';
        else if (siblings.length === 1) recommendation = 'REDIRECT';
        else recommendation = 'CANONICALIZE';

        const impact: 'HIGH' | 'MEDIUM' | 'LOW' = all.length >= 3 ? 'HIGH' : 'MEDIUM';

        const fixMap: Record<CannibalizationGroup['recommendation'], string> = {
          MERGE: `Consolidate all ${all.length} pages into ${primary.url} using 301 redirects. Combine unique content sections.`,
          REDIRECT: `301 redirect ${siblings.map((p) => p.url).join(', ')} → ${primary.url}. Update all internal links.`,
          DIFFERENTIATE: `Differentiate by search intent: assign INFORMATIONAL, TRANSACTIONAL, and NAVIGATIONAL variants to separate pages with unique angles.`,
          CANONICALIZE: `Add rel=canonical on secondary pages pointing to ${primary.url}. Ensure each page has a unique H1.`,
        };

        groups.push({
          keyword,
          pages: all.map((p) => ({
            url: p.url,
            title: p.title ?? '',
            wordCount: p.wordCount,
            pageType: p.pageType,
            similarityScore: p.url === primary.url ? 100 : Math.round(stemOverlap(stemA, extractStems(p.title ?? '', p.h1?.[0] ?? '')) * 100),
          })),
          recommendation,
          primaryUrl: primary.url,
          impact,
          fix: fixMap[recommendation],
        });
      }
    }

    const highImpact = groups.filter((g) => g.impact === 'HIGH');
    const affectedPages = groups.reduce((s, g) => s + g.pages.length, 0);
    const lossEstimate = affectedPages > 10 ? '30–50%' : affectedPages > 5 ? '15–30%' : '5–15%';

    return {
      scoreboard: {
        totalGroups: groups.length,
        highImpactGroups: highImpact.length,
        affectedPages,
        estimatedEquityLoss: lossEstimate,
      },
      groups: groups.slice(0, 30),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Content Velocity Calendar
  // ─────────────────────────────────────────────────────────────────────────

  async getContentVelocityCalendar(projectId: string): Promise<ContentVelocityCalendar> {
    const clusterAnalysis = await this.getTopicClusters(projectId);
    const calendar: ContentCalendarItem[] = [];
    let itemId = 0;

    // Phase 1: 30-day — fix critical gaps in lowest-depth clusters
    const criticalClusters = [...clusterAnalysis.clusters]
      .sort((a, b) => a.depthScore - b.depthScore)
      .slice(0, 3);

    for (const cluster of criticalClusters) {
      if (cluster.depthScore < 50) {
        calendar.push({
          id: `cal-${++itemId}`,
          week: 1,
          phase: '30-day',
          contentType: 'PILLAR',
          topic: cluster.topic,
          targetCluster: cluster.topic,
          suggestedTitle: `The Complete Guide to ${cluster.topic}`,
          suggestedSlug: `/blog/${slugify(cluster.topic)}-complete-guide`,
          targetWordCount: 2500,
          priorityScore: 95,
          priorityReason: `Cluster has only ${cluster.clusterPages.length} spokes and ${cluster.depthScore}% depth — pillar upgrade critical`,
          estimatedImpact: 'HIGH',
        });
      }

      for (const gap of cluster.contentGaps.slice(0, 2)) {
        calendar.push({
          id: `cal-${++itemId}`,
          week: Math.ceil(calendar.length / 3) + 1,
          phase: '30-day',
          contentType: 'CLUSTER_SPOKE',
          topic: gap,
          targetCluster: cluster.topic,
          suggestedTitle: gap,
          suggestedSlug: `/blog/${slugify(gap)}`,
          targetWordCount: 1200,
          priorityScore: 80,
          priorityReason: `Missing cluster spoke for "${cluster.topic}" — fills topical authority gap`,
          estimatedImpact: 'HIGH',
        });
      }
    }

    // Phase 2: 60-day — expand medium-depth clusters
    const mediumClusters = [...clusterAnalysis.clusters]
      .filter((c) => c.depthScore >= 50 && c.depthScore < 75)
      .slice(0, 4);

    for (const cluster of mediumClusters) {
      for (const gap of cluster.contentGaps.slice(0, 2)) {
        calendar.push({
          id: `cal-${++itemId}`,
          week: 5 + Math.floor(calendar.length / 4),
          phase: '60-day',
          contentType: 'CLUSTER_SPOKE',
          topic: gap,
          targetCluster: cluster.topic,
          suggestedTitle: gap,
          suggestedSlug: `/blog/${slugify(gap)}`,
          targetWordCount: 1000,
          priorityScore: 65,
          priorityReason: `Medium-priority cluster spoke to push "${cluster.topic}" to full topical authority`,
          estimatedImpact: 'MEDIUM',
        });
      }

      calendar.push({
        id: `cal-${++itemId}`,
        week: 7 + Math.floor(calendar.length / 4),
        phase: '60-day',
        contentType: 'FAQ',
        topic: `${cluster.topic} FAQ`,
        targetCluster: cluster.topic,
        suggestedTitle: `${cluster.topic}: Frequently Asked Questions`,
        suggestedSlug: `/blog/${slugify(cluster.topic)}-faq`,
        targetWordCount: 800,
        priorityScore: 55,
        priorityReason: 'FAQ pages capture question-intent traffic and support featured snippet eligibility',
        estimatedImpact: 'MEDIUM',
      });
    }

    // Phase 3: 90-day — case studies for healthy clusters
    const healthyClusters = [...clusterAnalysis.clusters]
      .filter((c) => c.depthScore >= 75)
      .slice(0, 3);

    for (const cluster of healthyClusters) {
      calendar.push({
        id: `cal-${++itemId}`,
        week: 9 + Math.floor(calendar.length / 3),
        phase: '90-day',
        contentType: 'CASE_STUDY',
        topic: `${cluster.topic} Case Study`,
        targetCluster: cluster.topic,
        suggestedTitle: `How [Client] Achieved Results with ${cluster.topic}`,
        suggestedSlug: `/case-study/${slugify(cluster.topic)}`,
        targetWordCount: 1500,
        priorityScore: 45,
        priorityReason: 'Case studies build E-E-A-T authority and convert bottom-of-funnel traffic',
        estimatedImpact: 'HIGH',
      });
    }

    calendar.sort((a, b) => b.priorityScore - a.priorityScore);

    const thirtyDay = calendar.filter((i) => i.phase === '30-day').length;
    const sixtyDay = calendar.filter((i) => i.phase === '60-day').length;
    const ninetyDay = calendar.filter((i) => i.phase === '90-day').length;

    return {
      scoreboard: {
        thirtyDayItems: thirtyDay,
        sixtyDayItems: sixtyDay,
        ninetyDayItems: ninetyDay,
        totalItems: calendar.length,
        estimatedMonthlyTrafficLift: calendar.length >= 10 ? '+25–40%' : calendar.length >= 5 ? '+15–25%' : '+5–15%',
      },
      calendar,
    };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Utility helpers
// ─────────────────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of',
  'with', 'by', 'from', 'up', 'about', 'into', 'through', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
  'will', 'would', 'could', 'should', 'may', 'might', 'that', 'this', 'these',
  'those', 'it', 'its', 'we', 'you', 'your', 'our', 'my', 'their', 'how',
  'what', 'which', 'who', 'when', 'where', 'why', 'all', 'some', 'any', 'no',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
}

function extractStems(title: string, h1: string): string[] {
  return [...new Set([...tokenize(title), ...tokenize(h1)])];
}

function extractStemsFromTopic(topic: string): string[] {
  return tokenize(topic);
}

function stemOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter((x) => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

function topicFromStems(stems: string[]): string {
  return stems.slice(0, 2).join(' ');
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60);
}
