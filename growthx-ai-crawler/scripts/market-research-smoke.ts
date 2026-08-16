/**
 * Live smoke test for GrowthX Market Research.
 *
 * Unit tests mock the model router, so they prove the pipeline logic but say
 * nothing about whether the provider integration actually works. This makes
 * real calls and checks the things only reality can answer: do the configured
 * models exist, does the Responses API accept our request shape, does
 * structured output come back parseable, and does hosted web search return
 * citations we can attach to claims.
 *
 * Run:  npx ts-node scripts/market-research-smoke.ts
 * Costs a few cents. Reports PASS/FAIL/SKIP per check and exits non-zero on failure.
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { ModelRole, ModelRouterService } from '../src/modules/market-research/model-router.service';

type Status = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; status: Status; detail: string }[] = [];

function record(name: string, status: Status, detail: string) {
  results.push({ name, status, detail });
  const icon = status === 'PASS' ? '✓' : status === 'SKIP' ? '–' : '✗';
  console.log(`${icon} ${name}\n    ${detail}\n`);
}

async function main() {
  const config = new ConfigService();
  const router = new ModelRouterService(config);

  const provider = router.provider();
  console.log(`\nMarket Research smoke test — provider: ${provider}\n${'─'.repeat(60)}\n`);

  if (!router.isConfigured()) {
    record('configuration', 'FAIL', `No usable API key for provider "${provider}".`);
    return finish();
  }
  record(
    'configuration',
    'PASS',
    `${provider} key present. analyst=${router.modelFor(ModelRole.ANALYST)}, ` +
      `worker=${router.modelFor(ModelRole.WORKER)}, deep=${router.modelFor(ModelRole.DEEP)}`,
  );

  // 1. Worker model + structured output. This is the classify step, and the
  //    cheapest way to prove the model id resolves and json_schema is honoured.
  try {
    const result = await router.generate({
      step: 'smoke-classify',
      role: ModelRole.WORKER,
      instructions: 'Return only JSON matching the schema.',
      input: 'Classify this question: what changed in the electric vehicle market this week?',
      jsonSchema: {
        name: 'classification',
        schema: {
          type: 'object',
          properties: {
            intent: { type: 'string' },
            searchQueries: { type: 'array', items: { type: 'string' } },
          },
          required: ['intent', 'searchQueries'],
          additionalProperties: false,
        },
      },
      maxOutputTokens: 2000,
    });

    const parsed = JSON.parse(result.text);
    if (!parsed.intent || !Array.isArray(parsed.searchQueries)) {
      throw new Error(`schema not honoured: ${result.text.slice(0, 200)}`);
    }
    record(
      'worker model + structured output',
      'PASS',
      `${result.usage.model} returned valid JSON (${result.usage.inputTokens} in / ${result.usage.outputTokens} out` +
        `${result.usage.costUsd != null ? `, $${result.usage.costUsd}` : ''}). intent="${parsed.intent}"`,
    );
  } catch (error) {
    record('worker model + structured output', 'FAIL', String(error).slice(0, 400));
  }

  // 2. Analyst model. Used for synthesis and the cited answer.
  try {
    const result = await router.generate({
      step: 'smoke-analyst',
      role: ModelRole.ANALYST,
      instructions: 'Answer in one short sentence.',
      input: 'What does SEO stand for?',
      maxOutputTokens: 2000,
    });
    if (!result.text.trim()) throw new Error('empty response');
    record(
      'analyst model',
      'PASS',
      `${result.usage.model} responded: "${result.text.slice(0, 100).replace(/\n/g, ' ')}"`,
    );
  } catch (error) {
    record('analyst model', 'FAIL', String(error).slice(0, 400));
  }

  // 3. Hosted web search. The citation guarantee depends entirely on this
  //    returning url_citation annotations we can attach claims to.
  try {
    const result = await router.generate({
      step: 'smoke-web',
      role: ModelRole.ANALYST,
      instructions: 'Research using web search and cite what you find.',
      input: 'What is one notable SEO industry change in 2026? Cite sources.',
      webSearch: true,
      maxOutputTokens: 3000,
    });

    if (result.webSearchUnavailable) {
      record('web search citations', 'SKIP', result.webSearchUnavailable);
    } else if (result.webSources.length === 0) {
      record(
        'web search citations',
        'FAIL',
        'Web search ran but returned no url_citation annotations, so no public source would be citable.',
      );
    } else {
      record(
        'web search citations',
        'PASS',
        `${result.webSources.length} citable source(s). First: ${result.webSources[0].url}`,
      );
    }
  } catch (error) {
    record('web search citations', 'FAIL', String(error).slice(0, 400));
  }

  // 4. Embeddings, which drive semantic retrieval over client pages.
  if (!router.supportsEmbeddings()) {
    record(
      'embeddings',
      'SKIP',
      'No embedding model reachable on this provider. Retrieval falls back to lexical matching.',
    );
  } else {
    try {
      const { vectors, model } = await router.embed(['winter jackets for hiking']);
      if (!vectors[0]?.length) throw new Error('no vector returned');
      record('embeddings', 'PASS', `${model} returned a ${vectors[0].length}-dimension vector.`);
    } catch (error) {
      record('embeddings', 'FAIL', String(error).slice(0, 400));
    }
  }

  finish();
}

function finish() {
  const failed = results.filter((r) => r.status === 'FAIL');
  const skipped = results.filter((r) => r.status === 'SKIP');
  console.log('─'.repeat(60));
  console.log(
    `${results.filter((r) => r.status === 'PASS').length} passed, ${failed.length} failed, ${skipped.length} skipped`,
  );
  if (skipped.length) {
    console.log('\nSkipped checks are capability gaps, not bugs — the pipeline degrades around them.');
  }
  process.exit(failed.length > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exit(1);
});
