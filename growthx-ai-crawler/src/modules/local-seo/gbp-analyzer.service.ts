import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { BusinessProfileService } from '../integrations/google/business-profile.service';
import { PlacesListingService } from '../integrations/google/places-listing.service';
import { AiTask, MultiAiRouterService } from '../ai-search/multi-ai-router/multi-ai-router.service';

const GBP_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    proposals: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string', description: 'The exact GBP field to update (e.g., profile.description, categories, serviceArea)' },
          currentValue: { type: 'string', description: 'What the field currently contains' },
          proposedValue: { type: 'string', description: 'The optimized value to push to GBP' },
          rationale: { type: 'string', description: 'Why this change improves Local SEO rankings' },
        },
        required: ['field', 'proposedValue', 'rationale'],
      },
    },
  },
  required: ['proposals'],
  additionalProperties: false,
} as const;

const SYSTEM = `You are an expert Local SEO Specialist.
Your goal is to audit a Google Business Profile (GBP) JSON dump and propose actionable fixes.
Rules:
1. Ensure the business description is highly optimized for local keywords, but reads naturally.
2. If categories are too broad, suggest more specific ones.
3. If services or attributes are missing that are critical for the industry, propose adding them.
4. Return ONLY a JSON object matching the requested schema.`;

@Injectable()
export class GbpAnalyzerService {
  private readonly logger = new Logger(GbpAnalyzerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gbp: BusinessProfileService,
    private readonly router: MultiAiRouterService,
    private readonly places: PlacesListingService,
  ) {}

  /**
   * The profile to audit: Business Profile's own copy when Google allows it,
   * otherwise the public Maps listing, labelled as such so the model does not
   * report "no description" as a finding when Places simply cannot see one.
   */
  private async profileForAudit(projectId: string): Promise<{ label: string; data: unknown }> {
    try {
      return { label: 'Current GBP JSON Dump', data: await this.gbp.fetchLocation(projectId) };
    } catch (error) {
      const snapshot = await this.places.snapshot(projectId);
      if (!snapshot.listing) throw error;
      this.logger.log(`GBP unavailable for ${projectId}; auditing the public Google Maps listing instead`);
      const { photos, reviews, ...listing } = snapshot.listing;
      return {
        label:
          'Public Google Maps listing (Places API). Business Profile access is pending, so the merchant description, ' +
          'services and attributes are NOT visible here — do not report them as missing',
        data: {
          ...listing,
          photoCount: photos.length,
          mostRelevantReviews: reviews.map((review) => ({ rating: review.rating, text: review.text })),
        },
      };
    }
  }

  async analyzeProfile(projectId: string, organizationId: string) {
    try {
      this.logger.log(`Starting GBP analysis for project ${projectId}`);
      
      // 1. Fetch live GBP data, or the public listing while GBP is locked
      const profile = await this.profileForAudit(projectId);

      // 2. Fetch project context
      const project = await this.prisma.project.findUnique({
        where: { id: projectId },
        select: { name: true, locations: true },
      });

      const prompt = `
Please audit the following Google Business Profile data for "${project?.name}".
${profile.label}:
${JSON.stringify(profile.data, null, 2)}

Identify any missing elements, weakly optimized descriptions, or missing services. Propose concrete changes.
      `.trim();

      // 3. Send to AI
      const result = await this.router.generate({
        prompt,
        systemInstruction: SYSTEM,
        task: AiTask.LOCAL_SEO_ANALYSIS,
        organizationId,
        jsonSchema: GBP_ANALYSIS_SCHEMA as unknown as Record<string, unknown>,
        maxTokens: 4000,
      });

      if (!result.text?.trim()) {
        throw new Error('AI failed to generate a response');
      }

      // 4. Parse JSON
      let parsed;
      try {
        const fenced = result.text.match(/```(?:json)?\s*([\s\S]*?)```/);
        const candidate = fenced ? fenced[1] : result.text.slice(result.text.indexOf('{'), result.text.lastIndexOf('}') + 1);
        parsed = JSON.parse(candidate);
      } catch (e) {
        throw new Error('Failed to parse AI response as JSON');
      }

      const proposals = parsed.proposals || [];

      // 5. Save to DB
      for (const proposal of proposals) {
        await this.prisma.gbpFixProposal.create({
          data: {
            projectId,
            field: proposal.field,
            currentValue: proposal.currentValue || '',
            proposedValue: proposal.proposedValue,
            rationale: proposal.rationale,
            status: 'PENDING',
          },
        });
      }

      this.logger.log(`Created ${proposals.length} GBP fix proposals for project ${projectId}`);
      return proposals;
    } catch (error) {
      this.logger.error(`Error in GBP Analysis for project ${projectId}`, error);
      throw error;
    }
  }
}
