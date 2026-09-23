#!/usr/bin/env node
/**
 * Guards the product's central promise on the screens the client actually
 * reads: a customer never sees a number, a verdict or a status that was
 * invented for them.
 *
 * The backend has `src/no-fabricated-data.spec.ts` doing the same job. The
 * frontend has no test runner, so this runs as a plain script from `lint` and
 * `build` — a fabricated figure fails the build instead of reaching a customer
 * and waiting for someone to notice.
 *
 * Every rule below is a fabricator that was really found in this codebase, not
 * a hypothetical. If a match is legitimate, add it to that rule's `allow` list
 * with the reason — the reason is the point, so an allowlist entry without one
 * is not worth having.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.mjs'];

/**
 * `except` exempts a whole vocabulary collision — a term of art that matches
 * the pattern everywhere it is used. `allow` exempts one reviewed line.
 *
 * @typedef {{ name: string, why: string, pattern: RegExp, except?: RegExp,
 *             allow?: Array<{ file: string, line?: string, reason: string }> }} Rule
 */

/** @type {Rule[]} */
const RULES = [
  {
    name: 'invented display value',
    why:
      'A `|| 85` or `?? 100` on a figure the client reads turns "we never ' +
      'measured this" into a measurement they will act on. Render an em dash, ' +
      'or omit the row.',
    pattern: /(\?\?|\|\|)\s*\d{2,}/,
    allow: [
      {
        file: 'app/(dashboard)/content-intelligence/strategy/page.tsx',
        line: 'const total =',
        reason:
          'Divide-by-zero guard on a denominator, not a value shown to anyone.',
      },
      {
        file: 'lib/api-client.ts',
        line: 'new ApiError(',
        reason:
          'HTTP status for a transport error that carried none. Not client data.',
      },
    ],
  },
  {
    name: 'randomly generated figure',
    why:
      'A displayed number that changes on refresh was never a measurement. ' +
      'Every instance of this found so far was a placeholder metric.',
    pattern: /Math\.random\s*\(/,
  },
  {
    name: 'placeholder dataset',
    why:
      'Demo data added during development is indistinguishable from real data ' +
      'once it is on the screen, and it survives to production.',
    // Lazy, and the middle is optional: this has to match both `mockMetrics`
    // and `seedInitialData`. A greedy `[A-Z]\w*` here swallows the suffix it
    // then needs to match, and the rule silently never fires.
    pattern: /\b(mock|dummy|fake|sample|demo|placeholder|seed)_?[A-Za-z]*?(Data|Metrics|Results|Items|Rows|Competitors|Stats|Scores|Pages|Keywords)\b/,
    // Both are SEO terms of art carrying real data, not stand-ins: sample
    // keywords are the ones actually matched in a competitor's crawled pages,
    // seed keywords come off the business profile read from the client's own
    // site. The collision is in the vocabulary, so exempt the words, not the
    // files that happen to use them today.
    except: /\b(sampleKeywords|seedKeywords)\b/,
  },
  {
    name: 'hardcoded verdict',
    why:
      'These exact strings shipped as chips under a "Market Intelligence" ' +
      'heading. Every customer saw the same two verdicts whatever their ' +
      'market, and nothing measured either one.',
    pattern: /(Search Demand:\s*Moderate|Competitive Velocity:\s*High)/,
  },
  {
    name: 'another business as a default',
    why:
      'A real domain used as a fallback shows one customer another ' +
      "business's name, and every figure next to it reads as theirs. This " +
      'fallback put aivaenterprises.com and milquufresh.in on new accounts. ' +
      'Render empty, or say nothing is selected.',
    pattern: /(\|\||\?\?|=)\s*["'`](https?:\/\/)?(www\.)?[a-z0-9-]+\.(in|com|co|io|ai|net|org)["'`]/,
    // Links out to real sites and greyed input hints are not client data, and
    // an obviously generic stand-in like yourdomain.com cannot be mistaken for
    // anyone's business.
    except: /\b(href|placeholder)=|\byour-?(domain|website|site)\.com\b/,
    allow: [
      {
        file: 'lib/api-client.ts',
        line: 'const ORG_KEY',
        reason: 'A localStorage key that happens to end in ".org", not a domain.',
      },
    ],
  },
  {
    name: 'unsourced performance multiplier',
    why:
      '"3.8x more citations" and "3.2x organic visibility" shipped as copy with ' +
      'nothing behind them. A figure the reader will quote needs a measurement ' +
      'or a named source; otherwise describe the effect without a number.',
    pattern: /\b\d+(\.\d+)?x (more|higher|faster|increase|lift|boost|better)\b/i,
    allow: [
      {
        file: 'components/social/social-market-trends-panel.tsx',
        reason:
          'KNOWN, NOT YET FIXED: the Social module is outside the current ' +
          'audit (website, competitors, GBP). Its "market trends" are a ' +
          'static list. Remove this entry when that panel is rebuilt.',
      },
    ],
  },
  {
    name: 'demo business content',
    why:
      'These are the businesses the product was built against. Their names, ' +
      'cities and figures hardcoded into a screen are demo content that every ' +
      'customer sees.',
    pattern: /milquu|miquu|aivaenterprises|navi mumbai|vashi|kharghar|cidco/i,
    // Comments recording why a fabricator was removed are the point of them.
    except: /^\s*(\/\/|\*|\/\*)/,
    allow: [
      {
        file: 'components/marketing/trust-section.tsx',
        line: '"Milquu Fresh"',
        reason: 'A customer name in the "trusted by" list, with no figures or quotes attached.',
      },
      {
        file: 'components/marketing/workflow-steps.tsx',
        line: '"Milquu Fresh"',
        reason: 'A customer name in the "trusted by" list, with no figures or quotes attached.',
      },
      {
        file: 'app/login/page.tsx',
        line: '"Milquu Fresh"',
        reason: 'A customer name in the "trusted by" list, with no figures or quotes attached.',
      },
      {
        file: 'components/ai-visibility/specialized-engines-panel.tsx',
        reason:
          'KNOWN, NOT YET FIXED: AI Visibility is outside the current audit. ' +
          'This panel renders a templated Navi Mumbai demographic report. ' +
          'Remove this entry when it is rebuilt on a real model call.',
      },
    ],
  },
  {
    name: 'unconditional bypass',
    why:
      'A check switched off "for now" is how billing ended up disabled in ' +
      'production for months.',
    pattern: /\b(devBypass|DEV_BYPASS|skipAuth|bypass)\s*[=:]\s*true\b/,
  },
];

function sourceFiles(dir) {
  const found = [];
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (EXTENSIONS.some((ext) => entry.endsWith(ext))) found.push(full);
  }
  return found;
}

/** An allow entry matches when its file matches and, if given, the line does. */
function allowed(rule, relPath, text) {
  return (rule.allow ?? []).some(
    (entry) =>
      relPath === entry.file.split('/').join(sep) &&
      (entry.line === undefined || text.includes(entry.line)),
  );
}

const offences = [];

for (const file of sourceFiles(SRC)) {
  const relPath = relative(SRC, file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((text, index) => {
    for (const rule of RULES) {
      if (!rule.pattern.test(text)) continue;
      if (rule.except?.test(text)) continue;
      if (allowed(rule, relPath, text)) continue;
      offences.push({
        rule,
        where: `src/${relPath.split(sep).join('/')}:${index + 1}`,
        text: text.trim(),
      });
    }
  });
}

if (offences.length === 0) {
  console.log(`no fabricated data: ${RULES.length} rules, clean`);
  process.exit(0);
}

const byRule = new Map();
for (const offence of offences) {
  const list = byRule.get(offence.rule.name) ?? [];
  list.push(offence);
  byRule.set(offence.rule.name, list);
}

console.error('\nFabricated client data — the build stops here.\n');
for (const [name, list] of byRule) {
  console.error(`  ${name}`);
  console.error(`    ${list[0].rule.why}\n`);
  for (const offence of list) {
    console.error(`    ${offence.where}`);
    console.error(`      ${offence.text}`);
  }
  console.error('');
}
console.error(
  'Fix it, or — if this match is genuinely not client data — add it to that\n' +
    "rule's allow list in scripts/check-no-fabricated-data.mjs with the reason.\n",
);
process.exit(1);
