import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnifiedAiService } from './unified-ai.service';
import { AiProviderFactory } from './ai-provider.factory';
import { SarvamProvider } from './providers/sarvam.provider';
import { GeminiProvider } from './providers/gemini.provider';
import { OpenAiProvider } from './providers/openai.provider';
import { ClaudeProvider } from './providers/claude.provider';
import { AiBusinessContext } from './interfaces/ai-business-context.interface';

describe('UnifiedAiService', () => {
  let service: UnifiedAiService;
  let mockSarvamProvider: Partial<SarvamProvider>;
  let providerFactory: AiProviderFactory;

  const mockBusinessContext: AiBusinessContext = {
    businessName: 'GrowthX SEO',
    industry: 'Marketing Technology / SEO SaaS',
    country: 'India',
    targetAudience: 'Growth Marketers and Founders',
    competitors: ['Ahrefs', 'Semrush'],
    businessGoals: ['Increase organic traffic by 100%', 'Generate 500 product demo leads'],
    currentWebsite: 'https://growthx.ai',
    currentSocialMedia: { linkedin: 'https://linkedin.com/company/growthx' },
    currentSeoData: { domainAuthority: 48, monthlyVisitors: 35000 },
  };

  beforeEach(async () => {
    mockSarvamProvider = {
      name: 'SARVAM',
      isAvailable: jest.fn().mockReturnValue(true),
      generateStructuredJson: jest.fn(),
      generateText: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnifiedAiService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'SARVAM_API_KEY') return 'sk_test_sarvam_key';
              if (key === 'AI_PROVIDER') return 'sarvam';
              return null;
            }),
          },
        },
        { provide: SarvamProvider, useValue: mockSarvamProvider },
        { provide: GeminiProvider, useValue: { name: 'GEMINI', isAvailable: jest.fn().mockReturnValue(false) } },
        { provide: OpenAiProvider, useValue: { name: 'OPENAI', isAvailable: jest.fn().mockReturnValue(false) } },
        { provide: ClaudeProvider, useValue: { name: 'CLAUDE', isAvailable: jest.fn().mockReturnValue(false) } },
        AiProviderFactory,
      ],
    }).compile();

    service = module.get<UnifiedAiService>(UnifiedAiService);
    providerFactory = module.get<AiProviderFactory>(AiProviderFactory);
  });

  it('should be defined and resolve Sarvam as the active provider', () => {
    expect(service).toBeDefined();
    const activeProvider = providerFactory.getProvider();
    expect(activeProvider.name).toBe('SARVAM');
  });

  it('1. generateMarketResearch() should call provider with structured schema', async () => {
    const mockOutput = {
      industryOverview: 'Booming SaaS market with increasing AI automation demand.',
      customerPainPoints: ['High CAC', 'Slow SEO turnaround'],
      customerPersonas: [
        {
          personaName: 'Growth Gary',
          description: 'Head of Growth',
          demographics: '30-40, Metro tech hubs',
          painPoints: ['Manual keyword tracking'],
          motivations: ['Fast ROI'],
        },
      ],
      marketTrends: ['AI-driven content generation', 'GEO / AEO optimization'],
      swotAnalysis: {
        strengths: ['Real-time crawling'],
        weaknesses: ['New brand'],
        opportunities: ['Regional language SEO'],
        threats: ['Legacy tools'],
      },
      businessOpportunities: ['Indic language SEO automation'],
      pricingSuggestions: [{ strategy: 'Value-based', details: '$99/mo', targetSegment: 'Mid-market' }],
      growthIdeas: ['Product-led growth viral loops'],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateMarketResearch(mockBusinessContext);
    expect(result).toEqual(mockOutput);
    expect(mockSarvamProvider.generateStructuredJson).toHaveBeenCalled();
  });

  it('2. generateCompetitorAnalysis() should return comprehensive competitor teardown', async () => {
    const mockOutput = {
      competitorSummary: 'Ahrefs and Semrush dominate enterprise search market.',
      strengths: ['Massive backlink databases'],
      weaknesses: ['Complex UI', 'High pricing'],
      contentStrategyAnalysis: 'Competitors publish long-form technical tear-downs.',
      marketingStrategy: 'Heavy conference sponsorships and programmatic SEO.',
      socialMediaStrategy: 'Active on YouTube and LinkedIn with educational snippets.',
      positioningAnalysis: 'Position GrowthX as the autonomous AI-first solution.',
      actionableDifferentiators: ['One-click autonomous fixes', 'Deep AEO citation audits'],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateCompetitorAnalysis(mockBusinessContext);
    expect(result).toEqual(mockOutput);
    expect(result.actionableDifferentiators).toContain('One-click autonomous fixes');
  });

  it('3. generateSEOAnalysis() should return full SEO intelligence & content gaps', async () => {
    const mockOutput = {
      keywordSuggestions: [{ keyword: 'ai seo automation', intent: 'commercial', volumeEstimate: '5400', difficulty: 'medium' }],
      keywordClustering: [{ clusterName: 'AI Crawlers', keywords: ['ai seo bot', 'automated crawler'], targetPageType: 'feature-page' }],
      blogTopicIdeas: [{ title: 'How AI Changes SEO in 2026', targetKeyword: 'ai seo 2026', outline: ['Intro', 'Core Changes'], searchIntent: 'informational' }],
      metaTitleGeneration: [{ pageType: 'homepage', title: 'GrowthX - Autonomous AI SEO Platform', charCount: 42 }],
      metaDescriptionGeneration: [{ pageType: 'homepage', description: 'Scale organic traffic 10x with autonomous AI SEO crawling and real-time fixes.', charCount: 82 }],
      faqGeneration: [{ question: 'What is AI SEO?', answer: 'Automated search optimization using LLMs and bots.', schemaType: 'FAQPage' }],
      internalLinkingSuggestions: [{ sourceTopic: 'Crawler', targetTopic: 'Auto-Fix', anchorText: 'fix issues automatically', rationale: 'Boost conversion' }],
      localSeoSuggestions: [{ tactic: 'Google Business Profile', description: 'Optimize categories', priority: 'high' }],
      contentGapAnalysis: [{ missingTopic: 'Programmatic SEO Guide', competitorFocus: 'Ahrefs', recommendedAction: 'Publish pillar page' }],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateSEOAnalysis(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });

  it('4. generateContentStrategy() should return monthly calendar and social tactics', async () => {
    const mockOutput = {
      monthlyContentCalendar: [{ week: 1, day: 'Monday', topic: 'SEO Myths', format: 'Reel', channel: 'Instagram', goal: 'Awareness' }],
      instagramStrategy: { contentPillars: ['Tips', 'Behind-the-scenes'], formatMix: ['Reels 60%', 'Carousels 40%'], postingFrequency: '5x/week' },
      facebookStrategy: { contentPillars: ['Community'], communityTactics: ['Q&A Friday'] },
      linkedinStrategy: { thoughtLeadershipThemes: ['Future of AI search'], b2bTactics: ['Founder stories'] },
      youtubeStrategy: { videoSeriesIdeas: ['SEO Teardowns'], searchOptimizedThemes: ['How-to tutorials'] },
      reelsIdeas: [{ hook: 'Stop doing SEO the 2020 way', visualConcept: 'Split screen comparison', cta: 'Comment SEO' }],
      shortsIdeas: [{ hook: '3 SEO mistakes killing your site', scriptOutline: 'Point 1, 2, 3', cta: 'Subscribe' }],
      carouselIdeas: [{ title: 'The Ultimate AEO Checklist', slides: ['Intro', 'Step 1', 'Step 2'], ctaSlide: 'Save this post' }],
      captionGeneration: [{ topic: 'AEO Guide', captionText: 'Here is how to win Google AI overviews...', tone: 'Authoritative' }],
      ctaGeneration: [{ funnelStage: 'TOFU', ctaText: 'Download the free audit checklist', targetAction: 'Lead capture' }],
      hookGeneration: [{ angle: 'Contrarian', hookLine: 'Backlinks are no longer #1' }],
      hashtagSuggestions: [{ category: 'SEO', hashtags: ['#SEO', '#AISearch', '#GrowthHacking'] }],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateContentStrategy(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });

  it('5. generateKeywordResearch() should return primary, long-tail, and localized keywords', async () => {
    const mockOutput = {
      primaryKeywords: [{ keyword: 'ai seo software', searchIntent: 'transactional', estimatedVolume: '3200', estimatedDifficulty: 'hard' }],
      longTailKeywords: ['best ai seo software for startups in india'],
      keywordClusters: [{ clusterName: 'Core AI', keywords: ['ai seo tool', 'seo ai assistant'], contentAngle: 'Software comparison' }],
      localizedKeywords: [{ regionOrCity: 'India', keywords: ['seo services bangalore', 'ai seo mumbai'] }],
      searchIntentBreakdown: {
        informational: ['what is ai seo'],
        commercial: ['best ai seo tools'],
        transactional: ['buy ai seo tool'],
        navigational: ['growthx login'],
      },
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateKeywordResearch(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });

  it('6. generateBusinessInsights() should return marketing, brand, and growth insights', async () => {
    const mockOutput = {
      marketingRecommendations: ['Double down on bottom-of-funnel comparison pages'],
      brandPositioning: {
        currentPerception: 'New entrant',
        desiredPositioning: 'The gold standard for autonomous SEO',
        valueDifferentiators: ['Instant code generation', 'Sub-second crawler'],
      },
      audienceSegmentation: [{ segmentName: 'Tech Founders', profile: 'Early stage', messagingStrategy: 'Save time', primaryChannel: 'LinkedIn' }],
      growthStrategy: [{ horizon: '30-Day Quick Wins', initiatives: ['Launch free audit tool'], expectedKpiImpact: '+50% signups' }],
      salesSuggestions: [{ tactic: 'Interactive live demo', rationale: 'Show instant issue detection', targetStage: 'Discovery' }],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateBusinessInsights(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });

  it('7. generateSocialStrategy() should return cross-platform strategy', async () => {
    const mockOutput = {
      executiveSummary: 'Build founder-led authority across LinkedIn and high-energy video on Instagram.',
      platformStrategies: [{ platform: 'LinkedIn', objective: 'B2B Pipeline', contentFormats: ['Text+Image', 'Carousels'], weeklyFrequency: '4x', bestTimesToPost: '8:00 AM IST' }],
      reelsAndShorts: [{ concept: 'Fixing a broken website in 60s', hook: 'Watch this site get fixed live', audioVibe: 'Energetic tech beat', cta: 'Link in bio' }],
      carousels: [{ topic: '5 Hidden SEO Traps', slideOutlines: ['Cover', 'Trap 1', 'Trap 2', 'Trap 3', 'Summary'], engagementTrigger: 'Save for later' }],
      highConvertingHooks: ['Why 90% of SEO agencies hate AI tools'],
      hashtagVault: [{ niche: 'Growth Marketing', tags: ['#growthmarketing', '#digitalmarketing'] }],
      callToActionBank: [{ goal: 'Demo Booking', phrases: ['Book your free 15-min site audit today'] }],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateSocialStrategy(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });

  it('8. generateMarketingStrategy() should return GTM and acquisition plan', async () => {
    const mockOutput = {
      executiveSummary: 'Dominate organic search and developer mindshare via high-velocity AI audits.',
      brandPositioningStatement: 'For growth teams who want effortless top-ranking SEO without manual audits.',
      targetPersonas: ['Founders', 'VPs of Growth', 'Marketing Leads'],
      acquisitionChannels: [{ channel: 'Organic SEO', strategy: 'Programmatic comparison pages', priority: 'P0', budgetShareEstimate: '40%' }],
      conversionTactics: [{ funnelStage: 'Bottom of Funnel', tactics: ['Free instant site audit widget'], keyMetrics: 'Free-to-paid conversion rate' }],
      growthRoadmap: [{ phase: 'Phase 1: Foundation', duration: 'Month 1', milestones: ['Launch 20 core pages', 'Index top 50 keywords'] }],
      budgetSuggestions: [{ category: 'Content Production', percentage: 35, rationale: 'Create high-authority pillar articles' }],
    };

    (mockSarvamProvider.generateStructuredJson as jest.Mock).mockResolvedValue(mockOutput);

    const result = await service.generateMarketingStrategy(mockBusinessContext);
    expect(result).toEqual(mockOutput);
  });
});
