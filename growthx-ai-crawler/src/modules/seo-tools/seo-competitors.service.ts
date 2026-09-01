import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

@Injectable()
export class SeoCompetitorsService {
  private readonly logger = new Logger(SeoCompetitorsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  async getSeoGapMatrix(projectId: string) {
    const competitors = await this.prisma.competitorDomain.findMany({
      where: { projectId },
      select: { id: true, domain: true, name: true, label: true },
    });

    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: true }
    });

    const customerDomain = project?.websites[0]?.domain || "your-site.com";

    // Simulate Keyword Gap Data
    const keywords = [
      { keyword: "ai seo platform", searchVolume: 12500, intent: "commercial" },
      { keyword: "enterprise technical seo", searchVolume: 4200, intent: "informational" },
      { keyword: "automated meta tags", searchVolume: 8400, intent: "transactional" },
      { keyword: "competitor backlink checker", searchVolume: 18000, intent: "informational" },
      { keyword: "local seo software", searchVolume: 22000, intent: "commercial" },
    ];

    const matrixRows = keywords.map(kw => {
      const customerHas = Math.random() > 0.5;
      const competitorCoverage: Record<string, boolean> = {};
      let competitorsWith = 0;

      competitors.forEach(c => {
        const hasIt = Math.random() > 0.3;
        competitorCoverage[c.id] = hasIt;
        if (hasIt) competitorsWith++;
      });

      let gapStatus = "OPTIMIZED";
      if (!customerHas && competitorsWith > 0) gapStatus = "CUSTOMER_MISSING";
      if (customerHas && competitorsWith === 0) gapStatus = "CUSTOMER_WINNING";
      if (!customerHas && competitorsWith === 0) gapStatus = "UNTRACKED_OPPORTUNITY";

      return {
        keyword: kw.keyword,
        searchVolume: kw.searchVolume,
        intent: kw.intent,
        customerCoverage: customerHas,
        competitorCoverage,
        gapStatus,
        opportunityScore: !customerHas ? Math.floor(Math.random() * 40 + 60) : Math.floor(Math.random() * 30 + 10),
      };
    });

    // Sort by highest opportunity score
    matrixRows.sort((a, b) => b.opportunityScore - a.opportunityScore);

    return {
      customerDomain,
      competitors: competitors.map(c => ({ id: c.id, name: c.name || c.label || c.domain, domain: c.domain })),
      keywordMatrix: matrixRows,
    };
  }

  async generateSeoGapInsights(projectId: string, organizationId: string) {
    const matrix = await this.getSeoGapMatrix(projectId);
    
    // Feed the top missing keywords to the AI to generate a content strategy
    const missing = matrix.keywordMatrix.filter(r => r.gapStatus === 'CUSTOMER_MISSING').slice(0, 5);
    
    if (missing.length === 0) {
      return {
        insights: "You are currently outperforming your tracked competitors on all major head terms. Consider expanding into tangential topic clusters to capture new top-of-funnel traffic.",
        recommendedContent: []
      };
    }

    const prompt = `You are an expert SEO strategist. 
Here are the top keywords that competitors are ranking for but our site (${matrix.customerDomain}) is missing:
${JSON.stringify(missing.map(m => m.keyword), null, 2)}

Provide a strategic insight paragraph and exactly 3 recommended article/page ideas to close this gap and steal back traffic.
Respond ONLY in valid JSON matching this schema:
{
  "insights": "Strategic analysis...",
  "recommendedContent": [
    { "title": "Article Title", "type": "Blog Post", "targetKeyword": "keyword" }
  ]
}`;

    const res = await this.aiRouter.generate({
      prompt,
      systemInstruction: "You are an expert SEO. Return only JSON.",
      task: AiTask.FAST,
      organizationId,
    });

    return JSON.parse(res.text);
  }
}
