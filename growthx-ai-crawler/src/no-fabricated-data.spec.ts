import { execSync } from 'child_process';
import * as path from 'path';

/**
 * Guards the product's central promise: a client never sees a number that was
 * invented for them.
 *
 * Every fabricator removed so far followed one of two patterns — a service that
 * `create`s a record on a read path when none exists, or a literal block of
 * plausible-looking metrics. Both were added in good faith during development
 * and both survived to production, so this fails the build rather than relying
 * on anyone noticing in review.
 *
 * If a match here is legitimate, name the reason in the allowlist below.
 */

const SRC = path.join(__dirname);

/** Files whose matches have been reviewed and are not fabricated client data. */
const ALLOWLIST = [
  // Comments explaining a removed fabricator.
  'local-seo/local-seo.service.ts',
  'integrations/integrations.service.ts',
  'monitoring/monitoring.service.ts',
  'reporting/reporting.service.ts',
  'market-intelligence/market-intelligence.service.ts',
  'performance/performance.service.ts',
  'billing/entitlements.service.ts',
  'market-research/model-router.service.ts',
  'ai-search/multi-ai-router/multi-ai-router.service.ts',
  // Prompt text instructing a model not to use placeholders.
  'patch-generation/patch-generation.service.ts',
  'automation/content-agent.service.ts',
  // This file.
  'no-fabricated-data.spec.ts',
];

function grep(pattern: string): string[] {
  try {
    const out = execSync(
      `grep -rnE ${JSON.stringify(pattern)} --include=*.ts "${SRC}" || true`,
      { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 },
    );
    return out
      .split('\n')
      .filter(Boolean)
      .filter((line) => !line.includes('.spec.ts'))
      .filter((line) => !ALLOWLIST.some((allowed) => line.includes(allowed)));
  } catch {
    return [];
  }
}

describe('no fabricated client data', () => {
  // The exact shape of every fabricator found so far: a read path that writes a
  // record when the customer has none, filling it with invented figures.
  it('has no service that seeds placeholder data on a read', () => {
    const offenders = grep('(Seed|seed) (initial |dummy |mock )?(mock |dummy )?data');

    expect(offenders).toEqual([]);
  });

  it('has no simulated or mock metric generators', () => {
    const offenders = grep('(generateSimulated|simulatedMetrics|mockMetrics|fakeData|dummyData)');

    expect(offenders).toEqual([]);
  });

  // A bypass that disables a check "for now" is how billing ended up switched
  // off in production for months.
  it('has no unconditional development bypass', () => {
    const offenders = grep('(devBypass|DEV_BYPASS|bypass) *= *true');

    expect(offenders).toEqual([]);
  });

  it('does not invent contact details for missing records', () => {
    const offenders = grep("'(admin|owner|contact)@' *\\+");

    expect(offenders).toEqual([]);
  });
});
