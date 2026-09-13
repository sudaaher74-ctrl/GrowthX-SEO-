#!/usr/bin/env node
/**
 * Keeps new UI on one visual vocabulary.
 *
 * The app renders three at once: the `brand-*` / `accent-*` token scale from
 * `@theme` in globals.css, Tailwind's stock palette (`slate-*`, `emerald-*`),
 * and typed hexes. They are not interchangeable — `text-slate-900` is #0f172a
 * and blue-tinted, `text-brand-950` is #09090b and neutral — so a section
 * written in one vocabulary sits visibly off the section beside it written in
 * another. That is the drift this guards.
 *
 * It is a ratchet, not a ban. Rewriting the ~7,000 existing stock-palette
 * classes in one pass would touch 188 files and break more than it fixes, so
 * every file carries the count it had when this landed, and the build fails
 * only when a count goes UP or a new file arrives with any. Same convention as
 * the `set-state-in-effect` exception in eslint.config.mjs: the count must only
 * go down, and the guard is deleted when it reaches zero.
 *
 * Run `node scripts/check-design-tokens.mjs --update` after you lower a count
 * (or deliberately raise one) to rewrite the baseline.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SRC = join(ROOT, 'src');
const BASELINE = join(ROOT, 'scripts', 'design-token-baseline.json');
const EXTENSIONS = ['.ts', '.tsx'];

/** Tailwind's stock palette. Our own scales are deliberately absent. */
const STOCK_PALETTE = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime', 'green', 'emerald', 'teal',
  'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
].join('|');

/**
 * Utility prefixes that take a colour. `accent` is here as a prefix
 * (`accent-blue-500`) and is not confused with our `accent-600` token, because
 * a palette name has to sit between the prefix and the shade.
 */
const COLOR_PREFIX =
  'bg|text|border|ring|outline|divide|from|via|to|fill|stroke|shadow|caret|accent|decoration|placeholder';

const RULES = [
  {
    name: 'stock Tailwind palette',
    why:
      'Use the token scale: `brand-*` for neutrals, `accent|success|warning|' +
      'error-*` for status, `series-*` for chart categories. A bare `border` ' +
      'already resolves to the hairline token, so it never needs a grey.',
    pattern: new RegExp(`\\b(?:${COLOR_PREFIX})-(?:${STOCK_PALETTE})-\\d{2,3}\\b`, 'g'),
  },
  {
    name: 'hardcoded colour',
    why:
      'A typed hex stops tracking the token the moment the token moves, which ' +
      'is how one page ended up tinting its header with `bg-[#f59e0b18]` ' +
      'while every other page used the warning token.',
    // Also catches the 8-digit form used for tints, e.g. `#f59e0b18`.
    pattern: /#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3}(?:[0-9a-fA-F]{2})?)?\b/g,
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

/** @returns {Map<string, number>} violations per `src/`-relative posix path. */
function countViolations() {
  const counts = new Map();
  for (const file of sourceFiles(SRC)) {
    const relPath = relative(SRC, file).split(sep).join('/');
    const text = readFileSync(file, 'utf8');
    let total = 0;
    for (const rule of RULES) {
      total += (text.match(rule.pattern) ?? []).length;
    }
    if (total > 0) counts.set(relPath, total);
  }
  return counts;
}

/** Where in a file the matches are, for the failure message. */
function locate(relPath) {
  const lines = readFileSync(join(SRC, relPath), 'utf8').split('\n');
  const hits = [];
  lines.forEach((text, index) => {
    for (const rule of RULES) {
      const found = text.match(rule.pattern);
      if (found) hits.push({ line: index + 1, rule, found: [...new Set(found)] });
    }
  });
  return hits;
}

const counts = countViolations();

if (process.argv.includes('--update')) {
  const sorted = Object.fromEntries([...counts].sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(BASELINE, `${JSON.stringify(sorted, null, 2)}\n`);
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`design tokens: baseline rewritten — ${counts.size} files, ${total} allowances`);
  process.exit(0);
}

/** @type {Record<string, number>} */
let baseline;
try {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
} catch {
  console.error(
    `\nMissing ${relative(ROOT, BASELINE)}.\n` +
      'Generate it with: node scripts/check-design-tokens.mjs --update\n',
  );
  process.exit(1);
}

const regressions = [];
const improvements = [];

for (const [relPath, count] of counts) {
  const allowed = baseline[relPath] ?? 0;
  if (count > allowed) regressions.push({ relPath, count, allowed });
  else if (count < allowed) improvements.push({ relPath, count, allowed });
}
// A file that was cleaned up entirely still owes a baseline entry removal.
for (const relPath of Object.keys(baseline)) {
  if (!counts.has(relPath)) improvements.push({ relPath, count: 0, allowed: baseline[relPath] });
}

if (regressions.length === 0) {
  const total = [...counts.values()].reduce((a, b) => a + b, 0);
  console.log(`design tokens: clean (${total} baselined allowances remaining)`);
  if (improvements.length > 0) {
    const freed = improvements.reduce((sum, i) => sum + (i.allowed - i.count), 0);
    console.log(
      `design tokens: ${freed} fewer than baseline in ${improvements.length} file(s) — ` +
        'lock it in with `node scripts/check-design-tokens.mjs --update`',
    );
  }
  process.exit(0);
}

console.error('\nOff-palette UI — the build stops here.\n');
for (const { relPath, count, allowed } of regressions) {
  console.error(
    `  src/${relPath}  ${allowed} allowed, ${count} found` +
      (allowed === 0 ? '  (new file — start it on the tokens)' : ''),
  );
  for (const hit of locate(relPath).slice(0, 6)) {
    console.error(`    :${hit.line}  ${hit.rule.name} — ${hit.found.join(', ')}`);
  }
  console.error('');
}
for (const rule of RULES) {
  console.error(`  ${rule.name}`);
  console.error(`    ${rule.why}\n`);
}
console.error(
  'Compose the primitives in src/components/ui/ rather than a fresh panel:\n' +
    'docs/design-system.md lists the pattern for each kind of block.\n\n' +
    'If a raise is genuinely right — a chart needing a literal colour, say —\n' +
    'run `node scripts/check-design-tokens.mjs --update` and say why in the\n' +
    'commit message.\n',
);
process.exit(1);
