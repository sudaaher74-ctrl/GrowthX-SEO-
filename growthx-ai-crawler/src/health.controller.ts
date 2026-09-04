import { Controller, Get, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { AiTask, MultiAiRouterService } from './modules/ai-search/multi-ai-router/multi-ai-router.service';

/**
 * When this process started. A redeploy resets it, which — together with the
 * commit below — is what makes "did my push actually go out?" answerable from
 * outside instead of inferred from response latency.
 */
const STARTED_AT = new Date().toISOString();

/** The build serving this process. Render injects these; other hosts vary. */
function buildInfo() {
  return {
    commit: process.env.RENDER_GIT_COMMIT ?? process.env.GIT_COMMIT ?? 'unknown',
    branch: process.env.RENDER_GIT_BRANCH ?? process.env.GIT_BRANCH ?? 'unknown',
    startedAt: STARTED_AT,
  };
}

interface Capability {
  name: string;
  configured: boolean;
  /** What the customer does not get while this is unconfigured. */
  consequence: string;
  envVar: string;
}

function realKey(value?: string): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  return trimmed.length > 20 && !/^(your_|add-your-|changeme)/i.test(trimmed);
}

@Controller('health')
export class HealthController implements OnApplicationBootstrap {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly router: MultiAiRouterService) {}

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'growthx-crawler-api',
      ...buildInfo(),
    };
  }

  /**
   * Which optional integrations are live, and what is missing without them.
   *
   * Now that nothing is simulated, an unconfigured integration shows up as an
   * empty section in the product rather than plausible numbers. That is the
   * correct behaviour but it is indistinguishable from a bug at a glance, so
   * this endpoint says plainly which gaps are configuration.
   */
  @Get('capabilities')
  capabilities() {
    const list = this.capabilityList();
    return {
      ...buildInfo(),
      configured: list.filter((c) => c.configured).map((c) => c.name),
      missing: list
        .filter((c) => !c.configured)
        .map(({ name, envVar, consequence }) => ({ name, envVar, consequence })),
      ai: this.aiStatus(),
    };
  }

  /**
   * Which vendors the generated features can actually reach.
   *
   * Every AI feature — content strategy, gap analysis, pattern detection —
   * routes through one chain, and an empty chain fails all of them the same
   * silent way. Reported straight from the router so it cannot drift from what
   * a real call would do. Provider and model names only; no key material.
   */
  private aiStatus() {
    const reasoning = this.router.chainFor(AiTask.REASONING);
    return {
      configured: this.router.configuredProviders(),
      models: this.router.configuredModels(),
      reasoningChain: reasoning,
      canGenerate: reasoning.length > 0,
    };
  }

  /** Logs the gaps once at boot so they are visible in a deploy log. */
  onApplicationBootstrap(): void {
    const missing = this.capabilityList().filter((c) => !c.configured);
    if (missing.length === 0) {
      this.logger.log('All optional integrations are configured.');
      return;
    }
    this.logger.warn(
      `${missing.length} optional integration(s) unconfigured — the matching sections will be empty, not estimated:\n` +
        missing.map((c) => `  - ${c.envVar}: ${c.consequence}`).join('\n'),
    );
  }

  private capabilityList(): Capability[] {
    const groq = realKey(process.env.GROQ_API_KEY);
    const openrouter = realKey(process.env.OPENROUTER_API_KEY);
    const openai = realKey(process.env.OPENAI_API_KEY);

    // The *effective* provider, resolved the same way ModelRouterService does.
    // Reading MARKET_RESEARCH_PROVIDER alone is wrong: left unset it
    // auto-detects, and reporting on the unset value claimed web search was
    // available on a deployment that had auto-selected Groq, which has none.
    const configured = (process.env.MARKET_RESEARCH_PROVIDER || '').toLowerCase();
    const marketProvider =
      configured === 'openai' || configured === 'openrouter' || configured === 'groq'
        ? configured
        : groq
          ? 'groq'
          : openrouter
            ? 'openrouter'
            : 'openai';

    return [
      {
        name: 'PageSpeed Insights (private quota)',
        envVar: 'PAGESPEED_API_KEY',
        configured: realKey(process.env.PAGESPEED_API_KEY),
        // Measurement still runs unkeyed — the API accepts it — but shares one
        // daily pool with every anonymous caller, so it frequently 429s.
        consequence:
          'Core Web Vitals are still measured, but on a shared public quota that is often exhausted, ' +
          'so many pages will have no scores. A free key gives a private quota: ' +
          'https://developers.google.com/speed/docs/insights/v5/get-started',
      },
      {
        name: 'Market research models',
        envVar: 'GROQ_API_KEY / OPENROUTER_API_KEY / OPENAI_API_KEY',
        configured: groq || openrouter || openai,
        consequence: 'Market Research cannot run at all without one of these.',
      },
      {
        name: 'Live web search (Tavily)',
        envVar: 'TAVILY_API_KEY',
        // This entry used to check OPENROUTER_API_KEY / OPENAI_API_KEY, from
        // when search meant a model's hosted web plugin. `WebSearchService`
        // has read TAVILY_API_KEY since it was introduced, so the report was
        // answering about a key the searching code does not consult — and it
        // now gates two more features than it did then.
        configured: realKey(process.env.TAVILY_API_KEY),
        consequence:
          'Three things degrade without it. Competitors are found from model recall and the curated list ' +
          'only, so a client outside the curated industries may get few or none. The keyword gap matrix ' +
          'cannot see who ranks for a term, so every competitor column reads "not measured". And Market ' +
          "Research answers from the client's own data with no public sources cited.",
      },
      {
        name: 'Model-hosted web search',
        envVar: 'OPENROUTER_API_KEY (with credit) or OPENAI_API_KEY',
        // Groq has no hosted search, and OpenRouter bills the web plugin.
        configured: openai || (openrouter && marketProvider !== 'groq'),
        consequence:
          'A second search path Market Research can fall back on. Not required when Tavily is configured.',
      },
      {
        name: 'Recurring competitor crawls',
        envVar: 'COMPETITOR_CRON_ENABLED',
        // A kill switch is invisible once flipped: the jobs log one line and
        // return, and every tab fed by them simply stays empty.
        configured: process.env.COMPETITOR_CRON_ENABLED !== 'false',
        consequence:
          'The daily competitor recrawl and change-detection sweeps are switched off, so competitor pages ' +
          'and content are never refreshed and the tabs reading them stay empty. Unset this variable, or ' +
          'set it to anything but "false", to re-enable them.',
      },
      {
        name: 'Semantic retrieval (embeddings)',
        envVar: 'OPENAI_API_KEY',
        configured: openai,
        consequence:
          'Client pages are ranked with BM25 keyword search rather than by meaning. Good for ' +
          'matching wording, weaker for synonyms and paraphrases.',
      },
      {
        name: 'Local business lookup (Google Places)',
        envVar: 'GOOGLE_PLACES_API_KEY',
        configured: realKey(process.env.GOOGLE_PLACES_API_KEY),
        // Until this was reported, an unset key was invisible: the search
        // returned two invented businesses rather than an error, so the gap
        // looked like working software.
        consequence:
          'Business search and Google Business Profile lookups are unavailable, and return an explicit ' +
          'error rather than results. Local rankings, ratings and review counts cannot be measured, and ' +
          'a competitor cannot be matched to a local profile.',
      },
      {
        name: 'Google Business Profile reviews',
        envVar: 'Google Business Profile connection (OAuth)',
        // No integration exists yet; naming it keeps the absence visible rather
        // than leaving review sync looking merely broken.
        configured: false,
        consequence:
          'Reviews cannot be imported, so review themes, rating trends and AI reply drafting have nothing ' +
          'to work from. Review sync refuses rather than inventing reviews to fill the gap.',
      },
      {
        name: 'Competitor content ingestion (YouTube)',
        envVar: 'YOUTUBE_API_KEY',
        configured: realKey(process.env.YOUTUBE_API_KEY),
        // Instagram and Facebook have no automated ingestion at all; manual
        // entry is the only path there, and it feeds the same pipeline.
        consequence:
          'Content Intelligence cannot pull competitor posts automatically. Competitor content must ' +
          'be added by hand before classification, pattern detection, gap analysis and strategy can run.',
      },
      {
        name: 'Billing (Razorpay)',
        envVar: 'RAZORPAY_KEY_ID',
        configured: realKey(process.env.RAZORPAY_KEY_ID),
        consequence: 'Customers cannot self-serve a plan; provision with scripts/provision-subscription.ts.',
      },
    ];
  }
}
