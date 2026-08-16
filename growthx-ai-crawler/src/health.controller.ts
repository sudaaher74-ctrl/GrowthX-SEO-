import { Controller, Get, Logger, OnApplicationBootstrap } from '@nestjs/common';

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

  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'growthx-crawler-api',
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
      configured: list.filter((c) => c.configured).map((c) => c.name),
      missing: list
        .filter((c) => !c.configured)
        .map(({ name, envVar, consequence }) => ({ name, envVar, consequence })),
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
        name: 'Live web search',
        envVar: 'OPENROUTER_API_KEY (with credit) or OPENAI_API_KEY',
        // Groq has no hosted search, and OpenRouter bills the web plugin.
        configured: openai || (openrouter && marketProvider !== 'groq'),
        consequence:
          'Market Research answers from the client\'s own crawl, prompts and visibility data only; ' +
          'no public web sources are cited.',
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
        name: 'Billing (Razorpay)',
        envVar: 'RAZORPAY_KEY_ID',
        configured: realKey(process.env.RAZORPAY_KEY_ID),
        consequence: 'Customers cannot self-serve a plan; provision with scripts/provision-subscription.ts.',
      },
    ];
  }
}
