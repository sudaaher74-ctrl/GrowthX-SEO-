import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export interface MatrixRow {
  topicOrPillar: string;
  categoryType: 'PILLAR' | 'TOPIC' | 'FORMAT' | 'FUNNEL';
  competitorCoverage: Record<string, boolean>; // competitorId or handle -> boolean
  competitorFrequency: Record<string, number>;
  customerCoverage: boolean;
  customerFrequency: number;
  gapStatus: 'SATURATED' | 'COMPETITOR_WINNING' | 'CUSTOMER_WINNING' | 'CUSTOMER_MISSING' | 'MARKET_GAP';
  opportunityScore: number;
}

/** One competitor as a column: the company, with every account it posts from. */
export interface CompetitorColumn {
  id: string;
  handle: string;
  name: string;
  /** Every platform this company was found on. */
  platforms: string[];
  /** The account rows folded into this column. */
  accountIds: string[];
}

export interface DetectedCampaign {
  id: string;
  competitorName: string;
  competitorHandle: string;
  theme: string;
  objective: string;
  startDate?: Date;
  endDate?: Date;
  contentCount: number;
  platforms: string[];
  sampleTitles: string[];
  performanceSignal: 'HIGH' | 'MEDIUM' | 'EMERGING';
}

/** Wider than this and the table stops being readable side by side. */
const MAX_COMPETITOR_COLUMNS = 6;

@Injectable()
export class CrossCompetitorMatrixService {
  private readonly logger = new Logger(CrossCompetitorMatrixService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generates the 3-4 competitor side-by-side comparison matrix vs customer.
   */
  async getCrossCompetitorMatrix(organizationId: string, projectId: string) {
    const [competitorAccounts, competitorContents, customerPosts] = await Promise.all([
      this.prisma.competitorAccount.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
          isActive: true,
        },
        select: {
          id: true,
          handle: true,
          displayName: true,
          platform: true,
          businessName: true,
          competitorId: true,
        },
        // Counted in accounts, not companies: one competitor active on four
        // platforms is four rows here and must still fold to one column.
        take: 30,
      }),
      this.prisma.competitorContent.findMany({
        where: {
          projectId,
          ...(organizationId ? { organizationId } : {}),
        },
        include: { classification: true, account: true },
        orderBy: { publishedAt: 'desc' },
      }),
      this.prisma.socialPost.findMany({
        where: { projectId, isCompetitor: false },
      }),
    ]);

    // One column per company, not per social account.
    //
    // Discovery registers an account per platform, so a competitor on both
    // Instagram and YouTube arrived as two columns with the same name. Three
    // competitors rendered as six columns reading "Country Delight, Amul,
    // BigBasket, Amul, BigBasket, Country Delight", which is why the header
    // looked duplicated. The accounts are folded back into the business they
    // belong to and their content is pooled.
    const competitorCols = foldAccountsIntoCompanies(competitorAccounts).slice(0, MAX_COMPETITOR_COLUMNS);
    const accountToCompany = new Map<string, string>();
    for (const company of competitorCols) {
      for (const accountId of company.accountIds) accountToCompany.set(accountId, company.id);
    }

    // Nothing has been collected yet, so there is nothing to compare.
    //
    // The matrix used to answer this case with all eight pillars scored
    // "MARKET_GAP, 90/100" — the branch that fires when neither side covers a
    // topic. On an empty database that is every row, so a customer whose
    // competitors had never been crawled was shown eight 90/100 opportunities
    // and a row of dashes. No data is not a market gap.
    if (competitorContents.length === 0) {
      return {
        competitors: competitorCols,
        matrixRows: [],
        winningContent: [],
        commonPatterns: [],
        campaigns: [],
        totalCompetitorVideosAnalyzed: 0,
        needsData: true,
        needsDataReason:
          competitorCols.length === 0
            ? 'No competitor social accounts are being tracked yet. Add competitors and their profiles will be discovered.'
            : "No competitor content has been collected yet, so there is nothing to compare against. This fills in once the content crawl has run for the accounts you're tracking.",
      };
    }

    // Standard Pillars to evaluate
    const standardPillars = [
      'EDUCATIONAL', 'PROJECT_SHOWCASE', 'BEFORE_AFTER', 'PRICING_GUIDE',
      'CUSTOMER_TESTIMONIAL', 'BEHIND_SCENES', 'TIPS_AND_HACKS', 'PRODUCT_DEMO',
    ];

    // Standard Formats to evaluate
    const standardFormats = [
      'SHORT_REEL', 'YOUTUBE_LONG_FORM', 'PROJECT_TOUR', 'TALKING_HEAD_DEMO', 'CAROUSEL',
    ];

    // Standard Funnel Stages
    const standardFunnel = ['AWARENESS', 'CONSIDERATION', 'CONVERSION', 'RETENTION'];

    const rows: MatrixRow[] = [];

    // 1. Build Pillar Rows
    for (const pillar of standardPillars) {
      const compCoverage: Record<string, boolean> = {};
      const compFreq: Record<string, number> = {};
      let totalCompMentions = 0;

      for (const comp of competitorCols) {
        const count = competitorContents.filter(
          c => accountToCompany.get(c.accountId) === comp.id && (
            c.classification?.contentPillar?.toUpperCase().includes(pillar.replace('_', '')) ||
            c.classification?.contentCategory?.toUpperCase().includes(pillar.replace('_', '')) ||
            c.title?.toUpperCase().includes(pillar.replace('_', '')) ||
            c.caption?.toUpperCase().includes(pillar.replace('_', ''))
          ),
        ).length;

        compCoverage[comp.id] = count > 0;
        compFreq[comp.id] = count;
        if (count > 0) totalCompMentions++;
      }

      // Customer coverage
      const custCount = customerPosts.filter(
        p => (p.content?.toUpperCase().includes(pillar.replace('_', '')) || false),
      ).length;
      const custCoverage = custCount > 0;

      let gapStatus: MatrixRow['gapStatus'] = 'CUSTOMER_MISSING';
      let oppScore = 50;

      if (totalCompMentions >= 2 && !custCoverage) {
        gapStatus = 'CUSTOMER_MISSING';
        oppScore = 85 + Math.min(10, totalCompMentions * 3);
      } else if (totalCompMentions >= 3 && custCoverage) {
        gapStatus = 'COMPETITOR_WINNING';
        oppScore = 75;
      } else if (totalCompMentions === 0 && !custCoverage) {
        gapStatus = 'MARKET_GAP';
        oppScore = 90;
      } else if (custCoverage && totalCompMentions <= 1) {
        gapStatus = 'CUSTOMER_WINNING';
        oppScore = 40;
      }

      rows.push({
        topicOrPillar: pillar.replace('_', ' '),
        categoryType: 'PILLAR',
        competitorCoverage: compCoverage,
        competitorFrequency: compFreq,
        customerCoverage: custCoverage,
        customerFrequency: custCount,
        gapStatus,
        opportunityScore: oppScore,
      });
    }

    // 2. Identify Top Winning Competitor Content
    const winningContent = competitorContents
      .map(c => ({
        id: c.id,
        title: c.title || c.caption?.slice(0, 60) || 'Untitled Video',
        platform: c.platform,
        contentType: c.contentType,
        views: c.viewsCount || 0,
        likes: c.likesCount || 0,
        comments: c.commentsCount || 0,
        thumbnailUrl: c.thumbnailUrl,
        publishedAt: c.publishedAt,
        topic: c.classification?.topic || 'General Topic',
        contentPillar: c.classification?.contentPillar || 'EDUCATIONAL',
        hookType: c.classification?.hookType || 'PROBLEM',
        whyItWorks: c.whyItWorks,
        competitorName: c.account?.displayName || c.account?.businessName || c.account?.handle,
      }))
      .sort((a, b) => (b.views || b.likes * 20) - (a.views || a.likes * 20))
      .slice(0, 10);

    // 3. Detect Campaigns
    const campaigns = this.detectCampaigns(competitorContents, competitorCols, accountToCompany);

    // 4. Winning Common Patterns, read off what the competitors actually post.
    //
    // These were two fixed paragraphs about "Talking Head + Visual Proof",
    // printed under the heading "Formulas proven across analyzed competitors"
    // whatever the competitors had posted — the same advice for a dairy and a
    // law firm. A pattern only earns the name if more than one competitor is
    // running it, so that is now the test.
    const commonPatterns = this.derivePatterns(competitorContents, competitorCols, accountToCompany);

    return {
      competitors: competitorCols,
      matrixRows: rows,
      winningContent,
      commonPatterns,
      campaigns,
      totalCompetitorVideosAnalyzed: competitorContents.length,
      needsData: false,
    };
  }

  /**
   * Content pillars that more than one competitor is actually running.
   *
   * Prevalence is counted in companies, not posts: one competitor publishing
   * forty reels is a habit, three competitors publishing four each is a
   * pattern, and only the second is worth telling a customer to copy.
   */
  private derivePatterns(
    contents: any[],
    competitors: CompetitorColumn[],
    accountToCompany: Map<string, string>,
  ): Array<{ pattern: string; prevalence: string; averagePerformance: string; format: string; recommendation: string }> {
    const byPillar = new Map<string, { companies: Set<string>; posts: number; views: number }>();

    for (const item of contents) {
      const pillar = item.classification?.contentPillar || item.classification?.contentCategory;
      if (!pillar) continue;
      const company = accountToCompany.get(item.accountId);
      if (!company) continue;

      const entry = byPillar.get(pillar) ?? { companies: new Set<string>(), posts: 0, views: 0 };
      entry.companies.add(company);
      entry.posts += 1;
      entry.views += item.viewsCount || 0;
      byPillar.set(pillar, entry);
    }

    const total = competitors.length || 1;

    return [...byPillar.entries()]
      .filter(([, entry]) => entry.companies.size >= 2)
      .sort((a, b) => b[1].companies.size - a[1].companies.size || b[1].views - a[1].views)
      .slice(0, 4)
      .map(([pillar, entry]) => {
        const averageViews = entry.posts > 0 ? Math.round(entry.views / entry.posts) : 0;
        return {
          pattern: pillar.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (c: string) => c.toUpperCase()),
          prevalence: `${entry.companies.size} of ${total} competitors`,
          averagePerformance: averageViews > 0 ? `${averageViews.toLocaleString()} average views` : `${entry.posts} posts seen`,
          format: `${entry.posts} posts across ${entry.companies.size} competitors`,
          recommendation: `${entry.companies.size} of your ${total} tracked competitors publish this and you do not — the clearest gap to close first.`,
        };
      });
  }

  private detectCampaigns(
    contents: any[],
    competitors: CompetitorColumn[],
    accountToCompany: Map<string, string>,
  ): DetectedCampaign[] {
    const campaigns: DetectedCampaign[] = [];

    for (const comp of competitors) {
      const compContents = contents.filter(c => accountToCompany.get(c.accountId) === comp.id);
      if (compContents.length === 0) continue;

      // Detect topic clusters in the competitor's content
      const topicMap: Record<string, any[]> = {};
      for (const item of compContents) {
        const key = item.classification?.topic || 'General Series';
        if (!topicMap[key]) topicMap[key] = [];
        topicMap[key].push(item);
      }

      for (const [theme, items] of Object.entries(topicMap)) {
        if (items.length >= 2) {
          campaigns.push({
            id: `camp_${comp.id}_${theme.toLowerCase().replace(/\s+/g, '_')}`,
            competitorName: comp.name,
            competitorHandle: comp.handle,
            theme: `${theme} Authority Series`,
            objective: 'Lead Generation & Trust Building',
            startDate: items[items.length - 1]?.publishedAt,
            endDate: items[0]?.publishedAt,
            contentCount: items.length,
            platforms: Array.from(new Set(items.map(i => i.platform))),
            sampleTitles: items.map(i => i.title || i.caption?.slice(0, 50)).slice(0, 4),
            performanceSignal: items.some(i => (i.viewsCount || 0) > 10000) ? 'HIGH' : 'MEDIUM',
          });
        }
      }
    }

    return campaigns;
  }
}

/**
 * Groups social accounts back into the companies that own them.
 *
 * `competitorId` — the tracked competitor domain this account belongs to — is
 * the reliable join; failing that the published business name is, and only
 * then the handle. Two accounts
 * that share none of those are treated as two companies, which is the safe
 * error: an extra column is confusing, a wrongly merged one is wrong.
 */
function foldAccountsIntoCompanies(
  accounts: Array<{
    id: string;
    handle: string;
    displayName?: string | null;
    platform: string;
    businessName?: string | null;
    competitorId?: string | null;
  }>,
): CompetitorColumn[] {
  const byCompany = new Map<string, CompetitorColumn>();

  for (const account of accounts) {
    const name = account.displayName || account.businessName || account.handle;
    const key = (account.competitorId || account.businessName || name || account.handle)
      .toString()
      .trim()
      .toLowerCase();

    const existing = byCompany.get(key);
    if (existing) {
      existing.accountIds.push(account.id);
      if (!existing.platforms.includes(account.platform)) existing.platforms.push(account.platform);
      continue;
    }

    byCompany.set(key, {
      id: account.competitorId || account.id,
      handle: account.handle,
      name,
      platforms: [account.platform],
      accountIds: [account.id],
    });
  }

  return [...byCompany.values()];
}
