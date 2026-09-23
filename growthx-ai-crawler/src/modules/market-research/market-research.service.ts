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
import { CompetitorVerificationService, RejectedCompetitor, VerifiableCompetitor } from './competitor-verification.service';
import { CompetitorDiscoveryService } from './competitor-discovery.service';
import { CompetitorCrawlService } from '../content-intelligence/competitor-crawl.service';
import { WebSearchService } from './web-search.service';
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
  /**
   * Called as each stage of the run starts and finishes, so a streaming
   * caller can report real progress instead of estimating it.
   *
   * Never allowed to affect the run: `ask` wraps every call, so a listener
   * that throws — a closed connection, a serialisation error — is logged and
   * the research carries on. Nothing here is awaited either, because a slow
   * consumer must not hold the pipeline open.
   */
  onProgress?: (event: ResearchProgressEvent) => void;
}

/** The stages of a run, in the order `ask` performs them. */
export type ResearchStage = 'classify' | 'client' | 'web' | 'assemble' | 'answer' | 'verify';

export interface ResearchProgressEvent {
  stage: ResearchStage;
  status: 'started' | 'done';
  /** One line for the operator, e.g. "7 pages from this client's crawl". */
  detail?: string;
  /**
   * Sources, sent once the citable set is stored. This is what lets the UI
   * fill its sources rail while the answer is still being written, rather
   * than everything landing at once at the end.
   */
  sources?: unknown[];
}

export interface AutoIdentifiedCompetitor {
  domain: string;
  name: string;
  industry: string;
  description: string;
  /**
   * Measured from search evidence for `search` rows. Null for a model's
   * suggestion: its guess at overlap is not a measurement.
   */
  overlapScore: number | null;
  marketPosition: string;
  location?: string;
  sampleKeywords: string[];
  keyDifferentiator: string;
  isAlreadyAdded?: boolean;
  existingId?: string;
  /**
   * Set once the company has been proven real: either its live site was
   * fetched and matched this market, or its server was proven reachable.
   * Only verified competitors are returned, so this is what the UI badges.
   */
  verified?: boolean;
  /** Title tag read from the live site during verification. */
  verifiedTitle?: string;
  verifiedAt?: string;
  /**
   * `content` — the homepage was read and matched this market.
   * `reachable` — a real server answered but refused to serve a bot, so the
   * company is proven to exist without its copy having been read. The UI says
   * which, rather than badging both as though the site had been read.
   */
  verificationLevel?: 'content' | 'reachable';
  /**
   * Where the name came from.
   *
   * `search` — found ranking for the client's own buyer keywords, the only
   * source that works in every market. `ai` — recalled by the model.
   */
  source?: 'search' | 'ai';
}

/** A proposed competitor that failed verification, kept so the UI can say why. */
export type CompetitorRejection = RejectedCompetitor;

/** How many competitors the panel shows once verification has run. */
const COMPETITOR_SLOTS = 5;

/**
 * How many the model is asked for.
 *
 * Deliberately more than are shown. Verification drops anything it cannot
 * prove — an unreachable domain, a parking page, a company in the wrong market
 * — so asking for exactly five meant one bad guess left four, and four bad
 * guesses left the dairy client with a single competitor. Over-fetching costs
 * a few more HEAD-weight requests and keeps the shown list full of real names.
 */
const CANDIDATE_TARGET = 12;

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
    @Optional() private readonly webSearch?: WebSearchService,
    @Optional() private readonly discovery?: CompetitorDiscoveryService,
    @Optional() private readonly competitorCrawl?: CompetitorCrawlService,
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

    // 4. Search the market the way this client's customers search it.
    //
    // This runs before the model because it is the only source that works for
    // every client the platform sells to; a model knows the famous names and
    // invents the rest. Whoever ranks for the phrases this
    // client's buyers type is their competitor, in any industry, country or
    // language, and the SERP is evidence anyone can re-run.
    let searchCandidates: VerifiableCompetitor[] = [];
    let marketWasSearched = false;
    if (this.discovery?.isConfigured()) {
      try {
        const found = await this.discovery.discover({
          domain,
          businessName,
          subject,
          region: normalizedRegion,
          profile,
        });
        searchCandidates = found.candidates;
        marketWasSearched = found.queriesRun.length > 0;
      } catch (err) {
        this.logger.warn(`Competitor search failed for ${domain}: ${err}. Falling back to model recall.`);
      }
    } else {
      // Worth saying loudly in the log: without a search provider every client
      // depends on model recall alone.
      this.logger.warn(
        `No web search provider configured (TAVILY_API_KEY); competitors for ${domain} come from model recall only.`,
      );
    }

    // 5. Ask the model as well, and merge.
    //
    // The two sources fail in opposite directions, which is why both run: the
    // search finds whoever is ranking today but misses a household name with
    // no page for this keyword, and the model knows the household names but
    // cannot tell recall from invention. Search evidence wins ties.
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
          `Task: Identify up to ${CANDIDATE_TARGET} DIRECT REAL-WORLD competitors that compete for the same customers, search rankings, or market share in ${regionLabel} for ${subject}.`,
          ``,
          `Only the strongest 5 are shown to the customer, and every domain is fetched and checked against the live web first. Name every real competitor you know of, not just five — the extras are what keep the final list full when a domain turns out to be unreachable.`,
          ``,
          `CRITICAL STRICT REQUIREMENTS:`,
          `1. Name ONLY companies you actually know to exist, with the domain you actually know them by. Every domain will be fetched and checked against the live web before it is shown to the customer, and anything that does not resolve is discarded.`,
          `2. Include the household-name market leaders as well as the smaller direct rivals. If a national brand and a local one both compete for these customers, name both.`,
          `3. It is far better to leave out a company you are unsure of than to guess its domain. Certainty about each name matters more than reaching the count.`,
          `4. For ${normalizedRegion === 'maharashtra' ? 'Maharashtra' : normalizedRegion === 'india' ? 'India' : 'Worldwide'}, every competitor must be legitimately based or active in that geographic market.`,
          `5. Absolutely DO NOT generate fake, fictitious, or placeholder domain names (such as "apexbrand.com", "example.com", "dummy.com", or synthetic mock names).`,
          `6. Do NOT return the same company twice, under any spelling or domain variant.`,
          `7. Do NOT guess a domain from a brand name. If you do not know the company's real website, leave that company out.`,
          `8. Do NOT return unrelated businesses, generic search engines, marketplaces, social networks, or encyclopedias (like google.com, indiamart.com, wikipedia.org).`,
          `9. Do NOT include the target domain (${domain}) itself.`,
          `10. Include a descriptive 'location' property indicating where each company is headquartered or located (e.g. "Pune, Maharashtra", "Nashik, Maharashtra", "Bengaluru, India", "Germany", "USA").`,
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
            'and an invented one is discarded and counted against the result. ' +
            'Name every real competitor in this market that you are sure of, market leaders included — only the strongest few survive verification and reach the customer. ' +
            'Return ONLY valid JSON matching the schema.',
          input: prompt,
          jsonSchema: schema,
          maxOutputTokens: 5000,
        });

        const parsed = parseJson(result.text) as { competitors?: unknown[] };
        if (Array.isArray(parsed?.competitors) && parsed.competitors.length > 0) {
          candidates = parsed.competitors
            .map((raw: any) => this.sanitizeCompetitor(raw, domain, normalizedRegion))
            .filter((c): c is AutoIdentifiedCompetitor => c !== null);
        }
      } catch (err) {
        this.logger.warn(`AI competitor identification failed for ${domain}: ${err}. No model candidates for this run.`);
      }
    }

    // 6. Verify every proposed competitor against the live web.
    //
    // Search results and model output both go through this, and they need it
    // for different reasons: the model invents domains, while a search result
    // can be a real page belonging to a supplier, a customer or a trade body
    // rather than a rival.
    //
    // Search-found domains go first so that when the same company arrives from
    // both, the row kept is the one backed by a SERP position.
    const searchDomains = new Set(searchCandidates.map((c) => normalizeDomain(c.domain)));
    const merged: VerifiableCompetitor[] = [
      ...searchCandidates,
      ...candidates.filter((c) => !searchDomains.has(normalizeDomain(c.domain))),
    ];
    const sourceOf = new Map<string, 'search' | 'ai'>();
    for (const candidate of merged) {
      sourceOf.set(normalizeDomain(candidate.domain), searchDomains.has(normalizeDomain(candidate.domain)) ? 'search' : 'ai');
    }

    const proposedCount = merged.length;
    let rejected: CompetitorRejection[] = [];

    if (this.verification && merged.length > 0) {
      const nicheText = [subject, profile?.summary, ...(profile?.offerings || []), ...(profile?.seedKeywords || [])]
        .filter(Boolean)
        .join(' ');
      try {
        const outcome = await this.verification.verify(merged, domain, nicheText, normalizedRegion);
        // `matchedTerms` is dropped: it is how the check was made, not
        // something the operator needs on the card.
        candidates = outcome.verified.map(({ matchedTerms, ...rest }) => ({
          ...rest,
          verified: true as const,
          source: sourceOf.get(normalizeDomain(rest.domain)) ?? 'ai',
        }));
        rejected = outcome.rejected;
      } catch (err) {
        this.logger.warn(`Competitor verification failed for ${domain}: ${err}. No candidate could be verified.`);
        candidates = [];
      }
    } else {
      // Verification is optional wiring. With it absent nothing has been
      // checked, so nothing is badged as checked either.
      candidates = merged.map((c) => ({ ...c, source: sourceOf.get(normalizeDomain(c.domain)) ?? 'ai' }));
    }

    if (proposedCount > 0 && rejected.length > 0) {
      notes.push(
        `${rejected.length} of ${proposedCount} suggested ${rejected.length === 1 ? 'company was' : 'companies were'} dropped because ${rejected.length === 1 ? 'it' : 'they'} could not be verified as a real business in this market.`,
      );
    }

    // No hardcoded list tops this up. It used to pad a short result from a
    // built-in table of six industries in three Indian regions, with overlap
    // scores and keywords nobody measured for this client. A short list of
    // verified rivals is the honest answer.
    if (candidates.length === 0) {
      notes.push(
        `No competitor could be verified for "${subject}" in this market. Refine the niche below, widen the scope, or add a competitor domain by hand.`,
      );
    } else if (candidates.length < COMPETITOR_SLOTS && !marketWasSearched) {
      // A short list means something different depending on whether the live
      // market was actually searched, and the operator deserves to know which.
      notes.push(
        `${candidates.length} verified ${candidates.length === 1 ? 'competitor' : 'competitors'} found without a live search of this market. Refine the niche or widen the scope to see more.`,
      );
    } else if (candidates.length < COMPETITOR_SLOTS) {
      notes.push(
        rejected.length > 0
          ? `${candidates.length} verified ${candidates.length === 1 ? 'competitor' : 'competitors'} found. The list is short because unverifiable suggestions were removed rather than shown.`
          : `${candidates.length} verified ${candidates.length === 1 ? 'competitor' : 'competitors'} found for this niche. Refine the niche or widen the scope to see more.`,
      );
    }

    // Sorted before slicing, so the five shown are the five highest-overlap
    // companies rather than the first five to arrive.
    // Measured rows first; a model suggestion carries no score to rank by.
    const competitors = [...candidates]
      .sort((a, b) => (b.overlapScore ?? -1) - (a.overlapScore ?? -1))
      .slice(0, COMPETITOR_SLOTS);

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
      confidenceScore?: number | null;
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
      const score = typeof item.confidenceScore === 'number' ? Math.round(item.confidenceScore) : null;

      const record = await this.prisma.competitorDomain.upsert({
        where: {
          projectId_domain: {
            projectId,
            domain: cleanDomain,
          },
        },
        // Status and lastAnalyzedAt are deliberately absent from both branches.
        //
        // Both used to be set here to ANALYZED and "now", at the moment of
        // saving, before anything had been fetched. A competitor added ten
        // seconds ago claimed a completed analysis it had never had, which is
        // the same class of untruth as the invented numbers removed elsewhere
        // — and it made "how many have actually been crawled?" unanswerable,
        // since every row looked crawled the instant it was created.
        //
        // The schema defaults a new row to PENDING; the crawl kicked off below
        // moves it to ANALYZING and, on success, to ANALYZED with a real
        // timestamp. On update they are left untouched so re-adding an
        // existing competitor never discards a genuine crawl history.
        update: {
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || (item.location ? `Based in ${item.location}` : undefined),
          confidenceScore: score,
        },
        create: {
          projectId,
          domain: cleanDomain,
          label,
          name,
          industry: item.industry || undefined,
          description: item.description || (item.location ? `Based in ${item.location}` : undefined),
          confidenceScore: score,
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

    // Start crawling now instead of at 02:00 UTC.
    //
    // The daily sweep was the only thing that ever crawled these, so a
    // customer who added competitors at nine in the morning saw empty
    // competitor tabs for seventeen hours and reasonably concluded the
    // product was broken. Nothing about the first crawl needs to wait for a
    // schedule; the schedule exists to refresh, not to begin.
    //
    // Deliberately not awaited: `startCrawl` enqueues the job rather than
    // performing it, but it still costs several round trips per competitor,
    // and none of that should sit between the operator and their confirmation.
    // Errors are contained here for the same reason — a crawl that fails to
    // start must not turn a successful save into a 500.
    if (this.competitorCrawl && saved.length > 0) {
      void this.beginCrawls(organizationId, projectId, saved);
    }

    return {
      success: true,
      count: saved.length,
      addedCompetitors: saved,
    };
  }

  /** Starts each new competitor's first crawl, one at a time, never throwing. */
  private async beginCrawls(
    organizationId: string,
    projectId: string,
    competitors: Array<{ id: string; domain: string }>,
  ): Promise<void> {
    for (const competitor of competitors) {
      try {
        await this.competitorCrawl!.startCrawl(organizationId, projectId, competitor.id);
      } catch (err) {
        // The competitor is saved and the daily sweep will retry it, so this
        // is a delay rather than a failure worth surfacing to the operator.
        this.logger.warn(
          `Could not start the first crawl for ${competitor.domain}: ${err}. The 02:00 UTC sweep will retry it.`,
        );
      }
    }
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

    // Whatever the model left out stays empty. Stock phrases ("Direct
    // Competitor", "best providers") and a location assumed from the region
    // read on the card as facts about this company.
    const name = String(raw.name || cleanDomain).trim();
    const industry = String(raw.industry || '').trim();
    const description = String(raw.description || '').trim();
    const marketPosition = String(raw.marketPosition || '').trim();
    const keyDifferentiator = String(raw.keyDifferentiator || '').trim();
    const location = String(raw.location || '').trim() || undefined;

    let sampleKeywords: string[] = [];
    if (Array.isArray(raw.sampleKeywords)) {
      sampleKeywords = raw.sampleKeywords
        .map((k: any) => String(k).trim())
        .filter((k: string) => k.length > 2)
        .slice(0, 5);
    }

    return {
      domain: cleanDomain,
      name,
      industry,
      description,
      overlapScore: null,
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
    if (lower.includes('milk') || lower.includes('dairy') || lower.includes('dudh') || lower.includes('doodh')) {
      return 'Dairy, Fresh Milk Delivery & Milk Subscriptions';
    }
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

    // Progress reporting is best-effort by construction: a listener that
    // throws must never cost the customer a run they have already paid model
    // tokens for.
    const emit = (event: ResearchProgressEvent) => {
      if (!options.onProgress) return;
      try {
        options.onProgress(event);
      } catch (err) {
        this.logger.debug(`Progress listener failed for run ${run.id}: ${err}`);
      }
    };

    try {
      // 1. Classify and plan.
      emit({ stage: 'classify', status: 'started' });
      const classification = await this.classify(question, usage);
      emit({
        stage: 'classify',
        status: 'done',
        detail: `Intent: ${String(classification.intent).replace(/_/g, ' ').toLowerCase()} · ${classification.searchQueries.length} search${classification.searchQueries.length === 1 ? '' : 'es'} planned`,
      });

      // 2. Retrieve. Client context first — it is what makes the answer about
      //    this business rather than the category in general.
      emit({ stage: 'client', status: 'started' });
      const context = await this.evidence.loadClientContext(projectId);
      if (!context) throw new NotFoundException('Project not found.');

      const clientSources = await this.evidence.searchClientPages(
        organizationId,
        projectId,
        classification.clientDataQuery || question,
      );
      const visibilitySources = this.evidence.visibilitySources(context);
      emit({
        stage: 'client',
        status: 'done',
        detail: `${clientSources.length} page${clientSources.length === 1 ? '' : 's'} from the crawl · ${visibilitySources.length} AI-visibility check${visibilitySources.length === 1 ? '' : 's'}`,
      });

      // 3. Public web.
      //
      // Searched directly rather than through the model: no provider the router
      // speaks to can search the live web from a Chat Completions call, so this
      // step used to be refused on every run and the answer fell back to the
      // client's own crawl. The search returns the page text with each result,
      // which is what lets a page be cited at all — the rule throughout is that
      // only pages actually read are citable.
      emit({ stage: 'web', status: 'started' });

      const retrievalGaps: string[] = [];
      let webSources: RetrievedSource[] = [];
      let webNotes = '';

      const outcome = this.webSearch
        ? await this.webSearch.search(classification.searchQueries, {
            recentOnly: isRecencyQuestion(question),
          })
        : { sources: [], queriesRun: [], unavailable: 'Web search is not available on this deployment.' };

      webSources = outcome.sources;
      // When the market could not be checked, the answer must say so rather
      // than quietly presenting a client-data-only answer as if it had been.
      if (outcome.unavailable) retrievalGaps.push(outcome.unavailable);

      // Summarised before answering so the answer step reasons over what the
      // pages said, not over raw HTML text.
      if (webSources.length > 0) {
        const notes = await this.models.generate({
          step: 'web-research',
          role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
          instructions:
            'Summarise what these retrieved pages say about the question, attributing each point to ' +
            'the page it came from. Use only the supplied text. Do not speculate and do not add facts ' +
            'that are not in it.',
          input: [
            `Question: ${question}`,
            `Client: ${context.projectName} (${context.domains.join(', ') || 'no domain on file'})`,
            '',
            ...webSources.map(
              (source, i) => `[${i + 1}] ${source.title} — ${source.url}\n${source.excerpt}`,
            ),
          ].join('\n'),
          maxOutputTokens: options.deepResearch ? 6000 : 4000,
        });
        usage.push(notes.usage);
        webNotes = notes.text;
      }

      if (!this.models.supportsEmbeddings()) {
        retrievalGaps.push(
          'No embedding model is configured, so client pages were matched by keyword rather than meaning.',
        );
      }
      emit({
        stage: 'web',
        status: 'done',
        detail: webSources.length
          ? `${webSources.length} page${webSources.length === 1 ? '' : 's'} read across ${outcome.queriesRun.length} search${outcome.queriesRun.length === 1 ? '' : 'es'}`
          : "Web search unavailable — answering from this client's data only",
      });

      // 4. Assemble the citable set and persist it before answering.
      emit({ stage: 'assemble', status: 'started' });
      const allSources = [...webSources, ...clientSources, ...visibilitySources];
      const stored = await this.persistSources(run.id, organizationId, projectId, allSources);
      const validKeys = new Set(stored.map((s) => s.sourceKey));
      // Sent with the stage rather than held to the end: the sources rail can
      // fill here, while the answer is still being written.
      emit({
        stage: 'assemble',
        status: 'done',
        detail: `${stored.length} citable source${stored.length === 1 ? '' : 's'}`,
        sources: stored,
      });

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

      emit({ stage: 'answer', status: 'started' });
      const answerResult = await this.models.generate({
        step: 'answer',
        role: options.deepResearch ? ModelRole.DEEP : ModelRole.ANALYST,
        instructions: ANSWER_INSTRUCTIONS,
        input: this.buildAnswerInput(question, context, stored, webNotes),
        jsonSchema: { name: ANSWER_SCHEMA.name, schema: ANSWER_SCHEMA.schema as Record<string, unknown> },
        maxOutputTokens: options.deepResearch ? 6000 : 4000,
      });
      usage.push(answerResult.usage);

      const parsed = parseJson(answerResult.text);
      emit({ stage: 'answer', status: 'done' });

      // 6. Enforce the citation rules independently of the model.
      emit({ stage: 'verify', status: 'started' });
      const validation = validateCitations(parsed, validKeys);
      if (validation.invalidCitations.length > 0) {
        this.logger.warn(
          `Run ${run.id} cited ${validation.invalidCitations.length} source(s) that were not retrieved: ${validation.invalidCitations.join(', ')}`,
        );
      }

      emit({
        stage: 'verify',
        status: 'done',
        detail: validation.invalidCitations.length
          ? `${validation.invalidCitations.length} unsupported citation${validation.invalidCitations.length === 1 ? '' : 's'} dropped`
          : 'Every citation checked against the retrieved set',
      });

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
      const identity = sourceIdentity(source);
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


/**
 * What makes two retrieved sources the same source.
 *
 * Keyed on the raw URL, this let one page be cited several times over: a crawl
 * holds `https://acme.com/about` and `https://acme.com/about/` as separate
 * pages, and both were retrieved, stored and numbered, so an answer about a
 * four-page site listed eight sources and the reader could not tell why [3]
 * and [4] were the same page.
 *
 * So the URL is normalised down to what actually identifies the document —
 * scheme, `www.`, a trailing slash, the fragment and tracking parameters all
 * dropped — while the source keeps its original URL for display and linking.
 * Query parameters that are not tracking are kept: `?product=mango-pulp` is a
 * different page, and collapsing it would lose a citation rather than a
 * duplicate.
 */
const TRACKING_PARAMS = /^(utm_|fbclid$|gclid$|msclkid$|mc_(c|e)id$|ref$|source$|igshid$)/i;

export function sourceIdentity(source: { url?: string | null; internalDocId?: string | null; title: string }): string {
  const raw = source.url ?? source.internalDocId;
  if (!raw) return `title:${source.title.trim().toLowerCase()}`;

  try {
    const parsed = new URL(raw);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.replace(/\/+$/, '') || '/';

    const params = [...parsed.searchParams.entries()]
      .filter(([key]) => !TRACKING_PARAMS.test(key))
      .sort(([a], [b]) => a.localeCompare(b));
    const query = params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '';

    return `${host}${path}${query}`.toLowerCase();
  } catch {
    // Not a URL — an internal document id, or a malformed href. Trim and
    // lowercase it so the same id in two cases is still one source.
    return raw.trim().toLowerCase().replace(/\/+$/, '');
  }
}


/**
 * Whether the question is about what changed rather than what is true.
 *
 * "What changed this week" against a general index returns the same evergreen
 * category pages every time, which is exactly how a run came back unable to
 * name a single recent development. These questions go to the news index with
 * a recency window instead.
 */
const RECENCY_TERMS =
  /\b(this (week|month|quarter)|last (week|month|quarter)|recent(ly)?|latest|new(est)?|changed?|changes|update[sd]?|news|trend(s|ing)?|announce(d|ment)s?|launch(ed|es)?|today|now)\b/i;

export function isRecencyQuestion(question: string): boolean {
  return RECENCY_TERMS.test(question);
}

export function parseJson(text: string): Record<string, unknown> {
  return parseModelJson<Record<string, unknown>>(text, 'Market research');
}
