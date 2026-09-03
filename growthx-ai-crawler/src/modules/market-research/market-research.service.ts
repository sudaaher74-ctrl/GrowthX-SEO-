import {
  BadRequestException,
  HttpException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MarketActionStatus,
  MarketActionType,
  ResearchConfidence,
  ResearchIntent,
  ResearchMessageRole,
  ResearchRunStatus,
  ResearchSourceType,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { EvidenceRetrievalService, RetrievedSource } from './evidence-retrieval.service';
import { ModelRole, ModelRouterService, ModelUsage } from './model-router.service';
import { validateCitations } from './citation-validator';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { parseModelJson } from '../ai-engine/utils/json-extractor.util';
import { normalizeDomain } from '../ai-visibility/citation/citation-detector';
import { SocialDiscoveryService } from '../content-intelligence/social-discovery.service';
import { BusinessProfileService, DetectedBusinessProfile } from './business-profile.service';
import { CompetitorVerificationService, RejectedCompetitor } from './competitor-verification.service';
import {
  ANSWER_INSTRUCTIONS,
  ANSWER_SCHEMA,
  CLASSIFY_INSTRUCTIONS,
  CLASSIFY_SCHEMA,
} from './research-schema';

export interface AskOptions {
  organizationId: string;
  projectId: string;
  threadId?: string;
  question: string;
  deepResearch?: boolean;
}

export interface AutoIdentifiedCompetitor {
  domain: string;
  name: string;
  industry: string;
  description: string;
  overlapScore: number;
  marketPosition: string;
  location?: string;
  sampleKeywords: string[];
  keyDifferentiator: string;
  isAlreadyAdded?: boolean;
  existingId?: string;
  /**
   * Set once the company has been proven real: either its live site was
   * fetched and matched this market, or it comes from the hand-checked list.
   * Only verified competitors are returned, so this is what the UI badges.
   */
  verified?: boolean;
  /** Title tag read from the live site during verification. */
  verifiedTitle?: string;
  verifiedAt?: string;
  /** `curated` marks an entry from the hand-checked market list. */
  source?: 'ai' | 'curated';
}

/** A proposed competitor that failed verification, kept so the UI can say why. */
export type CompetitorRejection = RejectedCompetitor;

export interface AutoIdentifyCompetitorsResult {
  customerDomain: string;
  businessName: string;
  industry: string;
  region: string;
  identifiedAt: string;
  topCompetitors: AutoIdentifiedCompetitor[];
  /** What the client's own website says they do; null when detection is off. */
  businessProfile?: DetectedBusinessProfile | null;
  /** True when the niche came from the site rather than the operator. */
  industryWasDetected?: boolean;
  /** True when the geography came from the client's own address. */
  regionWasDetected?: boolean;
  /** Suggestions discarded during verification, with the reason for each. */
  rejected?: CompetitorRejection[];
  /** Plain-language notes for the operator, e.g. why the list is short. */
  notes?: string[];
}

const LEVEL: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

/** Only these action types are accepted; anything else the model invents is dropped. */
const ACTION_TYPES: Record<string, MarketActionType> = {
  CONTENT_BRIEF: MarketActionType.CONTENT_BRIEF,
  PAGE_REFRESH: MarketActionType.PAGE_REFRESH,
  TECHNICAL_TASK: MarketActionType.TECHNICAL_TASK,
  TRACK_PROMPT: MarketActionType.TRACK_PROMPT,
  COMPETITOR_WATCH: MarketActionType.COMPETITOR_WATCH,
  OUTREACH_OPPORTUNITY: MarketActionType.OUTREACH_OPPORTUNITY,
};

const CONFIDENCE: Record<string, ResearchConfidence> = {
  high: ResearchConfidence.HIGH,
  medium: ResearchConfidence.MEDIUM,
  low: ResearchConfidence.LOW,
};

@Injectable()
export class MarketResearchService {
  private readonly logger = new Logger(MarketResearchService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly models: ModelRouterService,
    private readonly evidence: EvidenceRetrievalService,
    @Optional() private readonly socialDiscovery?: SocialDiscoveryService,
    @Optional() private readonly businessProfiles?: BusinessProfileService,
    @Optional() private readonly verification?: CompetitorVerificationService,
  ) {}

  /**
   * What this client sells, read off their own site.
   *
   * Exposed so the Market Research page can show the detected business before
   * any competitor scan runs, and so an operator can correct it.
   */
  async getBusinessProfile(
    organizationId: string,
    projectId: string,
    options?: { refresh?: boolean; domain?: string },
  ): Promise<DetectedBusinessProfile | null> {
    await this.assertProjectInOrg(organizationId, projectId);
    if (!this.businessProfiles) return null;

    const { domain, projectName } = await this.resolveProjectDomain(projectId, options?.domain);
    return this.businessProfiles.getProfile(projectId, domain, {
      force: options?.refresh,
      fallbackName: projectName,
    });
  }

  /** Stores an operator's correction to the detected niche or geography. */
  async setBusinessProfile(
    organizationId: string,
    projectId: string,
    patch: { industry?: string; businessName?: string; region?: 'worldwide' | 'india' | 'maharashtra' },
  ): Promise<DetectedBusinessProfile | null> {
    await this.assertProjectInOrg(organizationId, projectId);
    if (!this.businessProfiles) return null;

    const { domain } = await this.resolveProjectDomain(projectId);
    return this.businessProfiles.overrideProfile(projectId, domain, patch);
  }

  private async resolveProjectDomain(
    projectId: string,
    override?: string,
  ): Promise<{ domain: string; projectName?: string }> {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: { websites: { take: 1, orderBy: { createdAt: 'desc' } } },
    });

    const raw = override || project?.websites[0]?.domain || project?.websites[0]?.url;
    if (!raw) {
      throw new BadRequestException(
        'This project has no website yet, so its business cannot be detected. Add a website first.',
      );
    }

    const domain = normalizeDomain(raw);
    if (!domain || !domain.includes('.')) {
      throw new BadRequestException('A valid domain name is required.');
    }

    return {
      domain,
      projectName:
        project?.name && !project.name.toLowerCase().includes('workspace') ? project.name : undefined,
    };
  }

  /**
   * Identifies the competitors a client actually has, starting from what their
   * own website says they sell.
   *
   * Two things used to go wrong here and both are fixed in this method.
   *
   * The page opened on a niche picker, so nothing happened until the operator
   * classified their own business — a question their homepage already answers.
   * `industry` and `region` are now resolved from the detected business profile
   * whenever the caller does not pass them, and the picker survives only as an
   * override for the cases detection gets wrong.
   *
   * And the returned five were unverified. A model asked for five competitors
   * returns five whether or not five exist, so invented domains and repeats of
   * the same company were rendered next to real ones with nothing to tell them
   * apart. Every model-proposed competitor is now fetched and checked before it
   * is shown; the ones that fail are reported in `rejected` rather than
   * displayed, and a short list of real companies is returned in preference to
   * a full list containing fabrications.
   */
  async autoIdentifyCompetitors(
    organizationId: string,
    projectId: string,
    options?: {
      websiteUrl?: string;
      domain?: string;
      industry?: string;
      businessName?: string;
      region?: string;
      /** Re-read the client's site instead of using the cached profile. */
      refreshProfile?: boolean;
    },
  ): Promise<AutoIdentifyCompetitorsResult> {
    await this.assertProjectInOrg(organizationId, projectId);

    // 1. Resolve project and website domain
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      include: {
        websites: { take: 1, orderBy: { createdAt: 'desc' } },
      },
    });

    const registeredWebsite = project?.websites[0];
    const rawDomain =
      options?.domain ||
      options?.websiteUrl ||
      registeredWebsite?.domain ||
      registeredWebsite?.url;

    if (!rawDomain) {
      throw new BadRequestException(
        'A website domain or URL is required to auto-identify competitors. Please add a website to the project first.',
      );
    }

    const domain = normalizeDomain(rawDomain);
    if (!domain || !domain.includes('.')) {
      throw new BadRequestException('A valid domain name is required.');
    }

    // 2. Read what this client sells, from their own site.
    //
    // This is what removes the "pick your niche" step: detection runs first and
    // supplies the industry and the geography, and an explicit `industry` or
    // `region` from the caller is treated as the operator correcting it.
    const projectName =
      project?.name && !project.name.toLowerCase().includes('workspace') ? project.name : undefined;

    let profile: DetectedBusinessProfile | null = null;
    if (this.businessProfiles) {
      try {
        profile = await this.businessProfiles.getProfile(projectId, domain, {
          force: options?.refreshProfile,
          fallbackName: projectName,
        });
      } catch (err) {
        this.logger.warn(`Business detection failed for ${domain}: ${err}. Falling back to page metadata.`);
      }
    }

    // 3. Resolve geographic region — from the caller, else from where the
    // detected business is actually located.
    const requestedRegion = (options?.region || profile?.suggestedRegion || '').toLowerCase().trim();
    const normalizedRegion: 'worldwide' | 'india' | 'maharashtra' = requestedRegion.includes('maha')
      ? 'maharashtra'
      : requestedRegion.includes('india')
        ? 'india'
        : 'worldwide';
    const regionWasDetected = !options?.region && Boolean(profile?.suggestedRegion);

    const regionLabel =
      normalizedRegion === 'maharashtra'
        ? 'Maharashtra, India (State & Regional Market — Mumbai, Pune, Nashik, Western India)'
        : normalizedRegion === 'india'
          ? 'India (National Market across India)'
          : 'Worldwide (Global / International Market)';

    const [recentPages, existingCompetitors] = await Promise.all([
      this.prisma.page.findMany({
        where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
        orderBy: { crawledAt: 'desc' },
        select: { url: true, title: true, metaDescription: true },
        take: 20,
      }),
      this.prisma.competitorDomain.findMany({
        where: { projectId },
        select: { id: true, domain: true },
      }),
    ]);

    const homepage = [...recentPages].sort((a, b) => a.url.length - b.url.length)[0];

    // Detection already fetches the site; only reach for it again when there is
    // no profile and the crawl has nothing to offer either.
    let liveMeta: { title?: string; description?: string; businessName?: string; inferredIndustry?: string } | null = null;
    if (!profile && (!homepage?.title || !homepage?.metaDescription)) {
      liveMeta = await this.fetchLiveWebsiteMeta(domain);
    }

    const businessName =
      options?.businessName ||
      profile?.businessName ||
      liveMeta?.businessName ||
      projectName ||
      this.formatBrandName(domain);

    const pageTitle = homepage?.title || liveMeta?.title || profile?.summary;
    const pageDesc = homepage?.metaDescription || liveMeta?.description || profile?.summary;

    const detectedSubject = this.subjectFrom(pageTitle, pageDesc, businessName);
    const subject =
      options?.industry ||
      profile?.industry ||
      liveMeta?.inferredIndustry ||
      detectedSubject ||
      this.inferSubjectFromDomain(domain);
    const industryWasDetected = !options?.industry && Boolean(profile?.industry);

    const existingDomainMap = new Map(
      existingCompetitors.map((c) => [normalizeDomain(c.domain), c.id]),
    );

    let candidates: AutoIdentifiedCompetitor[] = [];
    const notes: string[] = [];

    // 4. Attempt AI-driven identification if model is configured
    if (this.models.isConfigured()) {
      try {
        const prompt = [
          `Analyze the market landscape and organic search competition for this business:`,
          `- Website Domain: ${domain}`,
          `- Brand / Business Name: ${businessName}`,
          `- Core Product / Niche / Industry: ${subject}`,
          `- Target Geographic Scope: ${regionLabel}`,
          profile?.summary ? `- What they sell (read from their site): ${profile.summary}` : '',
          profile?.offerings?.length ? `- Named products / services: ${profile.offerings.join(', ')}` : '',
          profile?.businessModel ? `- Business model: ${profile.businessModel}` : '',
          profile && (profile.city || profile.state || profile.country)
            ? `- Client's own location: ${[profile.city, profile.state, profile.country].filter(Boolean).join(', ')}`
            : '',
          profile?.seedKeywords?.length ? `- Search terms their buyers use: ${profile.seedKeywords.join(', ')}` : '',
          pageTitle ? `- Homepage Title: ${pageTitle}` : '',
          pageDesc ? `- Meta Description: ${pageDesc}` : '',
          ``,
          `Task: Identify the TOP 5 DIRECT REAL-WORLD competitors that compete for the same customers, search rankings, or market share in ${regionLabel} for ${subject}.`,
          ``,
          `CRITICAL STRICT REQUIREMENTS:`,
          `1. Name ONLY companies you actually know to exist, with the domain you actually know them by. Every domain will be fetched and checked against the live web before it is shown to the customer, and anything that does not resolve is discarded.`,
          `2. It is far better to return 2 or 3 companies you are certain about than 5 where two are guesses. Return only the ones you are sure of.`,
          `3. For ${normalizedRegion === 'maharashtra' ? 'Maharashtra' : normalizedRegion === 'india' ? 'India' : 'Worldwide'}, every competitor must be legitimately based or active in that geographic market.`,
          `4. Absolutely DO NOT generate fake, fictitious, or placeholder domain names (such as "apexbrand.com", "example.com", "dummy.com", or synthetic mock names).`,
          `5. Do NOT return the same company twice, under any spelling or domain variant.`,
          `6. Do NOT guess a domain from a brand name. If you do not know the company's real website, leave that company out.`,
          `7. Do NOT return unrelated businesses, generic search engines, marketplaces, social networks, or encyclopedias (like google.com, indiamart.com, wikipedia.org).`,
          `8. Do NOT include the target domain (${domain}) itself.`,
          `9. Include a descriptive 'location' property indicating where each company is headquartered or located (e.g. "Pune, Maharashtra", "Nashik, Maharashtra", "Bengaluru, India", "Germany", "USA").`,
        ].filter(Boolean).join('\n');

        const schema = {
          name: 'top_competitors',
          schema: {
            type: 'object',
            required: ['competitors'],
            properties: {
              competitors: {
                type: 'array',
                items: {
                  type: 'object',
                  required: [
                    'domain',
                    'name',
                    'industry',
                    'description',
                    'overlapScore',
                    'marketPosition',
                    'location',
                    'sampleKeywords',
                    'keyDifferentiator',
                  ],
                  properties: {
                    domain: { type: 'string' },
                    name: { type: 'string' },
                    industry: { type: 'string' },
                    description: { type: 'string' },
                    overlapScore: { type: 'number' },
                    marketPosition: { type: 'string' },
                    location: { type: 'string' },
                    sampleKeywords: { type: 'array', items: { type: 'string' } },
                    keyDifferentiator: { type: 'string' },
                  },
                },
              },
            },
          },
        };

        const result = await this.models.generate({
          step: 'auto_identify_competitors',
          role: ModelRole.ANALYST,
          instructions:
            'You are a premier SEO & Market Research Competitive Intelligence Director. ' +
            'Name only real companies whose websites you actually know; every domain you return is fetched and verified, ' +
            'and an invented one is discarded and counted against the result. Returning three real competitors beats five with a guess among them. ' +
            'Return ONLY valid JSON matching the schema.',
          input: prompt,
          jsonSchema: schema,
          maxOutputTokens: 2500,
        });

        const parsed = parseJson(result.text) as { competitors?: unknown[] };
        if (Array.isArray(parsed?.competitors) && parsed.competitors.length > 0) {
          candidates = parsed.competitors
            .map((raw: any) => this.sanitizeCompetitor(raw, domain, normalizedRegion))
            .filter((c): c is AutoIdentifiedCompetitor => c !== null);
        }
      } catch (err) {
        this.logger.warn(`AI competitor identification failed for ${domain}: ${err}. Using curated market list.`);
      }
    }

    // 5. Verify every model-proposed competitor against the live web.
    //
    // Only model output goes through this. The curated list below is real
    // companies checked by hand, and putting it through the same network round
    // trip would slow the page down to re-prove what is already known.
    const proposedCount = candidates.length;
    let rejected: CompetitorRejection[] = [];

    if (this.verification && candidates.length > 0) {
      const nicheText = [subject, profile?.summary, ...(profile?.offerings || []), ...(profile?.seedKeywords || [])]
        .filter(Boolean)
        .join(' ');
      try {
        const outcome = await this.verification.verify(candidates, domain, nicheText);
        // `matchedTerms` is dropped: it is how the check was made, not
        // something the operator needs on the card.
        candidates = outcome.verified.map(({ matchedTerms, ...rest }) => ({
          ...rest,
          verified: true as const,
          source: 'ai' as const,
        }));
        rejected = outcome.rejected;
      } catch (err) {
        this.logger.warn(`Competitor verification failed for ${domain}: ${err}. Falling back to the curated list.`);
        candidates = [];
      }
    }

    if (proposedCount > 0 && rejected.length > 0) {
      notes.push(
        `${rejected.length} of ${proposedCount} AI-suggested ${rejected.length === 1 ? 'company was' : 'companies were'} dropped because ${rejected.length === 1 ? 'it' : 'they'} could not be verified as a real business in this market.`,
      );
    }

    // 6. Top up from the curated market list — but only where it covers this
    // niche. Padding a Nashik fruit exporter's list with Accenture and IBM to
    // reach five is what made the panel look like a demo; a short list of real
    // rivals is the honest answer.
    if (candidates.length < 5) {
      const curated = this.generateFallbackCompetitors(domain, businessName, subject, normalizedRegion);
      const seen = new Set(candidates.map((c) => normalizeDomain(c.domain)));
      seen.add(domain);
      for (const entry of curated) {
        const entryDomain = normalizeDomain(entry.domain);
        if (seen.has(entryDomain)) continue;
        candidates.push({ ...entry, verified: true, source: 'curated' });
        seen.add(entryDomain);
        if (candidates.length >= 5) break;
      }
    }

    if (candidates.length === 0) {
      notes.push(
        `No competitor could be verified for "${subject}" in this market. Refine the niche below, widen the scope, or add a competitor domain by hand.`,
      );
    } else if (candidates.length < 5) {
      notes.push(
        rejected.length > 0
          ? `${candidates.length} verified ${candidates.length === 1 ? 'competitor' : 'competitors'} found. The list is short because unverifiable suggestions were removed rather than shown.`
          : `${candidates.length} verified ${candidates.length === 1 ? 'competitor' : 'competitors'} found for this niche. Refine the niche or widen the scope to see more.`,
      );
    }

    // Sorted before slicing, so the five shown are the five highest-overlap
    // companies rather than the first five to arrive.
    const competitors = [...candidates].sort((a, b) => b.overlapScore - a.overlapScore).slice(0, 5);

    // Enrich with whether each competitor is already added in the project
    const enrichedCompetitors = competitors.map((c) => ({
      ...c,
      isAlreadyAdded: existingDomainMap.has(normalizeDomain(c.domain)),
      existingId: existingDomainMap.get(normalizeDomain(c.domain)),
    }));

    return {
      customerDomain: domain,
      businessName,
      industry: subject,
      region: normalizedRegion,
      identifiedAt: new Date().toISOString(),
      topCompetitors: enrichedCompetitors,
      businessProfile: profile,
      industryWasDetected,
      regionWasDetected,
      rejected,
      notes,
    };
  }

  /**
   * Adds user-selected competitors (e.g. 3 of 5) to project tracking.
   */
  async addSelectedCompetitors(
    organizationId: string,
    projectId: string,
    competitors: Array<{
      domain: string;
      name?: string;
      label?: string;
      industry?: string;
      description?: string;
      location?: string;
      confidenceScore?: number;
    }>,
  ) {
    await this.assertProjectInOrg(organizationId, projectId);

    if (!Array.isArray(competitors) || competitors.length === 0) {
      throw new BadRequestException('At least one competitor must be provided.');
    }

    if (competitors.length > 5) {
      throw new BadRequestException('You can add at most 5 competitors at once.');
    }

    const saved = [];

    for (const item of competitors) {
      const cleanDomain = normalizeDomain(item.domain || '');
      if (!cleanDomain || !cleanDomain.includes('.')) continue;

      const label = item.label || item.name || this.formatBrandName(cleanDomain);
      const name = item.name || item.label || this.formatBrandName(cleanDomain);
      const score = typeof item.confidenceScore === 'number' ? Math.round(item.confidenceScore) : 90;

      const record = await this.prisma.competitorDomain.upsert({
        where: {
          projectId_domain: {
            projectId,
            domain: cleanDomain,
          },
        },
        update: {
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || (item.location ? `Based in ${item.location}` : undefined),
          confidenceScore: score,
          status: 'ANALYZED',
          lastAnalyzedAt: new Date(),
        },
        create: {
          projectId,
          domain: cleanDomain,
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || (item.location ? `Based in ${item.location}` : undefined),
          confidenceScore: score,
          status: 'ANALYZED',
          lastAnalyzedAt: new Date(),
        },
      });

      saved.push(record);

      // Auto-trigger social profile discovery and baseline account registration
      if (this.socialDiscovery) {
        try {
          await this.socialDiscovery.saveDiscoveredCompetitor(organizationId, projectId, {
            website: cleanDomain,
            businessName: name,
            industry: item.industry,
            profiles: [],
          });
        } catch (socialErr) {
          this.logger.debug(`Social discovery baseline notice for ${cleanDomain}: ${socialErr}`);
        }
      }
    }

    return {
      success: true,
      count: saved.length,
      addedCompetitors: saved,
    };
  }

  /**
   * Verified Real-World Competitor Knowledge Base across Maharashtra, India, and Worldwide.
   * Absolutely NO synthetic/dummy/demo domains.
   */
  private generateFallbackCompetitors(
    domain: string,
    businessName: string,
    subject: string,
    region: 'worldwide' | 'india' | 'maharashtra' = 'worldwide',
  ): AutoIdentifiedCompetitor[] {
    const text = `${domain} ${businessName} ${subject}`.toLowerCase();

    // ──────────────────────────────────────────────────────────
    // 1. FOOD PROCESSING / AGRO / FRUIT PULP / MANGO / BEVERAGES / SPICES / EXPORTS
    // ──────────────────────────────────────────────────────────
    if (
      text.includes('pulp') ||
      text.includes('fruit') ||
      text.includes('mango') ||
      text.includes('agro') ||
      text.includes('food') ||
      text.includes('beverage') ||
      text.includes('spice') ||
      text.includes('export') ||
      text.includes('frozen') ||
      text.includes('organic')
    ) {
      if (region === 'maharashtra') {
        return [
          {
            domain: 'sahyadrifarms.com',
            name: 'Sahyadri Farms',
            industry: 'Fruit Processing & Fresh Exports',
            description: "India's largest farmer collective and leading processor of mango, guava, tomato, and fruit purees.",
            location: 'Nashik, Maharashtra',
            overlapScore: 97,
            marketPosition: 'Maharashtra Market Leader',
            sampleKeywords: ['alphonso mango pulp exporter', 'aseptic fruit puree maharashtra', 'bulk fruit pulp manufacturer', 'nashik agro exports'],
            keyDifferentiator: 'Direct farmer supply chain, modern IQF freezing, and extensive European/Gulf export certifications.',
          },
          {
            domain: 'jainfarmfresh.com',
            name: 'Jain Farm Fresh (Jain Foods)',
            industry: 'Aseptic Fruit Pulp & Dehydrated Foods',
            description: 'Major global processor of aseptic mango, banana, and guava pulps, fruit concentrates, and spices.',
            location: 'Jalgaon, Maharashtra',
            overlapScore: 94,
            marketPosition: 'Global Industrial Processor',
            sampleKeywords: ['aseptic mango pulp jalgaon', 'totapuri fruit puree', 'industrial fruit concentrate supplier', 'iqf frozen mango dice'],
            keyDifferentiator: 'One of the largest integrated food processing facilities with global supply contracts.',
          },
          {
            domain: 'mapro.com',
            name: 'Mapro Foods',
            industry: 'Fruit Products, Jams & Purees',
            description: 'Renowned Western India food brand producing premium fruit crushes, fruit bars, squashes, and processed fruit products.',
            location: 'Mahabaleshwar / Pune, Maharashtra',
            overlapScore: 90,
            marketPosition: 'Retail & Premium Brand',
            sampleKeywords: ['fruit pulp and crushes', 'premium strawberry puree', 'natural fruit squashes', 'western india fruit products'],
            keyDifferentiator: 'Strong regional brand equity and expansive retail/hospitality distribution network.',
          },
          {
            domain: 'mothersrecipe.com',
            name: "Desai Foods (Mother's Recipe)",
            industry: 'Packaged Foods, Pastes & Export Purees',
            description: 'Global Indian food exporter supplying ethnic culinary pastes, pickles, fruit chutneys, and food purees across 45+ countries.',
            location: 'Pune, Maharashtra',
            overlapScore: 86,
            marketPosition: 'Export & Retail Conglomerate',
            sampleKeywords: ['packaged food exports pune', 'culinary fruit pastes', 'indian food products export', 'ready to cook food manufacturer'],
            keyDifferentiator: 'Presence in over 45 international export markets and strong FMCG distribution.',
          },
          {
            domain: 'suhana.co.in',
            name: 'Pravin Masalewale (Suhana Foods)',
            industry: 'Processed Foods, Spices & Purees',
            description: 'Pioneering food processing firm exporting spices, culinary pastes, and prepared agro products internationally.',
            location: 'Pune, Maharashtra',
            overlapScore: 82,
            marketPosition: 'Culinary Specialist',
            sampleKeywords: ['food processing company pune', 'spice and food paste exporter', 'maharashtra culinary food brand'],
            keyDifferentiator: 'Deep roots in Maharashtra agribusiness with state-of-the-art modern processing units.',
          },
        ];
      }

      if (region === 'india') {
        return [
          {
            domain: 'capricornfood.com',
            name: 'Capricorn Food Products',
            industry: 'Tropical Fruit Pulps & Concentrates',
            description: 'Leading Indian processor and bulk exporter of aseptic mango, guava, papaya pulps and frozen fruit dices.',
            location: 'Chennai / Bengaluru, India',
            overlapScore: 96,
            marketPosition: 'National Export Giant',
            sampleKeywords: ['alphonso mango pulp india', 'aseptic tropical fruit puree', 'fruit concentrate bulk exporter', 'indian mango pulp supplier'],
            keyDifferentiator: 'Multiple processing plants across tropical fruit belts in Southern and Western India.',
          },
          {
            domain: 'shimlahills.com',
            name: 'Shimla Hills Offerings',
            industry: 'Agro Products & Fruit Purees',
            description: 'Global exporter of premium tropical and deciduous fruit purees, concentrates, and IQF fruit ingredients.',
            location: 'Shimla / New Delhi, India',
            overlapScore: 92,
            marketPosition: 'Pan-India Agro Exporter',
            sampleKeywords: ['fruit puree exporter india', 'mango pulp b2b supplier', 'processed fruit ingredients', 'agro commodities export'],
            keyDifferentiator: 'Comprehensive export portfolio covering both tropical and temperate fruit products.',
          },
          {
            domain: 'tfcil.com',
            name: 'Tropical Fruits Processing Ltd',
            industry: 'Aseptic Fruit Pulp Processing',
            description: 'Dedicated processor of Totapuri and Alphonso mango pulps, guava, and papaya concentrates for international beverage makers.',
            location: 'Krishnagiri, Tamil Nadu, India',
            overlapScore: 89,
            marketPosition: 'Pure-Play Pulp Manufacturer',
            sampleKeywords: ['totapuri mango pulp manufacturer', 'krishnagiri mango belt processor', 'aseptic fruit pulp exporter india'],
            keyDifferentiator: 'Located in the heart of the Krishnagiri mango processing hub with direct farm sourcing.',
          },
          {
            domain: 'dabur.com',
            name: 'Dabur India (Real Fruit Power)',
            industry: 'Packaged Fruit Beverages & Foods',
            description: "India's premier FMCG giant commanding the packaged fruit juice and beverage processing market.",
            location: 'Ghaziabad / New Delhi, India',
            overlapScore: 85,
            marketPosition: 'National Beverage Leader',
            sampleKeywords: ['packaged fruit juice manufacturer', 'indian fruit beverage brand', 'fmcg food processing india'],
            keyDifferentiator: 'Unmatched brand recall and ubiquitous distribution across 6 million+ retail outlets.',
          },
          {
            domain: 'itcportal.com',
            name: 'ITC Foods (B Natural)',
            industry: 'Agri-Business & Fruit Beverages',
            description: 'Large-scale agri-business conglomerate procuring fruits directly from Indian farmers for 100% Indian fruit beverages.',
            location: 'Kolkata, India',
            overlapScore: 81,
            marketPosition: 'Enterprise Conglomerate',
            sampleKeywords: ['indian fruit sourcing network', 'b natural fruit juice', 'agri-business exports india'],
            keyDifferentiator: 'Proprietary e-Choupal agricultural sourcing network empowering sustainable farmer procurement.',
          },
        ];
      }

      // Worldwide Food / Agro
      return [
        {
          domain: 'doehler.com',
          name: 'Döhler Group',
          industry: 'Natural Ingredients & Fruit Purees',
          description: 'Global producer of natural fruit juice concentrates, fruit purees, compounds, and ingredient systems.',
          location: 'Darmstadt, Germany',
          overlapScore: 96,
          marketPosition: 'Global Ingredients Leader',
          sampleKeywords: ['fruit puree global supplier', 'fruit juice concentrate manufacturer', 'natural food ingredients', 'aseptic fruit compounds'],
          keyDifferentiator: 'Operates in over 160 countries with world-class sensory and formulation technology.',
        },
        {
          domain: 'agrana.com',
          name: 'Agrana Fruit',
          industry: 'Industrial Fruit Preparations',
          description: "The world's leading manufacturer of fruit preparations and processed fruit purees for the dairy, bakery, and beverage industries.",
          location: 'Vienna, Austria',
          overlapScore: 93,
          marketPosition: 'Industrial Market Standard',
          sampleKeywords: ['industrial fruit preparations', 'custom fruit purees', 'fruit ingredients b2b', 'aseptic fruit packs'],
          keyDifferentiator: 'Global network of 25+ processing facilities across 5 continents.',
        },
        {
          domain: 'symrise.com',
          name: 'Symrise Nutrition',
          industry: 'Fruit Solutions & Taste Ingredients',
          description: 'Global supplier of sustainable fruit ingredients, botanical extracts, and natural flavor concentrates.',
          location: 'Holzminden, Germany',
          overlapScore: 89,
          marketPosition: 'Specialty Ingredients Pioneer',
          sampleKeywords: ['natural fruit extracts', 'fruit ingredient systems', 'clean label fruit puree', 'global flavor solutions'],
          keyDifferentiator: 'Deep scientific R&D in clean-label fruit stabilization and nutrition.',
        },
        {
          domain: 'kerry.com',
          name: 'Kerry Group',
          industry: 'Taste & Nutrition Ingredients',
          description: 'International leader in taste and nutrition solutions, supplying fruit bases, purees, and specialized food ingredients.',
          location: 'Tralee, Ireland',
          overlapScore: 86,
          marketPosition: 'Enterprise Taste Specialist',
          sampleKeywords: ['taste and nutrition ingredients', 'commercial fruit purees', 'beverage fruit solutions', 'global food technology'],
          keyDifferentiator: 'Massive enterprise scale and custom co-manufacturing partnerships with global food brands.',
        },
        {
          domain: 'svz.com',
          name: 'SVZ Industrial Ingredients',
          industry: 'Industrial Fruit & Vegetable Purees',
          description: 'Specialist global supplier of premium fruit purees, concentrates, and NFC juices with sustainable farming heritage.',
          location: 'Breda, Netherlands',
          overlapScore: 82,
          marketPosition: 'Pure-Play Puree Specialist',
          sampleKeywords: ['sustainable fruit purees', 'industrial fruit concentrate', 'nfc fruit juices b2b', 'high quality fruit ingredients'],
          keyDifferentiator: '150+ years of agricultural expertise and 100% sustainably sourced fruit programs.',
        },
      ];
    }

    // ──────────────────────────────────────────────────────────
    // 2. LOGISTICS / TRANSPORT / FREIGHT / WAREHOUSING / FLEET / SUPPLY CHAIN
    // ──────────────────────────────────────────────────────────
    if (
      text.includes('transport') ||
      text.includes('logistics') ||
      text.includes('freight') ||
      text.includes('cargo') ||
      text.includes('warehousing') ||
      text.includes('supply chain') ||
      text.includes('truck') ||
      text.includes('fleet')
    ) {
      if (region === 'maharashtra') {
        return [
          {
            domain: 'mahindralogistics.com',
            name: 'Mahindra Logistics',
            industry: 'Integrated 3PL & Supply Chain Logistics',
            description: 'Major Mumbai-headquartered 3PL provider offering enterprise freight, warehousing, in-factory logistics, and express transport.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 96,
            marketPosition: 'Maharashtra Logistics Giant',
            sampleKeywords: ['3pl logistics mumbai', 'freight forwarding maharashtra', 'enterprise warehousing solutions', 'fleet transport mumbai'],
            keyDifferentiator: 'Pan-India warehousing network spanning 19+ million sq. ft. and multimodal freight capabilities.',
          },
          {
            domain: 'allcargologistics.com',
            name: 'Allcargo Logistics',
            industry: 'Global Multimodal Logistics & LCL Consolidation',
            description: 'India’s largest private sector logistics company operating global LCL consolidation, express delivery, and contract logistics.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 93,
            marketPosition: 'Global Freight Powerhouse',
            sampleKeywords: ['lcl freight consolidation mumbai', 'multimodal logistics maharashtra', 'express cargo delivery', 'container freight station'],
            keyDifferentiator: 'World leader in LCL consolidation operating across 180 countries (ECU Worldwide).',
          },
          {
            domain: 'vrlgroup.in',
            name: 'VRL Logistics (Western Hub)',
            industry: 'Surface Commercial Transport & Goods Freight',
            description: 'One of India’s largest commercial transport and goods transportation networks with dense Western India terminal operations.',
            location: 'Mumbai / Western Hub, Maharashtra',
            overlapScore: 89,
            marketPosition: 'Surface Transportation Benchmark',
            sampleKeywords: ['goods transport maharashtra', 'full truckload freight mumbai', 'parcel transport service', 'commercial fleet operators'],
            keyDifferentiator: 'Owns one of the largest private commercial goods vehicle fleets in India.',
          },
          {
            domain: 'westerncarriers.in',
            name: 'Western Carriers (India)',
            industry: 'Multimodal Freight & Industrial Rail Logistics',
            description: 'Leading multi-modal, rail-focused logistics solutions provider managing heavy industrial cargo, road, and port operations.',
            location: 'Mumbai / Western India',
            overlapScore: 85,
            marketPosition: 'Industrial Freight Specialist',
            sampleKeywords: ['industrial freight logistics', 'rail multimodal transport', 'heavy cargo supply chain mumbai'],
            keyDifferentiator: 'Specialized heavy cargo and FMCG rail freight integration.',
          },
          {
            domain: 'flyjac.com',
            name: 'Flyjac Logistics (Hitachi Transport)',
            industry: 'Freight Forwarding & Supply Chain Solutions',
            description: 'Leading integrated freight forwarder providing air, ocean, road transportation, and customs clearance.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 81,
            marketPosition: 'International Freight Specialist',
            sampleKeywords: ['air and ocean freight mumbai', 'customs clearance maharashtra', 'cold chain transport logistics'],
            keyDifferentiator: 'Japanese precision supply chain standards backed by Hitachi Transport System.',
          },
        ];
      }

      if (region === 'india') {
        return [
          {
            domain: 'tciexpress.in',
            name: 'TCI Express',
            industry: 'Express Cargo & Surface Transport',
            description: "India's premier express distribution specialist serving 40,000+ locations with time-definite delivery services.",
            location: 'Gurugram / Pan-India',
            overlapScore: 96,
            marketPosition: 'National Express Leader',
            sampleKeywords: ['express cargo transport india', 'surface express distribution', 'air express logistics', 'b2b parcel delivery'],
            keyDifferentiator: 'Dedicated express cargo hub-and-spoke infrastructure covering 95% of India.',
          },
          {
            domain: 'delhivery.com',
            name: 'Delhivery',
            industry: 'Digital Commerce & Supply Chain Infrastructure',
            description: 'India’s largest fully-integrated logistics provider offering automated sorting, freight, and PTL/FTL trucking.',
            location: 'Gurugram / Pan-India',
            overlapScore: 93,
            marketPosition: 'Tech-Enabled Logistics Giant',
            sampleKeywords: ['ptl truckload freight india', 'supply chain technology', 'nationwide freight logistics', 'b2b commercial transport'],
            keyDifferentiator: 'Proprietary routing algorithms and automated multi-layer sorting hubs.',
          },
          {
            domain: 'bluedart.com',
            name: 'Blue Dart Express (DHL Group)',
            industry: 'Aviation Cargo & Express Transport',
            description: 'South Asia’s premier express air and integrated transportation and distribution company.',
            location: 'Mumbai / Pan-India',
            overlapScore: 89,
            marketPosition: 'Express Air Standard',
            sampleKeywords: ['air express courier india', 'time definite cargo', 'secure transport logistics'],
            keyDifferentiator: 'Dedicated Boeing cargo aircraft fleet and premium delivery reliability.',
          },
          {
            domain: 'safexpress.com',
            name: 'Safexpress',
            industry: 'Supply Chain & 3PL Logistics',
            description: 'Knowledge leader and market pioneer in supply chain, third-party logistics, and nationwide express distribution.',
            location: 'New Delhi / Pan-India',
            overlapScore: 85,
            marketPosition: 'Supply Chain Pioneer',
            sampleKeywords: ['3pl supply chain india', 'logistics parks pan india', 'express distribution network'],
            keyDifferentiator: 'Ultra-modern logistics parks and GPS-tracked container fleet.',
          },
          {
            domain: 'gati.com',
            name: 'Gati (Allcargo Group)',
            industry: 'Express Surface & Air Cargo Distribution',
            description: 'Pioneer in express cargo and supply chain management with direct reach across all districts in India.',
            location: 'Hyderabad / Pan-India',
            overlapScore: 81,
            marketPosition: 'National Express Pioneer',
            sampleKeywords: ['surface cargo booking india', 'express distribution gati', 'first mile last mile logistics'],
            keyDifferentiator: 'Re-engineered digital operating network with pan-India pin-code coverage.',
          },
        ];
      }

      // Worldwide Logistics
      return [
        {
          domain: 'dhl.com',
          name: 'DHL Global Forwarding & Express',
          industry: 'Global Logistics & Freight Transportation',
          description: 'The global market leader in international express shipping, air/ocean freight, and contract logistics.',
          location: 'Bonn, Germany',
          overlapScore: 96,
          marketPosition: 'Global Industry Standard',
          sampleKeywords: ['international freight forwarder', 'global air and ocean cargo', 'worldwide express logistics'],
          keyDifferentiator: 'Operating in 220+ countries with unrivaled international customs expertise.',
        },
        {
          domain: 'fedex.com',
          name: 'FedEx Logistics',
          industry: 'Global Express & Freight Services',
          description: 'Multinational delivery services company connecting 99% of global GDP through air and ground networks.',
          location: 'Memphis, USA',
          overlapScore: 92,
          marketPosition: 'Global Aviation & Freight Titan',
          sampleKeywords: ['international express cargo', 'supply chain logistics global', 'cross border freight shipping'],
          keyDifferentiator: 'World’s largest dedicated cargo airline fleet.',
        },
        {
          domain: 'kuehne-nagel.com',
          name: 'Kuehne + Nagel',
          industry: 'Sea & Air Freight Forwarding',
          description: 'Global leader in sea logistics, air logistics, and integrated supply chain management.',
          location: 'Schindellegi, Switzerland',
          overlapScore: 89,
          marketPosition: 'Maritime Freight Leader',
          sampleKeywords: ['ocean freight forwarding global', 'global air logistics', 'contract logistics solutions'],
          keyDifferentiator: '#1 global ocean freight and air freight forwarder.',
        },
        {
          domain: 'dbschenker.com',
          name: 'DB Schenker',
          industry: 'Land Transport & Global Logistics',
          description: 'Global logistics provider managing land transport, worldwide air and ocean freight, and contract supply chain.',
          location: 'Essen, Germany',
          overlapScore: 85,
          marketPosition: 'European & Global Heavyweight',
          sampleKeywords: ['land transport logistics', 'global ocean freight', 'contract supply chain management'],
          keyDifferentiator: 'Dense pan-European and global overland freight corridors.',
        },
        {
          domain: 'dsv.com',
          name: 'DSV Global Transport & Logistics',
          industry: 'Air, Sea & Road Logistics',
          description: 'Global supplier of transport and logistics solutions operating through dedicated Air & Sea, Road, and Solutions divisions.',
          location: 'Hedehusene, Denmark',
          overlapScore: 81,
          marketPosition: 'Top-Tier Global Forwarder',
          sampleKeywords: ['global transport solutions', 'multimodal freight management', 'customs brokerage global'],
          keyDifferentiator: 'Scalable asset-light operating model with superior global execution.',
        },
      ];
    }

    // ──────────────────────────────────────────────────────────
    // 3. SEO / MARKETING / DIGITAL AGENCIES / CONTENT TOOLS
    // ──────────────────────────────────────────────────────────
    if (
      text.includes('seo') ||
      text.includes('search') ||
      text.includes('crawler') ||
      text.includes('marketing') ||
      text.includes('content') ||
      text.includes('agency')
    ) {
      if (region === 'maharashtra') {
        return [
          {
            domain: 'schbang.com',
            name: 'Schbang Digital Solutions',
            industry: 'Integrated Digital Marketing & Tech',
            description: 'Premier holistic digital agency offering search marketing, creative technology, and brand transformation.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 96,
            marketPosition: 'Maharashtra Agency Leader',
            sampleKeywords: ['digital marketing agency mumbai', 'organic search optimization', 'brand growth transformation', 'seo strategy firm'],
            keyDifferentiator: '1000+ member integrated creative, media, and tech powerhouse headquartered in Mumbai.',
          },
          {
            domain: 'watconsult.com',
            name: 'WATConsult (Dentsu)',
            industry: 'Digital Media & Search Consulting',
            description: 'Globally recognized digital and search marketing consultancy driving enterprise digital visibility.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 92,
            marketPosition: 'Enterprise Agency Rival',
            sampleKeywords: ['search engine optimization agency mumbai', 'digital media strategy', 'enterprise organic growth'],
            keyDifferentiator: 'Backed by Dentsu network with deep analytics and enterprise search expertise.',
          },
          {
            domain: 'foxymoron.in',
            name: 'FoxyMoron (Zoo Media)',
            industry: 'Full-Funnel Digital Agency',
            description: 'Independent digital transformation agency delivering organic content intelligence and search marketing.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 88,
            marketPosition: 'Creative & Media Innovator',
            sampleKeywords: ['creative digital agency mumbai', 'content search optimization', 'growth marketing agency'],
            keyDifferentiator: 'Native digital culture and agile full-funnel content marketing.',
          },
          {
            domain: 'performics.com',
            name: 'Performics India',
            industry: 'Performance Marketing & SEO',
            description: 'Performance marketing pioneer maximizing organic discovery, intent tracking, and search ROI.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 85,
            marketPosition: 'Performance Specialist',
            sampleKeywords: ['performance seo mumbai', 'search intent optimization', 'organic traffic scaling'],
            keyDifferentiator: 'Proprietary intent-driven search media algorithms.',
          },
          {
            domain: 'growthhackers.in',
            name: 'Growth Hackers Digital',
            industry: 'Organic Growth & SEO Agency',
            description: 'High-growth organic search and customer acquisition agency helping funded startups scale.',
            location: 'Mumbai / Bengaluru, India',
            overlapScore: 82,
            marketPosition: 'Startup Growth Specialist',
            sampleKeywords: ['startup seo agency india', 'organic traffic growth', 'roi driven search optimization'],
            keyDifferentiator: 'Laser focus on CAC reduction and organic search pipeline growth.',
          },
        ];
      }

      if (region === 'india') {
        return [
          {
            domain: 'semrush.com',
            name: 'Semrush India',
            industry: 'SEO & Search Intelligence Suite',
            description: 'All-in-one search visibility management platform tracking keywords, competitor backlinks, and SERP rankings.',
            location: 'Bengaluru / Global',
            overlapScore: 96,
            marketPosition: 'National Category Standard',
            sampleKeywords: ['seo tool india', 'competitor keyword research', 'backlink gap tracker', 'rank tracking platform'],
            keyDifferentiator: 'Largest keyword search and backlink database in the industry.',
          },
          {
            domain: 'socialbeat.in',
            name: 'Social Beat',
            industry: 'Performance Marketing & Multilingual SEO',
            description: "India's leading independent performance marketing and vernacular search agency with 300+ specialists.",
            location: 'Bengaluru / Chennai, India',
            overlapScore: 91,
            marketPosition: 'Multilingual SEO Leader',
            sampleKeywords: ['multilingual seo agency india', 'regional search optimization', 'organic visibility agency'],
            keyDifferentiator: 'Specialized focus on Bharat/vernacular SEO and tier-2/3 search behavior.',
          },
          {
            domain: 'adfactorspr.com',
            name: 'Adfactors PR & Digital',
            industry: 'Corporate Reputation & Digital Visibility',
            description: "India's largest strategic market communication and digital presence consultancy.",
            location: 'Mumbai / New Delhi, India',
            overlapScore: 87,
            marketPosition: 'Market Authority',
            sampleKeywords: ['digital pr and visibility', 'corporate reputation search', 'brand visibility consulting india'],
            keyDifferentiator: 'Market leader in earned media authority and digital corporate storytelling.',
          },
          {
            domain: 'inmobi.com',
            name: 'InMobi Marketing Cloud',
            industry: 'Audience Intelligence & Discovery',
            description: 'Global ad-tech and consumer intelligence platform driving digital discovery and mobile brand growth.',
            location: 'Bengaluru, India',
            overlapScore: 84,
            marketPosition: 'Discovery Platform Leader',
            sampleKeywords: ['consumer intent platform', 'mobile search discovery', 'audience intelligence india'],
            keyDifferentiator: 'First Indian unicorn with proprietary contextual audience graph.',
          },
          {
            domain: 'growthx.club',
            name: 'GrowthX',
            industry: 'Product Growth & Marketing Frameworks',
            description: 'Premier growth and marketing intelligence community for operators scaling digital products in India.',
            location: 'Bengaluru, India',
            overlapScore: 80,
            marketPosition: 'Growth Ecosystem Pioneer',
            sampleKeywords: ['product led marketing framework', 'growth strategy ecosystem', 'acquisition loop optimization'],
            keyDifferentiator: 'Deep practitioner-curated growth frameworks and community.',
          },
        ];
      }

      // Worldwide SEO / Marketing
      return [
        {
          domain: 'semrush.com',
          name: 'Semrush',
          industry: 'Search Marketing & SEO Suite',
          description: 'Comprehensive keyword research, backlink analysis, and SERP visibility suite.',
          location: 'Boston, USA',
          overlapScore: 96,
          marketPosition: 'Market Leader',
          sampleKeywords: ['ai seo platform', 'keyword gap analysis', 'serp rank tracker', 'backlink audit'],
          keyDifferentiator: 'Broadest digital marketing database and all-in-one visibility toolkit.',
        },
        {
          domain: 'ahrefs.com',
          name: 'Ahrefs',
          industry: 'SEO & Link Intelligence',
          description: 'Deep link index, site explorer, and keyword tracking tools for organic growth teams.',
          location: 'Singapore',
          overlapScore: 93,
          marketPosition: 'High-Authority Rival',
          sampleKeywords: ['link building intelligence', 'site audit engine', 'organic search volume', 'ai citations'],
          keyDifferentiator: 'Industry standard live index of web backlinks and domain rating metrics.',
        },
        {
          domain: 'surferseo.com',
          name: 'Surfer SEO',
          industry: 'AI Content Optimization & SERP Auditing',
          description: 'Real-time content scoring, NLP keyword recommendations, and automated article writing.',
          location: 'Wroclaw, Poland',
          overlapScore: 89,
          marketPosition: 'Content Intelligence Specialist',
          sampleKeywords: ['nlp content optimizer', 'ai article writer', 'on-page seo score', 'topical authority'],
          keyDifferentiator: 'Focus on on-page NLP guidelines and content editor workflow integration.',
        },
        {
          domain: 'brightedge.com',
          name: 'BrightEdge',
          industry: 'Enterprise SEO & Generative Search',
          description: 'Enterprise organic search optimization platform tracking AI search engines and market share.',
          location: 'San Mateo, USA',
          overlapScore: 86,
          marketPosition: 'Enterprise Challenger',
          sampleKeywords: ['enterprise seo platform', 'ai search share', 'generative engine optimization', 'share of voice'],
          keyDifferentiator: 'Enterprise scale reporting and executive dashboard integrations.',
        },
        {
          domain: 'conductor.com',
          name: 'Conductor',
          industry: 'Organic Marketing & Intelligence',
          description: 'Organic marketing platform providing customer intent insights and workflow automation.',
          location: 'New York, USA',
          overlapScore: 82,
          marketPosition: 'Strategic Alternative',
          sampleKeywords: ['organic marketing platform', 'search intent mapping', 'competitive intelligence', 'seo insights'],
          keyDifferentiator: 'Collaboration tools for cross-functional enterprise marketing teams.',
        },
      ];
    }

    // ──────────────────────────────────────────────────────────
    // 3. SAAS / SOFTWARE / TECH / CLOUD / DEVELOPER TOOLS
    // ──────────────────────────────────────────────────────────
    if (
      text.includes('saas') ||
      text.includes('software') ||
      text.includes('app') ||
      text.includes('cloud') ||
      text.includes('api') ||
      text.includes('dev') ||
      text.includes('platform') ||
      text.includes('tech')
    ) {
      if (region === 'maharashtra') {
        return [
          {
            domain: 'persistentsys.com',
            name: 'Persistent Systems',
            industry: 'Digital Engineering & Cloud SaaS',
            description: 'Global software engineering powerhouse building cloud, AI, and enterprise digital solutions.',
            location: 'Pune, Maharashtra',
            overlapScore: 96,
            marketPosition: 'Maharashtra Tech Heavyweight',
            sampleKeywords: ['cloud software engineering pune', 'enterprise ai solutions', 'digital product engineering'],
            keyDifferentiator: '23,000+ digital engineers and deep hyperscaler cloud partnerships.',
          },
          {
            domain: 'clevertap.com',
            name: 'CleverTap',
            industry: 'Customer Engagement & AI SaaS',
            description: 'AI-powered customer lifecycle management platform optimizing retention and personalized user engagement.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 92,
            marketPosition: 'Global MarTech Unicorn',
            sampleKeywords: ['customer retention platform', 'real time user analytics', 'ai martech saas', 'push notification engine'],
            keyDifferentiator: 'Processes trillions of user events with real-time TesseractDB engine.',
          },
          {
            domain: 'druva.com',
            name: 'Druva',
            industry: 'Cloud Data Protection SaaS',
            description: 'Cloud-native data resiliency and cyber recovery SaaS protecting enterprise workloads.',
            location: 'Pune, Maharashtra / Sunnyvale',
            overlapScore: 88,
            marketPosition: 'Cloud Resiliency Leader',
            sampleKeywords: ['cloud backup saas', 'enterprise data protection pune', 'ransomware recovery platform'],
            keyDifferentiator: '100% serverless SaaS architecture built on AWS.',
          },
          {
            domain: 'browserstack.com',
            name: 'BrowserStack',
            industry: 'Developer Cloud Testing Platform',
            description: "World's most reliable web and mobile app testing platform trusted by over 50,000 global customers.",
            location: 'Mumbai, Maharashtra',
            overlapScore: 85,
            marketPosition: 'Global DevTools Standard',
            sampleKeywords: ['cross browser testing cloud', 'mobile app automated testing', 'developer testing platform mumbai'],
            keyDifferentiator: 'Instant access to 3,000+ real mobile devices and desktop browsers.',
          },
          {
            domain: 'zenoti.com',
            name: 'Zenoti',
            industry: 'Enterprise Cloud Management SaaS',
            description: 'Unified cloud management software powering global chains in wellness, beauty, and fitness.',
            location: 'Mumbai / Seattle',
            overlapScore: 81,
            marketPosition: 'Vertical SaaS Pioneer',
            sampleKeywords: ['enterprise vertical saas', 'salon and spa management software', 'multi location pos system'],
            keyDifferentiator: 'All-in-one platform covering POS, appointments, marketing, and inventory.',
          },
        ];
      }

      if (region === 'india') {
        return [
          {
            domain: 'zoho.com',
            name: 'Zoho Corporation',
            industry: 'Enterprise Cloud & SaaS Suite',
            description: 'Comprehensive suite of 55+ cloud applications covering CRM, finance, HR, and marketing for 100M+ users.',
            location: 'Chennai, India',
            overlapScore: 97,
            marketPosition: 'India SaaS Giant',
            sampleKeywords: ['cloud business software india', 'enterprise crm platform', 'zoho one cloud apps', 'affordable business saas'],
            keyDifferentiator: 'Completely bootstrapped, vertically integrated tech stack and privacy-first ethos.',
          },
          {
            domain: 'freshworks.com',
            name: 'Freshworks',
            industry: 'Customer & IT Service SaaS',
            description: 'AI-driven business software modernizing customer service, CRM, and IT service management.',
            location: 'Chennai / San Mateo',
            overlapScore: 93,
            marketPosition: 'Nasdaq-Listed SaaS Leader',
            sampleKeywords: ['customer support software india', 'itsm helpdesk saas', 'freshdesk service management'],
            keyDifferentiator: 'Frictionless, consumer-grade user experience with fast time-to-value.',
          },
          {
            domain: 'postman.com',
            name: 'Postman',
            industry: 'API Development & Collaboration Platform',
            description: "The world's leading API platform used by over 30 million developers across Fortune 500 companies.",
            location: 'Bengaluru / San Francisco',
            overlapScore: 89,
            marketPosition: 'Global API Standard',
            sampleKeywords: ['api testing platform', 'api client developer tools', 'collaborative api development india'],
            keyDifferentiator: 'Ubiquitous API platform defining modern microservice developer workflows.',
          },
          {
            domain: 'hasura.io',
            name: 'Hasura',
            industry: 'Instant GraphQL & Data API Platform',
            description: 'High-performance engine that makes your data instantly accessible over secure GraphQL and REST APIs.',
            location: 'Bengaluru / San Francisco',
            overlapScore: 85,
            marketPosition: 'Data API Specialist',
            sampleKeywords: ['instant graphql engine', 'postgres data api', 'backend data access layer'],
            keyDifferentiator: 'Sub-millisecond query execution and automated database role security.',
          },
          {
            domain: 'chargebee.com',
            name: 'Chargebee',
            industry: 'Subscription Billing & Revenue Management',
            description: 'Subscription management and recurring billing platform powering thousands of fast-growing SaaS businesses.',
            location: 'Chennai / San Francisco',
            overlapScore: 81,
            marketPosition: 'FinTech SaaS Pioneer',
            sampleKeywords: ['subscription billing saas', 'recurring payment management india', 'saas revenue operations'],
            keyDifferentiator: 'Turnkey billing automation with deep integrations across 30+ payment gateways.',
          },
        ];
      }

      // Worldwide SaaS / Software
      return [
        {
          domain: 'datadoghq.com',
          name: 'Datadog',
          industry: 'Cloud Monitoring & Analytics',
          description: 'Unified monitoring, analytics, and telemetry suite for modern cloud applications.',
          location: 'New York, USA',
          overlapScore: 95,
          marketPosition: 'Industry Leader',
          sampleKeywords: ['cloud observability', 'performance analytics', 'infrastructure monitoring', 'log intelligence'],
          keyDifferentiator: 'Turnkey full-stack integrations and unified alerting ecosystem.',
        },
        {
          domain: 'newrelic.com',
          name: 'New Relic',
          industry: 'Observability & Telemetry',
          description: 'Intelligent observability platform tracking software performance and user experience.',
          location: 'San Francisco, USA',
          overlapScore: 90,
          marketPosition: 'Established Challenger',
          sampleKeywords: ['application performance tracking', 'telemetry data platform', 'error tracking', 'apm metrics'],
          keyDifferentiator: 'Single telemetry data platform pricing model.',
        },
        {
          domain: 'dynatrace.com',
          name: 'Dynatrace',
          industry: 'AI-Powered Observability',
          description: 'Autonomous AI engine delivering deep software diagnostics and root-cause analysis.',
          location: 'Waltham, USA',
          overlapScore: 88,
          marketPosition: 'Enterprise AI Specialist',
          sampleKeywords: ['ai root cause analysis', 'enterprise performance monitoring', 'automated diagnostics'],
          keyDifferentiator: 'Patented causal AI engine for automatic root-cause detection.',
        },
        {
          domain: 'sentry.io',
          name: 'Sentry',
          industry: 'Application Monitoring & Error Tracking',
          description: 'Developer-first error tracking and performance monitoring for web and mobile apps.',
          location: 'San Francisco, USA',
          overlapScore: 84,
          marketPosition: 'Developer Favorite',
          sampleKeywords: ['developer error tracking', 'stack trace analysis', 'session replay', 'frontend telemetry'],
          keyDifferentiator: 'Frictionless code-level diagnostics and exception tracing.',
        },
        {
          domain: 'posthog.com',
          name: 'PostHog',
          industry: 'Product Analytics & Feature Management',
          description: 'All-in-one product analytics, session replay, and feature flag platform.',
          location: 'San Francisco, USA',
          overlapScore: 81,
          marketPosition: 'High-Growth Modern Suite',
          sampleKeywords: ['product analytics suite', 'feature flags engine', 'session replay platform', 'user funnel tracking'],
          keyDifferentiator: 'Unified open-source product OS combining analytics, replays, and flags.',
        },
      ];
    }

    // ──────────────────────────────────────────────────────────
    // 4. E-COMMERCE / RETAIL / B2B WHOLESALE / DISTRIBUTION
    // ──────────────────────────────────────────────────────────
    if (
      text.includes('shop') ||
      text.includes('store') ||
      text.includes('commerce') ||
      text.includes('retail') ||
      text.includes('product') ||
      text.includes('wholesale') ||
      text.includes('market') ||
      text.includes('trade')
    ) {
      if (region === 'maharashtra') {
        return [
          {
            domain: 'nykaa.com',
            name: 'Nykaa (FSN E-Commerce)',
            industry: 'Omnichannel Beauty & Retail E-Commerce',
            description: "India's premier lifestyle and consumer goods retail platform with deep brand storytelling and logistics.",
            location: 'Mumbai, Maharashtra',
            overlapScore: 95,
            marketPosition: 'Maharashtra E-Commerce Leader',
            sampleKeywords: ['online beauty store mumbai', 'd2c lifestyle brand', 'omnichannel retail platform'],
            keyDifferentiator: 'Inventory-led authentic product curation and powerful consumer community.',
          },
          {
            domain: 'tatacliq.com',
            name: 'Tata CLiQ',
            industry: 'Digital Commerce & Brand Marketplace',
            description: 'Tata Group multi-category digital marketplace curating verified authentic luxury and lifestyle products.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 91,
            marketPosition: 'Omnichannel Enterprise',
            sampleKeywords: ['luxury digital retail mumbai', 'omnichannel brand marketplace', 'tata ecommerce'],
            keyDifferentiator: 'Phygital storefront model connecting physical retail stores to digital shoppers.',
          },
          {
            domain: 'zepto.com',
            name: 'Zepto',
            industry: 'Quick Commerce & Consumer Delivery',
            description: 'Fastest growing quick-commerce network fulfilling consumer grocery and essentials in under 10 minutes.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 87,
            marketPosition: 'Hyperlocal Innovator',
            sampleKeywords: ['quick commerce delivery mumbai', '10 minute grocery delivery', 'dark store network'],
            keyDifferentiator: 'Dense urban micro-fulfillment dark store network.',
          },
          {
            domain: 'dmart.in',
            name: 'Avenue Supermarts (DMart)',
            industry: 'Value Retail & Wholesale Supermarkets',
            description: 'India’s most profitable supermarket and wholesale consumer goods retail chain.',
            location: 'Mumbai, Maharashtra',
            overlapScore: 84,
            marketPosition: 'Value Retail Titan',
            sampleKeywords: ['grocery wholesale supermarket mumbai', 'dmart ready online delivery', 'discount retail store'],
            keyDifferentiator: 'Lowest cost retail operations with direct manufacturer procurement.',
          },
          {
            domain: 'firstcry.com',
            name: 'FirstCry (Brainbees Solutions)',
            industry: 'Specialty Retail & Baby Care Commerce',
            description: 'Asia’s largest omnichannel baby and kids lifestyle platform with 1,000+ retail stores.',
            location: 'Pune, Maharashtra',
            overlapScore: 80,
            marketPosition: 'Specialty Category Champion',
            sampleKeywords: ['omnichannel baby store pune', 'kids retail marketplace', 'd2c baby products'],
            keyDifferentiator: 'Dominant category leadership and multi-brand distribution.',
          },
        ];
      }

      if (region === 'india') {
        return [
          {
            domain: 'indiamart.com',
            name: 'IndiaMART InterMESH',
            industry: 'B2B Wholesale & Supplier Marketplace',
            description: "India's largest B2B e-commerce and wholesale discovery portal connecting 100M+ buyers with verified manufacturers.",
            location: 'Noida / New Delhi, India',
            overlapScore: 97,
            marketPosition: 'National B2B Market Leader',
            sampleKeywords: ['b2b wholesale marketplace india', 'manufacturers and suppliers directory', 'bulk wholesale products india'],
            keyDifferentiator: '7.5 million+ suppliers listed with deep buyer matchmaking algorithms.',
          },
          {
            domain: 'tradeindia.com',
            name: 'TradeIndia',
            industry: 'B2B Trade & Global Export Portal',
            description: 'Leading business-to-business portal facilitating trade between global buyers and Indian manufacturers/exporters.',
            location: 'New Delhi, India',
            overlapScore: 92,
            marketPosition: 'Export & Trade Benchmark',
            sampleKeywords: ['indian exporters directory', 'b2b trade leads india', 'wholesale manufacturer catalog'],
            keyDifferentiator: 'Strong focus on small and medium enterprise export facilitation.',
          },
          {
            domain: 'udaan.com',
            name: 'Udaan',
            industry: 'B2B Supply Chain & E-Commerce',
            description: 'Network-centric B2B trade platform designed specifically for small and medium businesses across India.',
            location: 'Bengaluru, India',
            overlapScore: 88,
            marketPosition: 'Digital Supply Chain Leader',
            sampleKeywords: ['b2b trade platform india', 'retailer wholesale ordering app', 'fmcg b2b supply chain'],
            keyDifferentiator: 'Integrated trade financing, logistics, and digital cataloging.',
          },
          {
            domain: 'moglix.com',
            name: 'Moglix',
            industry: 'Industrial B2B Procurement',
            description: 'Asia’s largest B2B commerce platform for industrial tools, maintenance supplies, and raw material procurement.',
            location: 'Noida / Bengaluru, India',
            overlapScore: 85,
            marketPosition: 'Industrial Procurement Unicorn',
            sampleKeywords: ['industrial supplies b2b india', 'mro procurement platform', 'factory supply wholesale'],
            keyDifferentiator: 'Enterprise supply chain digitisation and contracted vendor networks.',
          },
          {
            domain: 'flipkart.com',
            name: 'Flipkart (Walmart Group)',
            industry: 'Consumer Digital Commerce & Wholesale',
            description: "India's homegrown e-commerce pioneer serving over 500 million registered users.",
            location: 'Bengaluru, India',
            overlapScore: 81,
            marketPosition: 'National Consumer Giant',
            sampleKeywords: ['online shopping marketplace india', 'flipkart wholesale distributor', 'consumer goods delivery'],
            keyDifferentiator: 'Massive pan-India supply chain infrastructure (Ekart).',
          },
        ];
      }

      // Worldwide E-Commerce
      return [
        {
          domain: 'shopify.com',
          name: 'Shopify',
          industry: 'Global Commerce Platform',
          description: 'Unified commerce platform powering millions of businesses across direct-to-consumer and B2B wholesale.',
          location: 'Ottawa, Canada',
          overlapScore: 95,
          marketPosition: 'Global Platform Standard',
          sampleKeywords: ['online storefront builder', 'd2c commerce checkout', 'global merchant ecosystem'],
          keyDifferentiator: 'Massive app ecosystem and frictionless high-conversion checkout.',
        },
        {
          domain: 'bigcommerce.com',
          name: 'BigCommerce',
          industry: 'Enterprise Cloud Commerce & B2B',
          description: 'Open SaaS ecommerce platform designed for high-volume enterprise brands and complex B2B wholesale catalogs.',
          location: 'Austin, USA',
          overlapScore: 91,
          marketPosition: 'Enterprise Challenger',
          sampleKeywords: ['b2b ecommerce platform', 'headless commerce engine', 'multi-storefront management'],
          keyDifferentiator: 'Robust built-in B2B wholesale quotation and multi-currency tools.',
        },
        {
          domain: 'alibaba.com',
          name: 'Alibaba Group',
          industry: 'Global B2B Wholesale Marketplace',
          description: "The world's largest online B2B trading platform connecting global buyers with certified manufacturers.",
          location: 'Hangzhou, China',
          overlapScore: 88,
          marketPosition: 'Worldwide Wholesale Leader',
          sampleKeywords: ['global b2b marketplace', 'wholesale manufacturer sourcing', 'trade assurance suppliers'],
          keyDifferentiator: 'Unsurpassed global buyer reach and cross-border trade assurance.',
        },
        {
          domain: 'amazon.com',
          name: 'Amazon Business',
          industry: 'Global E-Commerce & Commercial Supply',
          description: 'Global commercial procurement and retail marketplace delivering business-only pricing and logistics.',
          location: 'Seattle, USA',
          overlapScore: 84,
          marketPosition: 'Global Retail Giant',
          sampleKeywords: ['business procurement marketplace', 'global commercial supplies', 'multi-vendor ecommerce'],
          keyDifferentiator: 'Unrivaled global fulfillment and supply chain logistics.',
        },
        {
          domain: 'magento.com',
          name: 'Adobe Commerce (Magento)',
          industry: 'Enterprise Commerce & Custom Solutions',
          description: 'High-end customizable commerce engine for large manufacturing and multi-brand distribution networks.',
          location: 'San Jose, USA',
          overlapScore: 80,
          marketPosition: 'Custom Platform Alternative',
          sampleKeywords: ['enterprise product catalog', 'b2b custom checkout', 'erp commerce integration'],
          keyDifferentiator: 'Deep ERP integrations and infinite customizability.',
        },
      ];
    }

    // ──────────────────────────────────────────────────────────
    // 5. NO CURATED COVERAGE FOR THIS NICHE
    // ──────────────────────────────────────────────────────────
    //
    // This used to return TCS, Mahindra and Godrej for a regional client, and
    // Accenture, IBM and SAP for everyone else — whichever niche had gone
    // unrecognised. They are real companies, which is exactly why the result
    // was so misleading: a fruit pulp exporter in Nashik was shown five
    // conglomerates it does not compete with, presented as its top five
    // competitors, and the panel read as a canned demo.
    //
    // An empty list is the truthful answer when the niche is not covered. The
    // caller turns it into a prompt to refine the niche or add a competitor by
    // hand, which is useful; five wrong names are not.
    return [];
  }

  private async fetchLiveWebsiteMeta(domain: string): Promise<{
    title?: string;
    description?: string;
    businessName?: string;
    inferredIndustry?: string;
  } | null> {
    const urls = [`https://${domain}`, `http://${domain}`];
    for (const url of urls) {
      try {
        const res = await axios.get(url, {
          timeout: 4500,
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 GrowthX-MarketBot/1.0',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          maxRedirects: 4,
          validateStatus: (status) => status < 400,
        });

        const html = typeof res.data === 'string' ? res.data : '';
        if (!html) continue;

        const $ = cheerio.load(html);
        const title = $('title').first().text().trim() || $('meta[property="og:title"]').attr('content')?.trim() || '';
        const description =
          $('meta[name="description"]').attr('content')?.trim() ||
          $('meta[property="og:description"]').attr('content')?.trim() ||
          '';

        let jsonLdName = '';
        let jsonLdDesc = '';
        $('script[type="application/ld+json"]').each((_, el) => {
          try {
            const raw = $(el).html() || '';
            const data = JSON.parse(raw);
            if (data.name && typeof data.name === 'string') jsonLdName = data.name;
            if (data.description && typeof data.description === 'string') jsonLdDesc = data.description;
          } catch {}
        });

        const combinedText = `${title} ${description} ${jsonLdDesc}`.toLowerCase();
        let inferredIndustry = '';

        if (
          combinedText.includes('pulp') ||
          combinedText.includes('fruit') ||
          combinedText.includes('puree') ||
          combinedText.includes('aseptic') ||
          combinedText.includes('mango') ||
          combinedText.includes('concentrate') ||
          combinedText.includes('iqf') ||
          combinedText.includes('agro') ||
          combinedText.includes('food') ||
          combinedText.includes('spice') ||
          combinedText.includes('frozen')
        ) {
          inferredIndustry = 'Fruit Pulp, Purees, Concentrates & Agro Food Processing';
        } else if (
          combinedText.includes('transport') ||
          combinedText.includes('logistics') ||
          combinedText.includes('freight') ||
          combinedText.includes('cargo') ||
          combinedText.includes('warehousing') ||
          combinedText.includes('supply chain') ||
          combinedText.includes('truck') ||
          combinedText.includes('fleet')
        ) {
          inferredIndustry = 'Logistics, Freight & Fleet Transportation Services';
        } else if (
          combinedText.includes('manufactur') ||
          combinedText.includes('industrial') ||
          combinedText.includes('steel') ||
          combinedText.includes('fabricat') ||
          combinedText.includes('chemical') ||
          combinedText.includes('engineering')
        ) {
          inferredIndustry = 'Industrial Manufacturing & Engineering Solutions';
        } else if (
          combinedText.includes('seo') ||
          combinedText.includes('digital marketing') ||
          combinedText.includes('advertising') ||
          combinedText.includes('branding') ||
          combinedText.includes('content agency')
        ) {
          inferredIndustry = 'SEO, Performance Marketing & Digital Growth Agency';
        } else if (
          combinedText.includes('software') ||
          combinedText.includes('saas') ||
          combinedText.includes('cloud') ||
          combinedText.includes('api') ||
          combinedText.includes('developer')
        ) {
          inferredIndustry = 'Cloud Software, SaaS & Developer Platforms';
        } else if (
          combinedText.includes('ecommerce') ||
          combinedText.includes('store') ||
          combinedText.includes('shop') ||
          combinedText.includes('retail')
        ) {
          inferredIndustry = 'E-Commerce & Digital Merchandising';
        }

        return {
          title: title || undefined,
          description: description || jsonLdDesc || undefined,
          businessName: jsonLdName || undefined,
          inferredIndustry: inferredIndustry || undefined,
        };
      } catch (e) {
        this.logger.debug(`Live metadata fetch attempt failed for ${url}: ${e}`);
      }
    }
    return null;
  }

  private sanitizeCompetitor(
    raw: any,
    targetDomain: string,
    region: 'worldwide' | 'india' | 'maharashtra' = 'worldwide',
  ): AutoIdentifiedCompetitor | null {
    if (!raw || typeof raw !== 'object') return null;
    const cleanDomain = normalizeDomain(String(raw.domain || ''));
    if (!cleanDomain || !cleanDomain.includes('.') || cleanDomain.toLowerCase() === targetDomain.toLowerCase()) {
      return null;
    }

    const name = String(raw.name || cleanDomain).trim();
    const industry = String(raw.industry || 'Market Competitor').trim();
    const description = String(raw.description || `Direct competitor in ${industry}.`).trim();
    const overlapScore = Math.min(99, Math.max(50, Number(raw.overlapScore) || 85));
    const marketPosition = String(raw.marketPosition || 'Direct Competitor').trim();
    const keyDifferentiator = String(raw.keyDifferentiator || 'Key alternative in this space.').trim();

    const defaultLocation =
      region === 'maharashtra'
        ? 'Maharashtra, India'
        : region === 'india'
          ? 'India'
          : 'Global / Worldwide';

    const location = String(raw.location || defaultLocation).trim();

    let sampleKeywords: string[] = [];
    if (Array.isArray(raw.sampleKeywords)) {
      sampleKeywords = raw.sampleKeywords
        .map((k: any) => String(k).trim())
        .filter((k: string) => k.length > 2)
        .slice(0, 5);
    }
    if (sampleKeywords.length === 0) {
      sampleKeywords = [`${cleanDomain.split('.')[0]} alternatives`, `${industry.toLowerCase()} solutions`, 'best providers'];
    }

    return {
      domain: cleanDomain,
      name,
      industry,
      description,
      overlapScore,
      marketPosition,
      location,
      sampleKeywords,
      keyDifferentiator,
    };
  }

  private formatBrandName(domain: string): string {
    const raw = (domain || '').split('.')[0] || 'Brand';
    return raw
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, (char) => char.toUpperCase());
  }

  private inferSubjectFromDomain(domain: string): string {
    const lower = domain.toLowerCase();
    if (lower.includes('seo') || lower.includes('growth') || lower.includes('rank')) return 'AI SEO & Organic Search Growth';
    if (lower.includes('shop') || lower.includes('store') || lower.includes('cart')) return 'E-Commerce & Digital Merchandising';
    if (lower.includes('app') || lower.includes('cloud') || lower.includes('tech')) return 'Cloud Software & SaaS Technologies';
    if (lower.includes('health') || lower.includes('dental') || lower.includes('care')) return 'Healthcare & Wellness Services';
    if (lower.includes('law') || lower.includes('legal')) return 'Legal Advisory & Professional Services';
    return 'Digital Products & Market Services';
  }

  /**
   * Opening questions written around what this client actually sells.
   *
   * The four prompts on this page were fixed strings — "our core topic", "this
   * market" — identical for a fruit pulp exporter and a dentist, and useful to
   * neither. The crawl already knows the subject, so the questions can name it.
   *
   * Derived rather than generated: no model is called, because a page that
   * spends tokens before the operator has asked anything is a page nobody wants
   * to open. Falls back to the generic set when a project has not been crawled
   * yet, so the panel is never empty.
   */
  async suggestedQuestions(organizationId: string, projectId: string): Promise<string[]> {
    const generic = [
      'What changed in this market this week?',
      'Which competitors are winning AI citations for our core topic?',
      'What content should we create to close the biggest visibility gap?',
      'How is our positioning different from our top competitors?',
    ];

    try {
      await this.assertProjectInOrg(organizationId, projectId);

      const [project, recentPages, competitors] = await Promise.all([
        this.prisma.project.findUnique({ where: { id: projectId }, select: { name: true } }),
        // Narrowed below to the shortest URL, which on any site is the
        // homepage — its title and meta describe the business as a whole
        // rather than one product.
        this.prisma.page.findMany({
          where: { crawlJob: { website: { projectId } }, statusCode: 200, title: { not: null } },
          orderBy: { crawledAt: 'desc' },
          select: { url: true, title: true, metaDescription: true },
          take: 50,
        }),
        this.prisma.competitorDomain.findMany({ where: { projectId }, select: { domain: true }, take: 1 }),
      ]);

      const homepage = [...recentPages].sort((a, b) => a.url.length - b.url.length)[0];
      const subject = this.subjectFrom(homepage?.title, homepage?.metaDescription, project?.name);
      if (!subject) return generic;

      const rival = competitors[0]?.domain;
      return [
        `What changed for ${subject} buyers this week?`,
        rival
          ? `Which competitors are winning AI citations for ${subject}, and where does ${rival} rank?`
          : `Which competitors are winning AI citations for ${subject}?`,
        `What content should we create to close our biggest visibility gap in ${subject}?`,
        `How is our positioning in ${subject} different from our top competitors?`,
      ];
    } catch {
      // Suggestions are decoration. Nothing here is worth failing the page for.
      return generic;
    }
  }

  /**
   * The business, in a few words, taken from how the site describes itself.
   *
   * A title is typically "<what it does> | <brand>" or "<brand> - <what it
   * does>", so the brand half is dropped and the descriptive half kept. The
   * meta description is the fallback because it is prose rather than a label,
   * and a truncated clause reads worse than a slightly generic question.
   */
  private subjectFrom(title?: string | null, meta?: string | null, projectName?: string | null): string | null {
    const brand = (projectName ?? '').trim().toLowerCase();

    const fromTitle = (title ?? '')
      .split(/[|–—]|\s-\s/)
      .map((part) => part.trim())
      .filter((part) => part.length >= 8 && (!brand || !part.toLowerCase().includes(brand)))
      .sort((a, b) => b.length - a.length)[0];

    const candidate = fromTitle ?? (meta ?? '').split(/[.!?]/)[0]?.trim();
    if (!candidate || candidate.length < 8) return null;

    // Long enough to be specific, short enough to read inside a question.
    return candidate.length > 70 ? `${candidate.slice(0, 70).trimEnd()}…` : candidate;
  }

  // ── tenancy ───────────────────────────────────────────────────────────────

  /**
   * Confirms the project belongs to the organization on the request.
   *
   * Called at the top of every entry point. The guard chain already resolved
   * the organization from the caller's membership, so this closes the last gap:
   * a valid member of org A passing a project id from org B.
   */
  private async assertProjectInOrg(organizationId: string, projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, organizationId },
      select: { id: true },
    });
    if (!project) {
      throw new NotFoundException('Project not found in this organization.');
    }
  }

  /** Loads a thread, refusing any that belongs to a different tenant. */
  private async assertThread(organizationId: string, projectId: string, threadId: string) {
    const thread = await this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
    });
    if (!thread) {
      throw new NotFoundException('Research thread not found for this project.');
    }
    return thread;
  }

  // ── threads ───────────────────────────────────────────────────────────────

  async listThreads(organizationId: string, projectId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.findMany({
      where: { organizationId, projectId },
      orderBy: { updatedAt: 'desc' },
      select: { id: true, title: true, createdAt: true, updatedAt: true },
    });
  }

  async createThread(organizationId: string, projectId: string, title: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    return this.prisma.marketResearchThread.create({
      data: { organizationId, projectId, title: title.slice(0, 200) || 'New research' },
    });
  }

  async getThread(organizationId: string, projectId: string, threadId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    await this.assertThread(organizationId, projectId, threadId);

    return this.prisma.marketResearchThread.findFirst({
      where: { id: threadId, organizationId, projectId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        runs: {
          orderBy: { startedAt: 'asc' },
          include: { sources: { orderBy: { sourceKey: 'asc' } } },
        },
      },
    });
  }

  async getRunSources(organizationId: string, projectId: string, runId: string) {
    await this.assertProjectInOrg(organizationId, projectId);
    const run = await this.prisma.marketResearchRun.findFirst({
      where: { id: runId, organizationId, projectId },
      select: { id: true },
    });
    if (!run) throw new NotFoundException('Research run not found for this project.');

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  // ── the research flow ─────────────────────────────────────────────────────

  /**
   * Runs the pipeline: classify, plan, retrieve, answer, validate, persist.
   *
   * The order matters. Sources are written before the answer is validated so a
   * failed or partly-valid run still leaves an auditable record of exactly what
   * was retrieved and what the model did with it.
   */
  async ask(options: AskOptions) {
    const { organizationId, projectId } = options;

    // Validated here rather than only in the DTO. A route whose body was
    // stripped — a global ValidationPipe with `whitelist: true` removes every
    // property of a DTO that carries no class-validator decorator — used to
    // arrive with `question` undefined and crash on the first `.slice()`,
    // which the customer saw as a bare "Internal server error". A missing
    // question is a bad request, and it is one wherever the call came from:
    // the scheduler and the smoke script reach this method without a pipe.
    const question = typeof options.question === 'string' ? options.question.trim() : '';
    if (!question) {
      throw new BadRequestException('A question is required to run market research.');
    }

    await this.assertProjectInOrg(organizationId, projectId);

    const thread = options.threadId
      ? await this.assertThread(organizationId, projectId, options.threadId)
      : await this.prisma.marketResearchThread.create({
          data: { organizationId, projectId, title: question.slice(0, 120) },
        });

    const run = await this.prisma.marketResearchRun.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        question,
        deepResearch: Boolean(options.deepResearch),
        status: ResearchRunStatus.RUNNING,
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId: thread.id,
        organizationId,
        projectId,
        role: ResearchMessageRole.USER,
        content: question,
      },
    });

    const usage: ModelUsage[] = [];

    try {
      // 1. Classify and plan.
      const classification = await this.classify(question, usage);

      // 2. Retrieve. Client context first — it is what makes the answer about
      //    this business rather than the category in general.
      const context = await this.evidence.loadClientContext(projectId);
      if (!context) throw new NotFoundException('Project not found.');

      const clientSources = await this.evidence.searchClientPages(
        organizationId,
        projectId,
        classification.clientDataQuery || question,
      );
      const visibilitySources = this.evidence.visibilitySources(context);

      // 3. Public web. The hosted search reports which URLs it actually read;
      //    only those become citable.
      const web = await this.models.generate({
        step: 'web-research',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions:
          'Research the question using web search. Summarise what you found, ' +
          'attributing each point to the page it came from. Do not speculate.',
        input: [
          `Question: ${question}`,
          `Searches to run: ${classification.searchQueries.join(' | ')}`,
          `Client: ${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
        ].join('\n'),
        webSearch: true,
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(web.usage);

      // When web search cannot run, the answer must say so rather than quietly
      // presenting a client-data-only answer as if the market had been checked.
      const retrievalGaps: string[] = [];
      if (web.webSearchUnavailable) retrievalGaps.push(web.webSearchUnavailable);
      if (!this.models.supportsEmbeddings()) {
        retrievalGaps.push(
          'No embedding model is configured, so client pages were matched by keyword rather than meaning.',
        );
      }

      const webSources = this.evidence.webSources(web.webSources);

      // 4. Assemble the citable set and persist it before answering.
      const allSources = [...webSources, ...clientSources, ...visibilitySources];
      const stored = await this.persistSources(run.id, organizationId, projectId, allSources);
      const validKeys = new Set(stored.map((s) => s.sourceKey));

      // 5. Answer, or report honestly that we cannot.
      if (stored.length === 0) {
        // Say which of the two things actually happened. A project with a
        // finished crawl that still retrieves nothing has a linkage problem,
        // not a missing crawl, and telling them to crawl again wastes their
        // time on the wrong fix.
        const crawledPages = await this.evidence.countClientPages(projectId);
        return this.finishWithNoEvidence(
          run.id,
          thread.id,
          organizationId,
          projectId,
          usage,
          retrievalGaps,
          crawledPages,
        );
      }

      const answerResult = await this.models.generate({
        step: 'answer',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions: ANSWER_INSTRUCTIONS,
        input: this.buildAnswerInput(question, context, stored, web.text),
        jsonSchema: { name: ANSWER_SCHEMA.name, schema: ANSWER_SCHEMA.schema as Record<string, unknown> },
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(answerResult.usage);

      const parsed = parseJson(answerResult.text);

      // 6. Enforce the citation rules independently of the model.
      const validation = validateCitations(parsed, validKeys);
      if (validation.invalidCitations.length > 0) {
        this.logger.warn(
          `Run ${run.id} cited ${validation.invalidCitations.length} source(s) that were not retrieved: ${validation.invalidCitations.join(', ')}`,
        );
      }

      const answer = {
        summary: String(parsed.summary ?? ''),
        confidence: normaliseConfidence(parsed.confidence, validation.verifiedClaims.length),
        verifiedClaims: validation.verifiedClaims,
        inferences: validation.inferences,
        citationGaps: Array.isArray(parsed.citationGaps) ? parsed.citationGaps : [],
        recommendedActions: validation.recommendedActions,
        evidenceGaps: [
          ...(Array.isArray(parsed.evidenceGaps) ? parsed.evidenceGaps.map(String) : []),
          ...validation.warnings,
          ...retrievalGaps,
        ],
      };

      await this.persistClaims(run.id, organizationId, projectId, answer, stored);
      await this.persistOpportunitiesAndActions(run.id, organizationId, projectId, answer);

      const totals = sumUsage(usage);
      await this.prisma.marketResearchRun.update({
        where: { id: run.id },
        data: {
          status: ResearchRunStatus.SUCCEEDED,
          intent: classification.intent,
          plan: classification as unknown as object,
          answer: answer as unknown as object,
          confidence: CONFIDENCE[answer.confidence] ?? ResearchConfidence.LOW,
          modelUsage: usage as unknown as object,
          inputTokens: totals.inputTokens,
          outputTokens: totals.outputTokens,
          finishedAt: new Date(),
        },
      });

      await this.prisma.marketResearchMessage.create({
        data: {
          threadId: thread.id,
          organizationId,
          projectId,
          role: ResearchMessageRole.ASSISTANT,
          content: answer.summary,
          runId: run.id,
        },
      });

      await this.prisma.marketResearchThread.update({
        where: { id: thread.id },
        data: { updatedAt: new Date() },
      });

      return { threadId: thread.id, runId: run.id, answer, sources: stored };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      // Bookkeeping must not swallow the real failure. If the database is the
      // thing that broke, this update throws too, and rethrowing *its* error
      // would report a connection fault where the customer needs to see the
      // model or retrieval failure that actually stopped the run.
      try {
        await this.prisma.marketResearchRun.update({
          where: { id: run.id },
          data: { status: ResearchRunStatus.FAILED, error: message.slice(0, 2000), finishedAt: new Date() },
        });
      } catch (bookkeeping) {
        this.logger.error(`Could not mark run ${run.id} failed: ${String(bookkeeping)}`);
      }

      this.logger.warn(`Research run ${run.id} failed: ${message}`);

      // An HttpException already carries a message the UI can show. Anything
      // else would reach the browser as Nest's generic "Internal server error",
      // which tells the customer nothing and tells us nothing either.
      if (error instanceof HttpException) throw error;
      throw new InternalServerErrorException(`Market research failed: ${message}`);
    }
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private async classify(question: string, usage: ModelUsage[]) {
    const result = await this.models.generate({
      step: 'classify',
      role: ModelRole.WORKER,
      instructions: CLASSIFY_INSTRUCTIONS,
      input: question,
      jsonSchema: { name: CLASSIFY_SCHEMA.name, schema: CLASSIFY_SCHEMA.schema as Record<string, unknown> },
      maxOutputTokens: 1000,
    });
    usage.push(result.usage);

    const parsed = parseJson(result.text);
    const intent = (parsed.intent as ResearchIntent) ?? ResearchIntent.MARKET_TREND;
    return {
      intent: Object.values(ResearchIntent).includes(intent) ? intent : ResearchIntent.MARKET_TREND,
      searchQueries: Array.isArray(parsed.searchQueries) ? parsed.searchQueries.map(String).slice(0, 4) : [question],
      clientDataQuery: typeof parsed.clientDataQuery === 'string' ? parsed.clientDataQuery : question,
    };
  }

  private async persistSources(
    runId: string,
    organizationId: string,
    projectId: string,
    sources: RetrievedSource[],
  ) {
    const seen = new Set<string>();
    const rows: {
      runId: string;
      organizationId: string;
      projectId: string;
      sourceKey: string;
      type: ResearchSourceType;
      url: string | null;
      internalDocId: string | null;
      title: string;
      publisher: string | null;
      publishedAt: Date | null;
      excerpt: string;
      qualityScore: number;
    }[] = [];

    for (const source of sources) {
      // Dedupe on the identity of the thing, so the same page arriving from web
      // search and from the client's own crawl is one citable source.
      const identity = source.url ?? source.internalDocId ?? source.title;
      if (seen.has(identity)) continue;
      seen.add(identity);

      rows.push({
        runId,
        organizationId,
        projectId,
        sourceKey: `source_${rows.length + 1}`,
        type: source.type,
        url: source.url ?? null,
        internalDocId: source.internalDocId ?? null,
        title: source.title.slice(0, 400),
        publisher: source.publisher ?? null,
        publishedAt: source.publishedAt ?? null,
        excerpt: source.excerpt.slice(0, 2000),
        qualityScore: source.qualityScore,
      });
    }

    if (rows.length === 0) return [];
    await this.prisma.researchSource.createMany({ data: rows });

    return this.prisma.researchSource.findMany({
      where: { runId, organizationId, projectId },
      orderBy: { sourceKey: 'asc' },
    });
  }

  private async persistClaims(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      verifiedClaims: { claim: string; citationIds: string[] }[];
      inferences: { statement: string; reasoning: string; citationIds: string[] }[];
    },
    sources: { id: string; sourceKey: string }[],
  ) {
    const idByKey = new Map(sources.map((s) => [s.sourceKey, s.id]));

    for (const claim of answer.verifiedClaims) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'VERIFIED',
          text: claim.claim,
          citations: {
            connect: claim.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }

    for (const inference of answer.inferences) {
      await this.prisma.researchClaim.create({
        data: {
          runId,
          organizationId,
          projectId,
          kind: 'INFERENCE',
          text: inference.statement,
          reasoning: inference.reasoning,
          citations: {
            connect: inference.citationIds
              .map((key) => idByKey.get(key))
              .filter((id): id is string => Boolean(id))
              .map((id) => ({ id })),
          },
        },
      });
    }
  }


  /**
   * Turns the validated answer into reviewable work.
   *
   * Only actions that survived citation validation reach this point, so every
   * row here is evidence-backed by construction. They are written as PROPOSED:
   * this is a queue for a human, never an instruction to act.
   */
  private async persistOpportunitiesAndActions(
    runId: string,
    organizationId: string,
    projectId: string,
    answer: {
      citationGaps: any[];
      recommendedActions: { type: string; title: string; description: string; expectedImpact: string; confidence: string }[];
    },
  ) {
    for (const gap of answer.citationGaps ?? []) {
      if (!gap?.topic || !gap?.gap) continue;
      await this.prisma.marketOpportunity.create({
        data: {
          runId,
          organizationId,
          projectId,
          topic: String(gap.topic),
          gap: String(gap.gap),
          competitorsWinning: Array.isArray(gap.competitorsWinning) ? gap.competitorsWinning.map(String) : [],
          recommendedResponse: String(gap.recommendedResponse ?? ''),
          impact: LEVEL[String(gap.impact).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          effort: LEVEL[String(gap.effort).toLowerCase()] ?? ResearchConfidence.MEDIUM,
        },
      });
    }

    for (const action of answer.recommendedActions ?? []) {
      const type = ACTION_TYPES[action.type];
      if (!type) continue;

      // The model can return an action with a type but no title. Passing that
      // straight to Prisma throws on a required column and loses the whole
      // answer at the last step, after every token has been spent. An action
      // nobody can read is not worth queueing, so it is dropped instead.
      const title = String(action.title ?? '').trim();
      if (!title) {
        this.logger.warn(`Run ${runId}: dropped a ${type} action with no title.`);
        continue;
      }

      await this.prisma.marketAction.create({
        data: {
          organizationId,
          projectId,
          runId,
          type,
          title,
          description: String(action.description ?? ''),
          expectedImpact: action.expectedImpact ? String(action.expectedImpact) : null,
          confidence: LEVEL[String(action.confidence).toLowerCase()] ?? ResearchConfidence.MEDIUM,
          status: MarketActionStatus.PROPOSED,
          requiresApproval: true,
        },
      });
    }
  }

  /**
   * The honest empty state. Retrieval found nothing, so the run succeeds with
   * an explicit "no reliable evidence" rather than letting the model answer
   * from memory.
   */
  private async finishWithNoEvidence(
    runId: string,
    threadId: string,
    organizationId: string,
    projectId: string,
    usage: ModelUsage[],
    retrievalGaps: string[] = [],
    crawledPages = 0,
  ) {
    const summary =
      crawledPages > 0
        ? 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          `even though this project has ${crawledPages} crawled page(s) — they could not be reached ` +
          'for this run.'
        : 'No reliable evidence found. No usable sources were retrieved for this question, ' +
          'and this project has no crawled pages or AI-visibility history to draw on yet.';

    const answer = {
      summary,
      confidence: 'low' as const,
      verifiedClaims: [],
      inferences: [],
      citationGaps: [],
      recommendedActions: [],
      evidenceGaps: [
        'No sources were retrieved for this question.',
        crawledPages > 0
          ? `This project has ${crawledPages} crawled page(s) that were not used. Check that the ` +
            'crawled site is linked to this project, then track prompts so AI-visibility history ' +
            'can be used as evidence too.'
          : 'Crawl the client site and track prompts so future research can use their own data.',
        ...retrievalGaps,
      ],
    };

    const totals = sumUsage(usage);
    await this.prisma.marketResearchRun.update({
      where: { id: runId },
      data: {
        status: ResearchRunStatus.SUCCEEDED,
        answer: answer as unknown as object,
        confidence: ResearchConfidence.LOW,
        modelUsage: usage as unknown as object,
        inputTokens: totals.inputTokens,
        outputTokens: totals.outputTokens,
        finishedAt: new Date(),
      },
    });

    await this.prisma.marketResearchMessage.create({
      data: {
        threadId,
        organizationId,
        projectId,
        role: ResearchMessageRole.ASSISTANT,
        content: answer.summary,
        runId,
      },
    });

    return { threadId, runId, answer, sources: [] };
  }

  private buildAnswerInput(
    question: string,
    context: { projectName: string; domains: string[]; competitors: { domain: string; label: string | null }[]; trackedPrompts: { text: string; cluster: string | null }[]; visibility: unknown },
    sources: { sourceKey: string; type: string; title: string; url: string | null; excerpt: string; publisher: string | null }[],
    webSummary: string,
  ): string {
    const sourceBlock = sources
      .map(
        (s) =>
          `[${s.sourceKey}] (${s.type}) ${s.title}\n` +
          `    ${s.url ?? 'internal record'}${s.publisher ? ` — ${s.publisher}` : ''}\n` +
          (s.excerpt ? `    "${s.excerpt.slice(0, 400)}"` : '    (no excerpt captured)'),
      )
      .join('\n');

    return [
      `# Question\n${question}`,
      `# Client\n${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
      `# Tracked competitors\n${context.competitors.map((c) => c.label ?? c.domain).join(', ') || '(none)'}`,
      `# Tracked prompts\n${context.trackedPrompts.map((p) => `- ${p.text}`).join('\n') || '(none)'}`,
      `# AI visibility position\n${JSON.stringify(context.visibility ?? 'not measured')}`,
      `# Web research notes\n${webSummary || '(none)'}`,
      `# SOURCES — you may cite only these ids\n${sourceBlock}`,
    ].join('\n\n');
  }
}

function sumUsage(usage: ModelUsage[]) {
  return usage.reduce(
    (acc, u) => ({
      inputTokens: acc.inputTokens + u.inputTokens,
      outputTokens: acc.outputTokens + u.outputTokens,
    }),
    { inputTokens: 0, outputTokens: 0 },
  );
}

/**
 * Confidence is capped by the evidence that survived validation. A model
 * claiming "high" after every one of its citations was stripped would be
 * reporting confidence in nothing.
 */
function normaliseConfidence(raw: unknown, verifiedCount: number): 'high' | 'medium' | 'low' {
  const stated = String(raw).toLowerCase();
  const value: 'high' | 'medium' | 'low' =
    stated === 'high' || stated === 'medium' || stated === 'low' ? stated : 'low';
  if (verifiedCount === 0) return 'low';
  if (value === 'high' && verifiedCount < 2) return 'medium';
  return value;
}

export function parseJson(text: string): Record<string, unknown> {
  return parseModelJson<Record<string, unknown>>(text, 'Market research');
}
