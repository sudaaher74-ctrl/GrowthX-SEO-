import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { COMPETITOR_STATUS } from '../content-intelligence/competitor-status';

/** One step of onboarding, and whether it has actually happened yet. */
export interface DiscoveryStep {
  /** `pending` — not reached. `running` — under way. `done`. `skipped`. `failed`. */
  state: 'pending' | 'running' | 'done' | 'skipped' | 'failed';
  /** What the step found, in the operator's language. Never a guess. */
  detail: string;
  at?: string;
}

export interface DiscoveryStatus {
  projectId: string;
  domain: string | null;
  steps: {
    websiteAdded: DiscoveryStep;
    websiteCrawled: DiscoveryStep;
    businessIdentified: DiscoveryStep;
    competitorsIdentified: DiscoveryStep;
    competitorsCrawled: DiscoveryStep;
    socialAccountsFound: DiscoveryStep;
  };
  competitors: Array<{
    id: string;
    domain: string;
    name: string | null;
    status: string;
    lastAnalyzedAt: string | null;
    socialAccounts: Array<{ platform: string; handle: string }>;
  }>;
  ownSocialAccounts: Array<{
    platform: string;
    handle: string | null;
    profileUrl: string | null;
    /** `crawl` — read off their own site. `connected` — authorised by them. */
    origin: 'crawl' | 'connected';
  }>;
}

/**
 * Where a project has got to in the run from "website added" to "competitors
 * being tracked".
 *
 * Every step reports what is stored and nothing else. A step that has not run
 * says so rather than reporting a zero: "no competitor has been crawled yet"
 * and "the competitors have no pages" lead a reader to opposite conclusions,
 * and the difference is the whole value of this endpoint during onboarding.
 */
@Injectable()
export class DiscoveryStatusService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(organizationId: string, projectId: string): Promise<DiscoveryStatus> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...(organizationId ? { organizationId } : {}) },
      select: {
        id: true,
        createdAt: true,
        competitorsIdentifiedAt: true,
        businessProfile: { select: { industry: true, businessName: true, detectedAt: true, confidence: true } },
        websites: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { id: true, domain: true },
        },
      },
    });
    if (!project) throw new NotFoundException('Project not found.');

    const website = project.websites[0] ?? null;

    const [latestCrawl, competitors, ownAccounts] = await Promise.all([
      website
        ? this.prisma.crawlJob.findFirst({
            where: { websiteId: website.id },
            orderBy: { createdAt: 'desc' },
            select: { status: true, pagesCrawled: true, finishedAt: true, startedAt: true },
          })
        : null,
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          domain: true,
          name: true,
          status: true,
          lastAnalyzedAt: true,
          socialAccounts: { where: { isActive: true }, select: { platform: true, handle: true } },
        },
      }),
      this.prisma.socialAccount.findMany({
        where: { projectId },
        select: { platform: true, handle: true, profileUrl: true, discoverySource: true, status: true },
      }),
    ]);

    const crawled = competitors.filter((c) => c.lastAnalyzedAt !== null);
    const withAccounts = competitors.filter((c) => c.socialAccounts.length > 0);

    return {
      projectId,
      domain: website?.domain ?? null,
      steps: {
        websiteAdded: website
          ? { state: 'done', detail: website.domain, at: project.createdAt.toISOString() }
          : { state: 'pending', detail: 'No website has been added to this project yet.' },

        websiteCrawled: this.crawlStep(latestCrawl),

        businessIdentified: project.businessProfile
          ? {
              state: 'done',
              detail: `${project.businessProfile.businessName} — ${project.businessProfile.industry} (${project.businessProfile.confidence} confidence)`,
              at: project.businessProfile.detectedAt.toISOString(),
            }
          : { state: 'pending', detail: "The business behind this site has not been read yet." },

        competitorsIdentified: project.competitorsIdentifiedAt
          ? {
              state: 'done',
              detail:
                competitors.length > 0
                  ? `${competitors.length} competitor(s) tracked.`
                  : 'Identification ran and found no competitor that could be verified.',
              at: project.competitorsIdentifiedAt.toISOString(),
            }
          : competitors.length > 0
            ? { state: 'done', detail: `${competitors.length} competitor(s) added by hand.` }
            : { state: 'pending', detail: 'Competitors are identified once the first crawl finishes.' },

        competitorsCrawled:
          competitors.length === 0
            ? { state: 'pending', detail: 'No competitor is being tracked yet.' }
            : crawled.length === competitors.length
              ? { state: 'done', detail: `All ${competitors.length} competitor site(s) crawled.` }
              : {
                  state: 'running',
                  detail: `${crawled.length} of ${competitors.length} competitor site(s) crawled so far.`,
                },

        socialAccountsFound: this.socialStep(ownAccounts.length, withAccounts.length, competitors.length),
      },
      competitors: competitors.map((competitor) => ({
        id: competitor.id,
        domain: competitor.domain,
        name: competitor.name,
        status: competitor.status,
        lastAnalyzedAt: competitor.lastAnalyzedAt?.toISOString() ?? null,
        socialAccounts: competitor.socialAccounts,
      })),
      ownSocialAccounts: ownAccounts.map((account) => ({
        platform: account.platform,
        handle: account.handle,
        profileUrl: account.profileUrl,
        origin: account.status === 'CONNECTED' ? 'connected' : 'crawl',
      })),
    };
  }

  private crawlStep(
    crawl: { status: string; pagesCrawled: number; finishedAt: Date | null; startedAt: Date | null } | null,
  ): DiscoveryStep {
    if (!crawl) return { state: 'pending', detail: 'This site has not been crawled yet.' };

    if (crawl.status === 'RUNNING' || crawl.status === 'PENDING') {
      return {
        state: 'running',
        detail: `${crawl.pagesCrawled} page(s) so far.`,
        at: crawl.startedAt?.toISOString(),
      };
    }
    if (crawl.status !== 'COMPLETED') {
      return { state: 'failed', detail: `The last crawl ended as ${crawl.status}.` };
    }
    return {
      state: 'done',
      detail: `${crawl.pagesCrawled} page(s) crawled.`,
      at: crawl.finishedAt?.toISOString(),
    };
  }

  private socialStep(own: number, competitorsWithAccounts: number, competitors: number): DiscoveryStep {
    if (own === 0 && competitorsWithAccounts === 0) {
      return {
        state: 'pending',
        // Said this way on purpose. Social profiles are read out of the crawls,
        // so before a crawl there is nothing to read, and after one this same
        // count of zero means the sites publish no profiles — which is a fact
        // about those businesses, not a gap in the product.
        detail: 'No social profile has been found on the crawled sites.',
      };
    }
    return {
      state: 'done',
      detail: [
        own > 0 ? `${own} on your own site` : null,
        competitors > 0 ? `${competitorsWithAccounts} of ${competitors} competitor(s) with accounts` : null,
      ]
        .filter(Boolean)
        .join('; '),
    };
  }
}
