import { Injectable, Logger } from '@nestjs/common';
import { AiProviderFactory } from './ai-provider.factory';
import {
  AiBusinessContext,
  formatStandardBusinessPrompt,
} from './interfaces/ai-business-context.interface';
import {
  MarketResearchResult,
  CompetitorAnalysisResult,
  SEOAnalysisResult,
  ContentStrategyResult,
  KeywordResearchResult,
  BusinessInsightsResult,
  SocialStrategyResult,
  MarketingStrategyResult,
} from './interfaces/ai-results.interface';

@Injectable()
export class UnifiedAiService {
  private readonly logger = new Logger(UnifiedAiService.name);

  constructor(private readonly providerFactory: AiProviderFactory) {}

  /**
   * 1. Generates in-depth Market Research including industry overview, pain points,
   * customer personas, market trends, SWOT, opportunities, pricing, and growth ideas.
   */
  async generateMarketResearch(context: AiBusinessContext): Promise<MarketResearchResult> {
    this.logger.log(`Generating Market Research for '${context.businessName}' (${context.industry})...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Perform an exhaustive Market Research analysis for this business.
You MUST provide the following in structured JSON:
1. industryOverview (deep, executive-level 2-3 paragraph summary of the current market state and macroeconomic drivers)
2. customerPainPoints (array of 5-8 urgent, visceral pain points the target audience faces)
3. customerPersonas (array of 2-3 detailed buyer personas, each with personaName, description, demographics, painPoints, motivations)
4. marketTrends (array of 4-6 key emerging industry trends, shifts in consumer behavior, or tech disruptions)
5. swotAnalysis (object with arrays for strengths, weaknesses, opportunities, threats)
6. businessOpportunities (array of 4-6 high-potential white-space opportunities or underserved niches)
7. pricingSuggestions (array of 3 distinct pricing/packaging models with strategy, details, targetSegment)
8. growthIdeas (array of 5-8 actionable, high-ROI growth loops and revenue acceleration ideas)`
    );

    const schema = {
      type: 'object',
      properties: {
        industryOverview: { type: 'string' },
        customerPainPoints: { type: 'array', items: { type: 'string' } },
        customerPersonas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              personaName: { type: 'string' },
              description: { type: 'string' },
              demographics: { type: 'string' },
              painPoints: { type: 'array', items: { type: 'string' } },
              motivations: { type: 'array', items: { type: 'string' } },
            },
            required: ['personaName', 'description', 'demographics', 'painPoints', 'motivations'],
          },
        },
        marketTrends: { type: 'array', items: { type: 'string' } },
        swotAnalysis: {
          type: 'object',
          properties: {
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            opportunities: { type: 'array', items: { type: 'string' } },
            threats: { type: 'array', items: { type: 'string' } },
          },
          required: ['strengths', 'weaknesses', 'opportunities', 'threats'],
        },
        businessOpportunities: { type: 'array', items: { type: 'string' } },
        pricingSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              strategy: { type: 'string' },
              details: { type: 'string' },
              targetSegment: { type: 'string' },
            },
            required: ['strategy', 'details', 'targetSegment'],
          },
        },
        growthIdeas: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'industryOverview',
        'customerPainPoints',
        'customerPersonas',
        'marketTrends',
        'swotAnalysis',
        'businessOpportunities',
        'pricingSuggestions',
        'growthIdeas',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<MarketResearchResult>(
      prompt,
      'You are a senior Market Research Director and Management Consultant.',
      schema,
    );
  }

  /**
   * 2. Generates thorough Competitor Analysis including summary, strengths,
   * weaknesses, content strategy, marketing strategy, social media, and positioning.
   */
  async generateCompetitorAnalysis(context: AiBusinessContext): Promise<CompetitorAnalysisResult> {
    this.logger.log(`Generating Competitor Analysis for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Perform a deep competitive intelligence audit comparing this business against its named competitors and market rivals.
You MUST provide the following in structured JSON:
1. competitorSummary (executive briefing on competitive landscape density, market concentration, and incumbent dominance)
2. strengths (array of competitor strengths and structural advantages)
3. weaknesses (array of key competitor vulnerabilities, complaints, or service gaps this business can exploit)
4. contentStrategyAnalysis (detailed breakdown of how competitors approach SEO, blogging, authority, and content velocity)
5. marketingStrategy (breakdown of competitor acquisition funnels, paid ads, partnerships, and brand awareness tactics)
6. socialMediaStrategy (breakdown of competitor social channel mix, engagement patterns, and viral formats)
7. positioningAnalysis (comparison of how competitors frame their value propositions vs. how this business should position itself)
8. actionableDifferentiators (array of 4-6 unique selling propositions (USPs) and defensible moat-building tactics)`
    );

    const schema = {
      type: 'object',
      properties: {
        competitorSummary: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        contentStrategyAnalysis: { type: 'string' },
        marketingStrategy: { type: 'string' },
        socialMediaStrategy: { type: 'string' },
        positioningAnalysis: { type: 'string' },
        actionableDifferentiators: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'competitorSummary',
        'strengths',
        'weaknesses',
        'contentStrategyAnalysis',
        'marketingStrategy',
        'socialMediaStrategy',
        'positioningAnalysis',
        'actionableDifferentiators',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<CompetitorAnalysisResult>(
      prompt,
      'You are a premier Competitive Intelligence & Strategy Lead.',
      schema,
    );
  }

  /**
   * 3. Generates complete SEO Intelligence including keyword suggestions,
   * clustering, blog topic ideas, meta titles, meta descriptions, FAQ, internal linking,
   * local SEO, and content gap analysis.
   */
  async generateSEOAnalysis(context: AiBusinessContext): Promise<SEOAnalysisResult> {
    this.logger.log(`Generating SEO Analysis for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Perform a comprehensive, technical and strategic SEO analysis for this business.
You MUST provide the following in structured JSON:
1. keywordSuggestions (array of 8-12 high-intent target keywords with intent, volumeEstimate, difficulty)
2. keywordClustering (array of 3-5 keyword clusters with clusterName, keywords array, and targetPageType)
3. blogTopicIdeas (array of 4-6 high-converting article/guide ideas with title, targetKeyword, outline array, searchIntent)
4. metaTitleGeneration (array of 3-5 optimized title tags for homepage, product pages, and service pages with pageType, title, charCount)
5. metaDescriptionGeneration (array of 3-5 compelling meta descriptions with pageType, description, charCount between 130-155 chars)
6. faqGeneration (array of 4-6 schema-ready high-search-intent questions and authoritative answers with schemaType)
7. internalLinkingSuggestions (array of 3-5 internal linking opportunities with sourceTopic, targetTopic, anchorText, rationale)
8. localSeoSuggestions (array of 3-5 actionable local search tactics, Google Business Profile optimizations, or local citation ideas with tactic, description, priority)
9. contentGapAnalysis (array of 3-5 missing content topics that competitors rank for but this site lacks, with recommendedAction)`
    );

    const schema = {
      type: 'object',
      properties: {
        keywordSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              intent: { type: 'string' },
              volumeEstimate: { type: 'string' },
              difficulty: { type: 'string' },
            },
            required: ['keyword', 'intent', 'volumeEstimate', 'difficulty'],
          },
        },
        keywordClustering: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clusterName: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
              targetPageType: { type: 'string' },
            },
            required: ['clusterName', 'keywords', 'targetPageType'],
          },
        },
        blogTopicIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              targetKeyword: { type: 'string' },
              outline: { type: 'array', items: { type: 'string' } },
              searchIntent: { type: 'string' },
            },
            required: ['title', 'targetKeyword', 'outline', 'searchIntent'],
          },
        },
        metaTitleGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pageType: { type: 'string' },
              title: { type: 'string' },
              charCount: { type: 'number' },
            },
            required: ['pageType', 'title', 'charCount'],
          },
        },
        metaDescriptionGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              pageType: { type: 'string' },
              description: { type: 'string' },
              charCount: { type: 'number' },
            },
            required: ['pageType', 'description', 'charCount'],
          },
        },
        faqGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              schemaType: { type: 'string' },
            },
            required: ['question', 'answer', 'schemaType'],
          },
        },
        internalLinkingSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              sourceTopic: { type: 'string' },
              targetTopic: { type: 'string' },
              anchorText: { type: 'string' },
              rationale: { type: 'string' },
            },
            required: ['sourceTopic', 'targetTopic', 'anchorText', 'rationale'],
          },
        },
        localSeoSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tactic: { type: 'string' },
              description: { type: 'string' },
              priority: { type: 'string' },
            },
            required: ['tactic', 'description', 'priority'],
          },
        },
        contentGapAnalysis: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              missingTopic: { type: 'string' },
              competitorFocus: { type: 'string' },
              recommendedAction: { type: 'string' },
            },
            required: ['missingTopic', 'competitorFocus', 'recommendedAction'],
          },
        },
      },
      required: [
        'keywordSuggestions',
        'keywordClustering',
        'blogTopicIdeas',
        'metaTitleGeneration',
        'metaDescriptionGeneration',
        'faqGeneration',
        'internalLinkingSuggestions',
        'localSeoSuggestions',
        'contentGapAnalysis',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<SEOAnalysisResult>(
      prompt,
      'You are a Staff Technical SEO & Organic Growth Architect.',
      schema,
    );
  }

  /**
   * 4. Generates omnichannel Content Strategy including monthly calendar, platform
   * playbooks (IG, FB, LinkedIn, YT), viral Reels/Shorts ideas, Carousels, Captions, CTAs, Hooks & Hashtags.
   */
  async generateContentStrategy(context: AiBusinessContext): Promise<ContentStrategyResult> {
    this.logger.log(`Generating Content Strategy for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Develop an end-to-end, high-converting Content Strategy and Editorial System for this business.
You MUST provide the following in structured JSON:
1. monthlyContentCalendar (array of 12-16 posts across 4 weeks with week, day, topic, format, channel, goal)
2. instagramStrategy (contentPillars, formatMix, postingFrequency)
3. facebookStrategy (contentPillars, communityTactics)
4. linkedinStrategy (thoughtLeadershipThemes, b2bTactics)
5. youtubeStrategy (videoSeriesIdeas, searchOptimizedThemes)
6. reelsIdeas (array of 4-6 viral short-form concepts with hook, visualConcept, cta)
7. shortsIdeas (array of 4-6 YouTube shorts with hook, scriptOutline, cta)
8. carouselIdeas (array of 3-4 multi-slide educational carousels with title, slides array, ctaSlide)
9. captionGeneration (array of 3-4 engaging captions with topic, captionText, tone)
10. ctaGeneration (array of 4-6 calls-to-action tailored by funnelStage, ctaText, targetAction)
11. hookGeneration (array of 6-10 scroll-stopping opening hooks categorized by angle)
12. hashtagSuggestions (array of 3-4 hashtag sets grouped by category with hashtags array)`
    );

    const schema = {
      type: 'object',
      properties: {
        monthlyContentCalendar: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              week: { type: 'number' },
              day: { type: 'string' },
              topic: { type: 'string' },
              format: { type: 'string' },
              channel: { type: 'string' },
              goal: { type: 'string' },
            },
            required: ['week', 'day', 'topic', 'format', 'channel', 'goal'],
          },
        },
        instagramStrategy: {
          type: 'object',
          properties: {
            contentPillars: { type: 'array', items: { type: 'string' } },
            formatMix: { type: 'array', items: { type: 'string' } },
            postingFrequency: { type: 'string' },
          },
          required: ['contentPillars', 'formatMix', 'postingFrequency'],
        },
        facebookStrategy: {
          type: 'object',
          properties: {
            contentPillars: { type: 'array', items: { type: 'string' } },
            communityTactics: { type: 'array', items: { type: 'string' } },
          },
          required: ['contentPillars', 'communityTactics'],
        },
        linkedinStrategy: {
          type: 'object',
          properties: {
            thoughtLeadershipThemes: { type: 'array', items: { type: 'string' } },
            b2bTactics: { type: 'array', items: { type: 'string' } },
          },
          required: ['thoughtLeadershipThemes', 'b2bTactics'],
        },
        youtubeStrategy: {
          type: 'object',
          properties: {
            videoSeriesIdeas: { type: 'array', items: { type: 'string' } },
            searchOptimizedThemes: { type: 'array', items: { type: 'string' } },
          },
          required: ['videoSeriesIdeas', 'searchOptimizedThemes'],
        },
        reelsIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hook: { type: 'string' },
              visualConcept: { type: 'string' },
              cta: { type: 'string' },
            },
            required: ['hook', 'visualConcept', 'cta'],
          },
        },
        shortsIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              hook: { type: 'string' },
              scriptOutline: { type: 'string' },
              cta: { type: 'string' },
            },
            required: ['hook', 'scriptOutline', 'cta'],
          },
        },
        carouselIdeas: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              title: { type: 'string' },
              slides: { type: 'array', items: { type: 'string' } },
              ctaSlide: { type: 'string' },
            },
            required: ['title', 'slides', 'ctaSlide'],
          },
        },
        captionGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              captionText: { type: 'string' },
              tone: { type: 'string' },
            },
            required: ['topic', 'captionText', 'tone'],
          },
        },
        ctaGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              funnelStage: { type: 'string' },
              ctaText: { type: 'string' },
              targetAction: { type: 'string' },
            },
            required: ['funnelStage', 'ctaText', 'targetAction'],
          },
        },
        hookGeneration: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              angle: { type: 'string' },
              hookLine: { type: 'string' },
            },
            required: ['angle', 'hookLine'],
          },
        },
        hashtagSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              hashtags: { type: 'array', items: { type: 'string' } },
            },
            required: ['category', 'hashtags'],
          },
        },
      },
      required: [
        'monthlyContentCalendar',
        'instagramStrategy',
        'facebookStrategy',
        'linkedinStrategy',
        'youtubeStrategy',
        'reelsIdeas',
        'shortsIdeas',
        'carouselIdeas',
        'captionGeneration',
        'ctaGeneration',
        'hookGeneration',
        'hashtagSuggestions',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<ContentStrategyResult>(
      prompt,
      'You are a Head of Content & Growth Media Strategist.',
      schema,
    );
  }

  /**
   * 5. Generates dedicated Keyword Research with intent, clustering, and local terminology.
   */
  async generateKeywordResearch(context: AiBusinessContext): Promise<KeywordResearchResult> {
    this.logger.log(`Generating Keyword Research for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Perform a laser-targeted Keyword Research study for this business.
You MUST provide the following in structured JSON:
1. primaryKeywords (array of 8-12 core commercial/transactional terms with keyword, searchIntent, estimatedVolume, estimatedDifficulty)
2. longTailKeywords (array of 10-15 low-competition, high-conversion long-tail queries)
3. keywordClusters (array of 4-6 thematic clusters with clusterName, keywords array, contentAngle)
4. localizedKeywords (array of region/city/country localized keywords for target geography)
5. searchIntentBreakdown (object containing arrays for informational, commercial, transactional, navigational queries)`
    );

    const schema = {
      type: 'object',
      properties: {
        primaryKeywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              keyword: { type: 'string' },
              searchIntent: { type: 'string' },
              estimatedVolume: { type: 'string' },
              estimatedDifficulty: { type: 'string' },
            },
            required: ['keyword', 'searchIntent', 'estimatedVolume', 'estimatedDifficulty'],
          },
        },
        longTailKeywords: { type: 'array', items: { type: 'string' } },
        keywordClusters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              clusterName: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
              contentAngle: { type: 'string' },
            },
            required: ['clusterName', 'keywords', 'contentAngle'],
          },
        },
        localizedKeywords: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              regionOrCity: { type: 'string' },
              keywords: { type: 'array', items: { type: 'string' } },
            },
            required: ['regionOrCity', 'keywords'],
          },
        },
        searchIntentBreakdown: {
          type: 'object',
          properties: {
            informational: { type: 'array', items: { type: 'string' } },
            commercial: { type: 'array', items: { type: 'string' } },
            transactional: { type: 'array', items: { type: 'string' } },
            navigational: { type: 'array', items: { type: 'string' } },
          },
          required: ['informational', 'commercial', 'transactional', 'navigational'],
        },
      },
      required: [
        'primaryKeywords',
        'longTailKeywords',
        'keywordClusters',
        'localizedKeywords',
        'searchIntentBreakdown',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<KeywordResearchResult>(
      prompt,
      'You are a Principal Search & Keyword Intelligence Specialist.',
      schema,
    );
  }

  /**
   * 6. Generates Business Insights including marketing recommendations, brand positioning,
   * audience segmentation, growth strategy, and sales suggestions.
   */
  async generateBusinessInsights(context: AiBusinessContext): Promise<BusinessInsightsResult> {
    this.logger.log(`Generating Business Insights for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Generate high-impact Business Intelligence & Growth Insights for executive leadership.
You MUST provide the following in structured JSON:
1. marketingRecommendations (array of 5-8 top strategic marketing decisions and experiments)
2. brandPositioning (object with currentPerception, desiredPositioning, and array of valueDifferentiators)
3. audienceSegmentation (array of 3-4 segments with segmentName, profile, messagingStrategy, primaryChannel)
4. growthStrategy (array of 3 phased initiatives: '30-Day Quick Wins', '90-Day Scale', '180-Day Dominance' with horizon, initiatives array, expectedKpiImpact)
5. salesSuggestions (array of 4-6 tactical sales enablement, objection handling, or funnel optimization ideas with tactic, rationale, targetStage)`
    );

    const schema = {
      type: 'object',
      properties: {
        marketingRecommendations: { type: 'array', items: { type: 'string' } },
        brandPositioning: {
          type: 'object',
          properties: {
            currentPerception: { type: 'string' },
            desiredPositioning: { type: 'string' },
            valueDifferentiators: { type: 'array', items: { type: 'string' } },
          },
          required: ['currentPerception', 'desiredPositioning', 'valueDifferentiators'],
        },
        audienceSegmentation: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              segmentName: { type: 'string' },
              profile: { type: 'string' },
              messagingStrategy: { type: 'string' },
              primaryChannel: { type: 'string' },
            },
            required: ['segmentName', 'profile', 'messagingStrategy', 'primaryChannel'],
          },
        },
        growthStrategy: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              horizon: { type: 'string' },
              initiatives: { type: 'array', items: { type: 'string' } },
              expectedKpiImpact: { type: 'string' },
            },
            required: ['horizon', 'initiatives', 'expectedKpiImpact'],
          },
        },
        salesSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              tactic: { type: 'string' },
              rationale: { type: 'string' },
              targetStage: { type: 'string' },
            },
            required: ['tactic', 'rationale', 'targetStage'],
          },
        },
      },
      required: [
        'marketingRecommendations',
        'brandPositioning',
        'audienceSegmentation',
        'growthStrategy',
        'salesSuggestions',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<BusinessInsightsResult>(
      prompt,
      'You are a Chief Strategy Officer and Growth Advisor.',
      schema,
    );
  }

  /**
   * 7. Generates dedicated Social Media Strategy across platforms.
   */
  async generateSocialStrategy(context: AiBusinessContext): Promise<SocialStrategyResult> {
    this.logger.log(`Generating Social Media Strategy for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Build a dedicated, high-converting Social Media Growth Strategy for this brand.
You MUST provide the following in structured JSON:
1. executiveSummary (clear vision for social presence and brand voice)
2. platformStrategies (array of platform plans for Instagram, LinkedIn, YouTube, TikTok/X with platform, objective, contentFormats array, weeklyFrequency, bestTimesToPost)
3. reelsAndShorts (array of 4-6 viral short-form concepts with concept, hook, audioVibe, cta)
4. carousels (array of 3-4 educational slide-deck blueprints with topic, slideOutlines array, engagementTrigger)
5. highConvertingHooks (array of 8-12 top-performing hook lines)
6. hashtagVault (array of 3-4 hashtag banks grouped by niche with tags array)
7. callToActionBank (array of 3-4 CTA groups categorized by goal with phrases array)`
    );

    const schema = {
      type: 'object',
      properties: {
        executiveSummary: { type: 'string' },
        platformStrategies: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              platform: { type: 'string' },
              objective: { type: 'string' },
              contentFormats: { type: 'array', items: { type: 'string' } },
              weeklyFrequency: { type: 'string' },
              bestTimesToPost: { type: 'string' },
            },
            required: ['platform', 'objective', 'contentFormats', 'weeklyFrequency', 'bestTimesToPost'],
          },
        },
        reelsAndShorts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              concept: { type: 'string' },
              hook: { type: 'string' },
              audioVibe: { type: 'string' },
              cta: { type: 'string' },
            },
            required: ['concept', 'hook', 'audioVibe', 'cta'],
          },
        },
        carousels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              slideOutlines: { type: 'array', items: { type: 'string' } },
              engagementTrigger: { type: 'string' },
            },
            required: ['topic', 'slideOutlines', 'engagementTrigger'],
          },
        },
        highConvertingHooks: { type: 'array', items: { type: 'string' } },
        hashtagVault: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              niche: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
            },
            required: ['niche', 'tags'],
          },
        },
        callToActionBank: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              goal: { type: 'string' },
              phrases: { type: 'array', items: { type: 'string' } },
            },
            required: ['goal', 'phrases'],
          },
        },
      },
      required: [
        'executiveSummary',
        'platformStrategies',
        'reelsAndShorts',
        'carousels',
        'highConvertingHooks',
        'hashtagVault',
        'callToActionBank',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<SocialStrategyResult>(
      prompt,
      'You are a Viral Social Media Strategist & Brand Architect.',
      schema,
    );
  }

  /**
   * 8. Generates overall Marketing & Go-To-Market Strategy.
   */
  async generateMarketingStrategy(context: AiBusinessContext): Promise<MarketingStrategyResult> {
    this.logger.log(`Generating Marketing Strategy for '${context.businessName}'...`);

    const prompt = formatStandardBusinessPrompt(
      context,
      `Craft an overarching Marketing & Go-To-Market Strategy for this business.
You MUST provide the following in structured JSON:
1. executiveSummary (comprehensive marketing vision and core strategy)
2. brandPositioningStatement (single powerful positioning statement defining who, what, why, and differentiation)
3. targetPersonas (array of target customer persona summaries)
4. acquisitionChannels (array of 4-6 channels with channel, strategy, priority, budgetShareEstimate)
5. conversionTactics (array of funnel optimizations across Top, Middle, and Bottom of funnel with funnelStage, tactics array, keyMetrics)
6. growthRoadmap (array of 3-4 execution milestones with phase, duration, milestones array)
7. budgetSuggestions (array of 4-6 budget allocations with category, percentage, rationale)`
    );

    const schema = {
      type: 'object',
      properties: {
        executiveSummary: { type: 'string' },
        brandPositioningStatement: { type: 'string' },
        targetPersonas: { type: 'array', items: { type: 'string' } },
        acquisitionChannels: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              channel: { type: 'string' },
              strategy: { type: 'string' },
              priority: { type: 'string' },
              budgetShareEstimate: { type: 'string' },
            },
            required: ['channel', 'strategy', 'priority', 'budgetShareEstimate'],
          },
        },
        conversionTactics: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              funnelStage: { type: 'string' },
              tactics: { type: 'array', items: { type: 'string' } },
              keyMetrics: { type: 'string' },
            },
            required: ['funnelStage', 'tactics', 'keyMetrics'],
          },
        },
        growthRoadmap: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string' },
              duration: { type: 'string' },
              milestones: { type: 'array', items: { type: 'string' } },
            },
            required: ['phase', 'duration', 'milestones'],
          },
        },
        budgetSuggestions: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              category: { type: 'string' },
              percentage: { type: 'number' },
              rationale: { type: 'string' },
            },
            required: ['category', 'percentage', 'rationale'],
          },
        },
      },
      required: [
        'executiveSummary',
        'brandPositioningStatement',
        'targetPersonas',
        'acquisitionChannels',
        'conversionTactics',
        'growthRoadmap',
        'budgetSuggestions',
      ],
    };

    const provider = this.providerFactory.getProvider();
    return provider.generateStructuredJson<MarketingStrategyResult>(
      prompt,
      'You are a Global Chief Marketing Officer (CMO) and Go-To-Market Architect.',
      schema,
    );
  }
}
