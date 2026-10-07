import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MultiAiRouterService, AiTask } from '../ai-search/multi-ai-router/multi-ai-router.service';

@Injectable()
export class ResponseAnalyzerService {
  private readonly logger = new Logger(ResponseAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly aiRouter: MultiAiRouterService,
  ) {}

  async analyzePendingResponses(scanId: string) {
    this.logger.log(`Starting response analysis for scan ${scanId}`);

    const responses = await this.prisma.aiVisibilityResponse.findMany({
      where: {
        scanRun: { scanId },
        analysis: null, // Only unanalyzed
      },
      include: {
        scanRun: { include: { scan: { include: { project: { include: { competitors: true, websites: true } } } } } },
      },
    });

    for (const response of responses) {
      await this.analyzeResponse(response);
    }
    
    this.logger.log(`Completed response analysis for scan ${scanId}`);
  }

  private async analyzeResponse(response: any) {
    const project = response.scanRun.scan.project;
    const ownDomains = project.websites.filter((w: any) => w.scope === 'own').map((w: any) => w.domain);
    const competitorDomains = project.competitors.map((c: any) => c.domain);

    const systemInstruction = `
You are an expert AI visibility analyzer. 
Read the following raw response from an AI assistant.
Determine if the project's own brand/domains (${ownDomains.join(', ')}) or its competitors (${competitorDomains.join(', ')}) are mentioned.
Determine if the AI shortlisted them, recommended them, or made them the final choice.
Extract any citations/links.
    `;

    try {
      const completion = await this.aiRouter.generate({
        prompt: `Analyze this response:\n\n${response.rawResponse}`,
        systemInstruction,
        task: AiTask.FAST, // Cheap high-volume extraction
        organizationId: project.organizationId,
        jsonSchema: {
          type: 'object',
          properties: {
            brandsMentioned: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  domain: { type: 'string', description: 'The domain of the brand mentioned' },
                  isOwnBrand: { type: 'boolean' },
                  shortlisted: { type: 'boolean' },
                  recommended: { type: 'boolean' },
                  finalChoice: { type: 'boolean' },
                  position: { type: 'number', description: 'Position in the list if applicable, 1-indexed' },
                },
                required: ['domain', 'isOwnBrand', 'shortlisted', 'recommended', 'finalChoice'],
              },
            },
            citations: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  url: { type: 'string' },
                  domain: { type: 'string' },
                  title: { type: 'string' },
                },
                required: ['url', 'domain'],
              },
            },
            sentiment: { type: 'string', enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'] },
          },
          required: ['brandsMentioned', 'citations', 'sentiment'],
        },
      });

      const parsed = JSON.parse(completion.text);
      
      const isOwnBrandMentioned = parsed.brandsMentioned.some((b: any) => b.isOwnBrand);
      const ownBrandDetails = parsed.brandsMentioned.find((b: any) => b.isOwnBrand);

      // Create Analysis Record
      await this.prisma.aiVisibilityResponseAnalysis.create({
        data: {
          responseId: response.id,
          brandMentioned: isOwnBrandMentioned,
          brandPosition: ownBrandDetails?.position || null,
          shortlisted: ownBrandDetails?.shortlisted || false,
          recommended: ownBrandDetails?.recommended || false,
          finalChoice: ownBrandDetails?.finalChoice || false,
          sentiment: parsed.sentiment,
          parsedJson: parsed,
        },
      });

      // Create Brand Mentions
      for (const brand of parsed.brandsMentioned) {
        await this.prisma.aiVisibilityBrandMention.create({
          data: {
            responseId: response.id,
            isCustomer: brand.isOwnBrand,
            brandName: brand.domain,
            position: brand.position || null,
            shortlisted: brand.shortlisted,
            recommended: brand.recommended,
            finalChoice: brand.finalChoice,
          },
        });
      }

      // Create Citations
      for (const citation of parsed.citations) {
        await this.prisma.aiVisibilityCitation.create({
          data: {
            responseId: response.id,
            url: citation.url,
            domain: citation.domain,
            title: citation.title,
            brandMentioned: ownDomains.includes(citation.domain),
          },
        });
      }
    } catch (e: any) {
      this.logger.error(`Failed to analyze response ${response.id}`, e.stack);
    }
  }
}
