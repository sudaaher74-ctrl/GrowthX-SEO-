import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextService } from '../organizations/org-context.service';
import { JobStatus } from '@prisma/client';
import { VoiceAgentResult } from './voice-agent.types';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

/** Simple domain validation — no private IPs, valid TLD format. */
function validateDomain(domain: string): string {
  if (!domain) throw new BadRequestException('Domain is required.');
  const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(clean)) {
    throw new BadRequestException(`"${domain}" is not a valid domain name.`);
  }
  // Block private IP ranges / localhost
  const BLOCKED = /^(localhost|127\.|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.|0\.|::1)/;
  if (BLOCKED.test(clean)) {
    throw new BadRequestException('Private or loopback addresses are not allowed.');
  }
  return clean;
}

@Injectable()
export class VoiceToolsService {
  private readonly logger = new Logger(VoiceToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly orgContext: OrgContextService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  // ─── Crawl ───────────────────────────────────────────────────────────────────

  async crawlWebsite(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);

    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });
    if (!website) {
      return { success: false, tool: 'crawlWebsite', data: null, spokenSummary: "I couldn't find a website for this project. Please add one first." };
    }

    // Check for an already-running crawl
    const running = await this.prisma.crawlJob.findFirst({
      where: { websiteId: website.id, status: { in: [JobStatus.PENDING, JobStatus.RUNNING] } },
    });
    if (running) {
      return { success: true, tool: 'crawlWebsite', data: { jobId: running.id }, spokenSummary: `A crawl is already in progress for ${website.domain}. I'll keep you updated.` };
    }

    const job = await this.prisma.crawlJob.create({
      data: { websiteId: website.id, status: JobStatus.PENDING },
    });

    this.logger.log(`Voice-triggered crawl: jobId=${job.id} for ${website.domain}`);
    return {
      success: true,
      tool: 'crawlWebsite',
      data: { jobId: job.id, domain: website.domain },
      spokenSummary: `Started crawling ${website.domain}. I'll let you know when it's done.`,
      navigateTo: '/website',
    };
  }

  async getCrawlStatus(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);

    const website = await this.prisma.website.findFirst({ where: { projectId }, select: { id: true, domain: true } });
    if (!website) {
      return { success: false, tool: 'getCrawlStatus', data: null, spokenSummary: 'No website found for this project.' };
    }

    const job = await this.prisma.crawlJob.findFirst({
      where: { websiteId: website.id },
      orderBy: { createdAt: 'desc' },
    });
    if (!job) {
      return { success: true, tool: 'getCrawlStatus', data: null, spokenSummary: "No crawl has been run yet for this site. Say 'crawl our website' to start one." };
    }

    const statusMap: Record<string, string> = {
      PENDING: 'queued and waiting to start',
      RUNNING: `in progress — ${job.pagesCrawled} pages crawled so far`,
      COMPLETED: `complete — ${job.pagesCrawled} pages crawled, ${job.issuesFound} issues found`,
      FAILED: `failed with an error: ${job.errorMessage ?? 'unknown error'}`,
      CANCELLED: 'cancelled',
    };

    return {
      success: true,
      tool: 'getCrawlStatus',
      data: job,
      spokenSummary: `The last crawl of ${website.domain} is ${statusMap[job.status] ?? job.status}.`,
    };
  }

  async cancelCrawl(jobId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    if (!jobId) {
      return { success: false, tool: 'cancelCrawl', data: null, spokenSummary: "I need a crawl job ID to cancel. Say 'check crawl status' first." };
    }
    const job = await this.prisma.crawlJob.findUnique({ where: { id: jobId } });
    if (!job) throw new NotFoundException('Crawl job not found');
    if (job.status === JobStatus.COMPLETED || job.status === JobStatus.CANCELLED) {
      return { success: true, tool: 'cancelCrawl', data: null, spokenSummary: 'That crawl has already finished.' };
    }
    await this.prisma.crawlJob.update({ where: { id: jobId }, data: { status: JobStatus.CANCELLED } });
    return { success: true, tool: 'cancelCrawl', data: { jobId }, spokenSummary: 'Crawl cancelled.' };
  }

  // ─── Competitors ─────────────────────────────────────────────────────────────

  async addCompetitor(projectId: string, domain: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const cleanDomain = validateDomain(domain);

    const existing = await this.prisma.competitorDomain.findFirst({ where: { projectId, domain: cleanDomain } });
    if (existing) {
      return { success: true, tool: 'addCompetitor', data: existing, spokenSummary: `${cleanDomain} is already tracked as a competitor.` };
    }

    const competitor = await this.prisma.competitorDomain.create({
      data: { projectId, domain: cleanDomain, label: cleanDomain },
    });
    return {
      success: true,
      tool: 'addCompetitor',
      data: competitor,
      spokenSummary: `Added ${cleanDomain} as a competitor. Say 'crawl competitor' to start analysing their site.`,
      navigateTo: '/competitors',
    };
  }

  async listCompetitors(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const competitors = await this.prisma.competitorDomain.findMany({ where: { projectId }, orderBy: { createdAt: 'asc' } });
    if (!competitors.length) {
      return { success: true, tool: 'listCompetitors', data: [], spokenSummary: "You haven't added any competitors yet. Say 'add competitor' followed by a domain name." };
    }
    const names = competitors.map((c) => c.domain).join(', ');
    return { success: true, tool: 'listCompetitors', data: competitors, spokenSummary: `You're tracking ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}: ${names}.` };
  }

  async removeCompetitor(projectId: string, domain: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const cleanDomain = validateDomain(domain);
    const existing = await this.prisma.competitorDomain.findFirst({ where: { projectId, domain: cleanDomain } });
    if (!existing) {
      return { success: false, tool: 'removeCompetitor', data: null, spokenSummary: `${cleanDomain} is not in your competitor list.` };
    }
    await this.prisma.competitorDomain.delete({ where: { id: existing.id } });
    return { success: true, tool: 'removeCompetitor', data: { domain: cleanDomain }, spokenSummary: `Removed ${cleanDomain} from your competitors.` };
  }

  async crawlCompetitor(projectId: string, domain: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const cleanDomain = validateDomain(domain);
    const competitor = await this.prisma.competitorDomain.findFirst({ where: { projectId, domain: cleanDomain } });
    if (!competitor) {
      return { success: false, tool: 'crawlCompetitor', data: null, spokenSummary: `${cleanDomain} isn't in your competitor list. Add them first.` };
    }

    // Find or create website record for competitor
    let website = await this.prisma.website.findUnique({ where: { domain: cleanDomain } });
    if (!website) {
      website = await this.prisma.website.create({
        data: { domain: cleanDomain, url: `https://${cleanDomain}`, isVerified: false },
      });
    }

    const job = await this.prisma.crawlJob.create({
      data: { websiteId: website.id, status: JobStatus.PENDING, pageLimit: 200 },
    });

    return {
      success: true,
      tool: 'crawlCompetitor',
      data: { jobId: job.id, domain: cleanDomain },
      spokenSummary: `Started crawling ${cleanDomain}. I'll compare their pages with yours when done.`,
    };
  }

  // ─── Analysis ────────────────────────────────────────────────────────────────

  async compareWebsites(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const competitors = await this.prisma.competitorDomain.findMany({ where: { projectId } });
    if (!competitors.length) {
      return { success: false, tool: 'compareWebsites', data: null, spokenSummary: "You have no competitors to compare with. Add one first." };
    }
    return {
      success: true,
      tool: 'compareWebsites',
      data: { competitorCount: competitors.length },
      spokenSummary: `Opening competitor comparison for ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}.`,
      navigateTo: '/competitors',
    };
  }

  async runSeoAudit(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const website = await this.prisma.website.findFirst({ where: { projectId }, select: { id: true, domain: true } });
    if (!website) {
      return { success: false, tool: 'runSeoAudit', data: null, spokenSummary: 'No website found. Please add one first.' };
    }
    const job = await this.prisma.crawlJob.create({
      data: { websiteId: website.id, status: JobStatus.PENDING },
    });
    return {
      success: true,
      tool: 'runSeoAudit',
      data: { jobId: job.id },
      spokenSummary: `Technical SEO audit started for ${website.domain}. I'll surface the most critical issues when done.`,
      navigateTo: '/website',
    };
  }

  async getAuditSummary(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const website = await this.prisma.website.findFirst({ where: { projectId }, select: { id: true, domain: true } });
    if (!website) {
      return { success: false, tool: 'getAuditSummary', data: null, spokenSummary: 'No website found for this project.' };
    }

    const latestJob = await this.prisma.crawlJob.findFirst({
      where: { websiteId: website.id, status: JobStatus.COMPLETED },
      orderBy: { finishedAt: 'desc' },
    });
    if (!latestJob) {
      return { success: true, tool: 'getAuditSummary', data: null, spokenSummary: "No completed audit found. Say 'run a technical SEO audit' to start one." };
    }

    const criticalCount = await this.prisma.issue.count({ where: { crawlJobId: latestJob.id, severity: 'CRITICAL' } });
    const highCount = await this.prisma.issue.count({ where: { crawlJobId: latestJob.id, severity: 'HIGH' } });

    return {
      success: true,
      tool: 'getAuditSummary',
      data: { crawlJobId: latestJob.id, pagesCrawled: latestJob.pagesCrawled, issuesFound: latestJob.issuesFound, criticalCount, highCount },
      spokenSummary: `Last audit of ${website.domain}: ${latestJob.pagesCrawled} pages, ${latestJob.issuesFound} total issues — ${criticalCount} critical and ${highCount} high priority.`,
      navigateTo: '/website',
    };
  }

  async findContentGaps(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const gaps = await this.prisma.contentGap.findMany({
      where: { projectId },
      take: 5,
      orderBy: { createdAt: 'desc' },
    }).catch(() => []);

    if (!gaps.length) {
      return {
        success: true,
        tool: 'findContentGaps',
        data: [],
        spokenSummary: 'No content gaps found yet. Make sure you have a crawled competitor first.',
        navigateTo: '/content-intelligence',
      };
    }

    return {
      success: true,
      tool: 'findContentGaps',
      data: gaps,
      spokenSummary: `Found ${gaps.length} content gaps. Opening Content Intelligence now.`,
      navigateTo: '/content-intelligence',
    };
  }

  async detectOpportunities(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    const opps = await this.prisma.growthOpportunity.findMany({
      where: { projectId, status: 'OPEN' },
      orderBy: { priority: 'desc' },
      take: 3,
    }).catch(() => []);

    if (!opps.length) {
      return {
        success: true,
        tool: 'detectOpportunities',
        data: [],
        spokenSummary: 'No open opportunities found yet. Try running an audit first.',
        navigateTo: '/opportunities',
      };
    }

    const topOpp = opps[0];
    return {
      success: true,
      tool: 'detectOpportunities',
      data: opps,
      spokenSummary: `You have ${opps.length} open opportunities. The top one is: ${topOpp.title}.`,
      navigateTo: '/opportunities',
    };
  }

  async getTopRecommendations(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);

    const recommendations = await this.prisma.recommendation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
      take: 3,
    }).catch(() => []);

    if (!recommendations.length) {
      return {
        success: true,
        tool: 'getTopRecommendations',
        data: [],
        spokenSummary: "No recommendations yet. Run a full audit or content gap analysis first.",
        navigateTo: '/opportunities',
      };
    }

    const top = recommendations[0];
    return {
      success: true,
      tool: 'getTopRecommendations',
      data: recommendations,
      spokenSummary: `Top recommendation: ${top.title}. There are ${recommendations.length - 1} more high-priority items. Opening opportunities now.`,
      navigateTo: '/opportunities',
    };
  }

  // ─── Reports & Strategy ──────────────────────────────────────────────────────

  async generateReport(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    return {
      success: true,
      tool: 'generateReport',
      data: null,
      spokenSummary: 'Opening the reports page. Use the Generate Report button there to create a full PDF report.',
      navigateTo: '/reports',
    };
  }

  async generateStrategy(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    return {
      success: true,
      tool: 'generateStrategy',
      data: null,
      spokenSummary: 'Opening the strategy page. I can generate an AI-powered 90-day strategy from there.',
      navigateTo: '/strategy',
    };
  }

  async generateBlogIdeas(projectId: string, topic: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    if (!topic) {
      return { success: false, tool: 'generateBlogIdeas', data: null, spokenSummary: "I need a topic to generate blog ideas for." };
    }

    try {
      const prompt = `Generate 5 catchy, high-converting SEO blog post titles about "${topic}".
      Return ONLY a JSON array of strings, e.g. ["Idea 1", "Idea 2"]. Nothing else.`;
      
      const completion = await this.aiRouter.generate({
        prompt,
        systemInstruction: "You are an expert SEO content strategist.",
        task: AiTask.FAST,
        organizationId: orgId,
      });

      const items = JSON.parse(completion.text);
      
      return {
        success: true,
        tool: 'generateBlogIdeas',
        data: items,
        spokenSummary: `I've generated 5 blog post ideas for ${topic}. I'm displaying them for you now.`,
        uiPayload: {
          type: 'blog_ideas',
          topic,
          items,
        }
      };
    } catch (e) {
      return { success: false, tool: 'generateBlogIdeas', data: null, spokenSummary: "I had trouble generating those ideas right now." };
    }
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  private async assertProjectAccess(projectId: string, userId: string) {
    if (!projectId) throw new BadRequestException('A project must be selected to use voice commands.');
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { organizationId: true },
    });
    if (!project) throw new NotFoundException('Project not found.');
    await this.orgContext.assertMembership(userId, project.organizationId);
  }
}
