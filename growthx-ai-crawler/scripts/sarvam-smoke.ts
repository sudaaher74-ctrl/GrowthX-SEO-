/**
 * Live smoke test for the Sarvam integration.
 *
 * Unit tests mock the transport, so they prove the request shaping but say
 * nothing about whether a real key produces real output. This makes real calls
 * and answers the question the dashboard cannot: tokens were billed, so did an
 * answer actually come back?
 *
 * It exists because of a specific failure mode. Sarvam-105B reasons before it
 * answers, reasoning tokens are charged against the same `max_tokens` budget as
 * the answer, and a budget sized for the answer alone gets spent entirely on
 * thinking — the call succeeds, the tokens are billed, and `content` comes back
 * empty. Nothing about that looks like an error from the outside. Check 3 below
 * reproduces it deliberately so the difference is visible.
 *
 * Run:  npx ts-node scripts/sarvam-smoke.ts
 * Costs a few paise. Reports PASS/FAIL/SKIP per check and exits non-zero on failure.
 */
import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import {
  SARVAM_CHAT_COMPLETIONS_URL,
  buildSarvamBody,
  clampSarvamMaxTokens,
  describeEmptySarvamResponse,
  readSarvamMessage,
  resolveSarvamMaxOutputTokens,
  resolveSarvamModel,
  resolveSarvamReasoningEffort,
} from '../src/modules/ai-engine/utils/sarvam-request.util';
import { extractAndParseJson } from '../src/modules/ai-engine/utils/json-extractor.util';

type Status = 'PASS' | 'FAIL' | 'SKIP';
const results: { name: string; status: Status; detail: string }[] = [];

function record(name: string, status: Status, detail: string) {
  results.push({ name, status, detail });
  const mark = status === 'PASS' ? '✓' : status === 'SKIP' ? '–' : '✗';
  console.log(`${mark} ${name}\n    ${detail}\n`);
}

const config = new ConfigService();

async function callSarvam(body: Record<string, unknown>) {
  const apiKey = process.env.SARVAM_API_KEY!.trim();
  const response = await fetch(SARVAM_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-subscription-key': apiKey,
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${(await response.text().catch(() => '')).slice(0, 400)}`);
  }

  return readSarvamMessage(await response.json());
}

async function main() {
  console.log('\nSarvam integration smoke test\n' + '='.repeat(60) + '\n');

  const key = process.env.SARVAM_API_KEY?.trim();
  if (!key) {
    record('SARVAM_API_KEY present', 'FAIL', 'Not set. Add it to .env, then re-run.');
    return report();
  }
  record('SARVAM_API_KEY present', 'PASS', `Key ending …${key.slice(-4)} (${key.length} chars)`);

  // 1. Configuration, before any money is spent.
  const { model, warning } = resolveSarvamModel(config);
  const reasoning = resolveSarvamReasoningEffort(config);
  const ceiling = resolveSarvamMaxOutputTokens(config);
  record(
    'Resolved configuration',
    warning ? 'FAIL' : 'PASS',
    warning ?? `model=${model}, reasoning=${reasoning ?? 'disabled'}, max output tokens=${ceiling}`,
  );

  // 2. A plain call: does the key work and does text come back?
  try {
    const read = await callSarvam(
      buildSarvamBody({
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
        maxTokens: clampSarvamMaxTokens(200, { config }),
        reasoningEffort: reasoning,
      }),
    );

    record(
      'Plain completion returns text',
      read.text ? 'PASS' : 'FAIL',
      read.text
        ? `${read.completionTokens} completion tokens, finish_reason=${read.finishReason}: "${read.text.slice(0, 80)}"`
        : describeEmptySarvamResponse(read, 200),
    );
  } catch (error) {
    record('Plain completion returns text', 'FAIL', (error as Error).message);
    return report();
  }

  // 3. The original bug, reproduced on purpose: a small budget with reasoning
  // left on. This is what every feature in the product was doing.
  try {
    const budget = 400;
    const read = await callSarvam({
      model,
      messages: [{ role: 'user', content: 'Summarise the Indian SEO services market in three sentences.' }],
      max_tokens: budget,
      temperature: 0.2,
      // reasoning_effort deliberately omitted, which leaves thinking on.
    });

    record(
      'Reproduces the empty-output bug with reasoning left on',
      read.text ? 'SKIP' : 'PASS',
      read.text
        ? `This account still answered within ${budget} tokens, so the symptom did not reproduce here. ` +
          'The fix is still correct — a larger prompt would exhaust the budget.'
        : `Confirmed: ${read.completionTokens} tokens billed, no answer. ` +
          `${describeEmptySarvamResponse(read, budget)}`,
    );
  } catch (error) {
    record('Reproduces the empty-output bug with reasoning left on', 'SKIP', (error as Error).message);
  }

  // 4. The same budget with the fix applied.
  try {
    const read = await callSarvam(
      buildSarvamBody({
        model,
        messages: [{ role: 'user', content: 'Summarise the Indian SEO services market in three sentences.' }],
        maxTokens: clampSarvamMaxTokens(400, { config }),
        reasoningEffort: reasoning,
      }),
    );

    record(
      'Same request answers once reasoning is disabled',
      read.text ? 'PASS' : 'FAIL',
      read.text
        ? `${read.text.length} characters returned (${read.completionTokens} completion tokens)`
        : describeEmptySarvamResponse(read, clampSarvamMaxTokens(400, { config })),
    );
  } catch (error) {
    record('Same request answers once reasoning is disabled', 'FAIL', (error as Error).message);
  }

  // 5. Structured output, which is what Content Intelligence, Content and
  // Market Research all depend on.
  try {
    const schema = {
      type: 'object',
      properties: {
        title: { type: 'string' },
        hook: { type: 'string' },
        hashtags: { type: 'array', items: { type: 'string' } },
      },
      required: ['title', 'hook', 'hashtags'],
    };

    const maxTokens = clampSarvamMaxTokens(2000, { config, structured: true });
    const read = await callSarvam(
      buildSarvamBody({
        model,
        messages: [
          {
            role: 'system',
            content:
              'You generate social content. Respond with ONLY valid JSON matching this schema:\n' +
              JSON.stringify(schema, null, 2),
          },
          { role: 'user', content: 'Topic: AI-driven SEO for Indian D2C brands. Platform: LinkedIn.' },
        ],
        maxTokens,
        reasoningEffort: reasoning,
        jsonMode: true,
      }),
    );

    if (!read.text) {
      record('Structured JSON output parses', 'FAIL', describeEmptySarvamResponse(read, maxTokens));
    } else {
      const parsed = extractAndParseJson<{ title?: string; hook?: string; hashtags?: string[] }>(read.text);
      const complete = Boolean(parsed.title && parsed.hook && Array.isArray(parsed.hashtags));
      record(
        'Structured JSON output parses',
        complete ? 'PASS' : 'FAIL',
        complete
          ? `title="${parsed.title}", ${parsed.hashtags!.length} hashtags`
          : `Parsed but incomplete: ${JSON.stringify(parsed).slice(0, 200)}`,
      );
    }
  } catch (error) {
    record('Structured JSON output parses', 'FAIL', (error as Error).message);
  }

  report();
}

function report() {
  const failed = results.filter((r) => r.status === 'FAIL');
  const passed = results.filter((r) => r.status === 'PASS');
  const skipped = results.filter((r) => r.status === 'SKIP');

  console.log('='.repeat(60));
  console.log(`${passed.length} passed, ${failed.length} failed, ${skipped.length} skipped\n`);

  if (failed.length > 0) {
    console.log('Failures:');
    for (const f of failed) console.log(`  ✗ ${f.name}: ${f.detail}`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('\nSmoke test crashed:', error);
  process.exit(1);
});
