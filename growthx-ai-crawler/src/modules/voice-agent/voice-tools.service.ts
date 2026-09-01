import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { OrgContextService } from '../organizations/org-context.service';
import { JobStatus } from '@prisma/client';
import { VoiceAgentResult } from './voice-agent.types';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';
import { ContentStrategyService } from '../content-intelligence/content-strategy.service';
import { SeoCompetitorsService } from '../seo-tools/seo-competitors.service';
import { FetcherService } from '../crawler/fetcher.service';
import * as cheerio from 'cheerio';

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
    private readonly contentStrategy: ContentStrategyService,
    private readonly seoCompetitors: SeoCompetitorsService,
    private readonly fetcher: FetcherService,
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
      uiPayload: {
        type: 'crawl_status',
        domain: website.domain,
        status: job.status,
        pagesCrawled: job.pagesCrawled,
        issuesFound: job.issuesFound,
        errorMessage: job.errorMessage,
      }
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
    return { 
      success: true, 
      tool: 'listCompetitors', 
      data: competitors, 
      spokenSummary: `You're tracking ${competitors.length} competitor${competitors.length > 1 ? 's' : ''}: ${names}.`,
      uiPayload: {
        type: 'competitor_list',
        competitors: competitors.map((c) => ({ domain: c.domain, label: c.label })),
      }
    };
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
      uiPayload: {
        type: 'audit_summary',
        domain: website.domain,
        pagesCrawled: latestJob.pagesCrawled,
        totalIssues: latestJob.issuesFound,
        criticalCount,
        highCount,
      }
    };
  }

  async findContentGaps(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    
    try {
      const insights = await this.seoCompetitors.generateSeoGapInsights(projectId, orgId);
      const matrix = await this.seoCompetitors.getSeoGapMatrix(projectId);
      
      const missing = matrix.keywordMatrix.filter(r => r.gapStatus === 'CUSTOMER_MISSING').slice(0, 5);

      if (!missing.length) {
        return {
          success: true,
          tool: 'findContentGaps',
          data: [],
          spokenSummary: 'No critical content gaps found. You are outperforming your tracked competitors.',
          navigateTo: '/competitors',
        };
      }

      return {
        success: true,
        tool: 'findContentGaps',
        data: insights,
        spokenSummary: `I've analyzed the competitor matrix. We're missing coverage on high-value keywords like ${missing[0].keyword}. I'm generating a gap recovery plan now.`,
        uiPayload: {
          type: 'gap_insights',
          insights: insights.insights,
          recommendedContent: insights.recommendedContent,
          missingKeywords: missing.map(m => m.keyword),
        }
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'findContentGaps',
        data: null,
        spokenSummary: 'Failed to analyze competitor gaps. Make sure you have added competitors first.',
      };
    }
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
    try {
      const strategy = await this.contentStrategy.generateStrategy(projectId, orgId);
      
      return {
        success: true,
        tool: 'generateStrategy',
        data: strategy,
        spokenSummary: "I've generated your AI-powered 90-day strategy. Let's review your core content pillars.",
        uiPayload: {
          type: 'seo_strategy',
          pillars: (strategy.contentPillars as any[])?.slice(0, 3) || [],
          campaigns: (strategy.campaignIdeas as any[])?.slice(0, 2) || [],
        }
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'generateStrategy',
        data: null,
        spokenSummary: `Failed to generate the strategy right now. Error: ${err.message}`,
      };
    }
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

  async optimizeMetaTags(projectId: string, pageUrl: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    
    // Check if website exists
    const website = await this.prisma.website.findFirst({
      where: { projectId },
      select: { id: true, domain: true },
    });

    if (!website) {
      return { success: false, tool: 'optimizeMetaTags', data: null, spokenSummary: "I need a website in this project to optimize meta tags for." };
    }

    const targetUrl = pageUrl || website.domain;

    try {
      const prompt = `Act as an expert SEO technical specialist. Generate an optimized SEO Title (max 60 chars) and Meta Description (max 160 chars) for this URL or page keyword: "${targetUrl}". 
      Return ONLY a valid JSON object matching this schema: {"title": "The Title", "description": "The description"}. Nothing else.`;
      
      const completion = await this.aiRouter.generate({
        prompt,
        systemInstruction: "You are an expert SEO content strategist. Respond only with JSON.",
        task: AiTask.FAST,
        organizationId: orgId,
      });

      const items = JSON.parse(completion.text);
      
      return {
        success: true,
        tool: 'optimizeMetaTags',
        data: items,
        spokenSummary: `I've generated optimized meta tags for ${targetUrl}. I'm displaying them for you now.`,
        uiPayload: {
          type: 'meta_tags',
          targetUrl,
          title: items.title,
          description: items.description,
        }
      };
    } catch (e) {
      return { success: false, tool: 'optimizeMetaTags', data: null, spokenSummary: "I had trouble generating meta tags right now. Please try again." };
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

  async scrapeCompetitorData(projectId: string, userId: string, orgId: string, urlStr: string, target: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);
    
    if (!urlStr) {
      return {
        success: false,
        tool: 'scrapeCompetitorData',
        data: null,
        spokenSummary: "I need a valid URL to scrape data from.",
      };
    }

    try {
      let targetUrl = urlStr;
      if (!targetUrl.startsWith('http')) {
        targetUrl = 'https://' + targetUrl;
      }
      
      const fetchResult = await this.fetcher.fetchPage(targetUrl, true);
      
      const $ = cheerio.load(fetchResult.html);
      $('script, style, noscript, svg, img').remove();
      const rawText = $('body').text().replace(/\s+/g, ' ').trim().substring(0, 15000);
      
      const prompt = `You are a data extraction AI. 
The user wants to extract: "${target || 'Pricing and Products'}"
Here is the text extracted from ${targetUrl}:

${rawText}

Extract the requested information and format it as a clean, concise summary. Return JSON matching this schema:
{
  "extractedData": "Markdown formatted summary of what you found."
}`;

      const res = await this.aiRouter.generate({
        prompt,
        systemInstruction: "You extract precise data from website text. Return only valid JSON.",
        task: AiTask.FAST,
        organizationId: orgId,
      });

      const parsed = JSON.parse(res.text);

      return {
        success: true,
        tool: 'scrapeCompetitorData',
        data: parsed,
        spokenSummary: `I've successfully scanned ${urlStr} and extracted the information you requested. Here is the data.`,
        uiPayload: {
          type: 'competitor_scrape_result',
          url: urlStr,
          target: target || 'Data Extraction',
          extractedData: parsed.extractedData,
        }
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'scrapeCompetitorData',
        data: null,
        spokenSummary: `Failed to scrape data from that website. Error: ${err.message}`,
      };
    }
  }

  async discoverCompetitors(projectId: string, userId: string, orgId: string): Promise<VoiceAgentResult> {
    await this.assertProjectAccess(projectId, userId);

    try {
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        include: { websites: true },
      });

      if (!project || project.websites.length === 0) {
        return {
          success: false,
          tool: 'discoverCompetitors',
          data: null,
          spokenSummary: "I need a website in your project to figure out your industry and find competitors.",
        };
      }

      const domain = project.websites[0].domain;

      const prompt = `You are a world-class market analyst and SEO strategist.
The user's primary business domain is: ${domain}
Identify the top 3 to 5 real-world direct competitors for this domain in their industry.
If you don't know the exact domain, make an educated guess based on the likely industry.
Respond ONLY with a JSON array of objects, like this:
[
  { "domain": "competitor1.com", "name": "Competitor 1" },
  { "domain": "competitor2.com", "name": "Competitor 2" }
]`;

      const res = await this.aiRouter.generate({
        prompt,
        systemInstruction: "You identify business competitors. Return only valid JSON.",
        task: AiTask.FAST,
        organizationId: orgId,
      });

      let competitors: { domain: string, name: string }[] = [];
      try {
        competitors = JSON.parse(res.text);
      } catch (e) {
        throw new Error("Failed to parse AI output into a competitor list.");
      }

      const tracked = [];
      for (const comp of competitors) {
        if (!comp.domain || comp.domain === domain) continue;
        const cleanDomain = comp.domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        const saved = await this.prisma.competitorDomain.upsert({
          where: { projectId_domain: { projectId, domain: cleanDomain } },
          create: {
            projectId,
            domain: cleanDomain,
            label: comp.name || cleanDomain,
          },
          update: {},
        });
        tracked.push(saved);
      }

      return {
        success: true,
        tool: 'discoverCompetitors',
        data: tracked,
        spokenSummary: `I analyzed your domain and identified ${tracked.length} top competitors. I've automatically added them to your tracking dashboard.`,
        uiPayload: {
          type: 'competitor_list',
          competitors: tracked,
        }
      };
    } catch (err: any) {
      return {
        success: false,
        tool: 'discoverCompetitors',
        data: null,
        spokenSummary: `Failed to discover competitors right now. Error: ${err.message}`,
      };
    }
  }
}
