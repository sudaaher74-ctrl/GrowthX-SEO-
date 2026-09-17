import * as cheerio from 'cheerio';

/** Why the render tier is needed. Shown as evidence on JS_RENDER_REQUIRED. */
export type EscalationReason =
  | 'EMPTY_BODY_TEXT'
  | 'NO_ANCHORS'
  | 'INSUFFICIENT_LINKS'
  | 'EMPTY_MOUNT_NODE'
  | 'SPA_FINGERPRINT'
  | 'FORCED';

export interface EscalationVerdict {
  escalate: boolean;
  reasons: EscalationReason[];
  /** Measurements the reasons were drawn from, kept for the issue's evidence. */
  rawBodyTextLength: number;
  rawAnchorCount: number;
  rawTitle?: string;
}

/** Root nodes a client-side framework mounts into. */
const MOUNT_SELECTORS = ['#root', '#app', '#__next', '[data-reactroot]', '#___gatsby', '[data-server-rendered]'];

/**
 * Build fingerprints that identify a shipped SPA bundle.
 *
 * Matched against raw HTML rather than a parsed DOM because that is where they
 * live — a Vite build's `/assets/index-<hash>.js` module script and its
 * `vite.svg` favicon, Next's `__NEXT_DATA__`, Angular's `ng-version`, and Vue
 * SSR's explicit `data-server-rendered="false"`.
 */
const SPA_FINGERPRINTS: Array<{ id: string; test: RegExp }> = [
  { id: 'vite-asset-bundle', test: /<script[^>]+src=["'][^"']*\/assets\/index-[A-Za-z0-9_-]+\.js/i },
  { id: 'vite-favicon', test: /href=["'][^"']*vite\.svg/i },
  { id: 'next-data', test: /id=["']__NEXT_DATA__["']/i },
  { id: 'next-app-router', test: /(self\.__next_f|_next\/static\/chunks\/app\/)/i },
  { id: 'next-bailout', test: /BAILOUT_TO_CLIENT_SIDE_RENDERING/i },
  { id: 'angular', test: /\sng-version=/i },
  { id: 'vue-not-ssr', test: /data-server-rendered=["']false["']/i },
  { id: 'create-react-app', test: /<script[^>]+src=["'][^"']*\/static\/js\/(main|bundle)[.\w-]*\.js/i },
];

/** Below this many characters of body text, there is nothing to analyse. */
export const MIN_BODY_TEXT_CHARS = 200;

/**
 * Decides whether a statically fetched page needs the render tier.
 *
 * This is the predicate the old crawler got almost right and then threw away:
 * it detected the SPA, failed to launch a browser, and silently analysed the
 * empty shell anyway. Keeping it pure and returning the measurements alongside
 * the verdict is what lets the caller record *why* it escalated, and lets
 * JS_RENDER_REQUIRED quote the raw-versus-rendered difference as evidence
 * rather than asserting it.
 *
 * `renderedTitle` is passed on the second pass only, to catch the case where a
 * static body looks adequate but the framework rewrites the title — a page that
 * ranks under a placeholder like "AURA | Premium Archery Academy" for every
 * crawler that does not execute JavaScript.
 */
export function shouldEscalateToRender(rawHtml: string, opts: { force?: boolean; renderedTitle?: string } = {}): EscalationVerdict {
  const reasons: EscalationReason[] = [];
  const html = rawHtml || '';
  const $ = cheerio.load(html);

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const rawAnchorCount = $('a[href]').length;
  const rawTitle = $('title').first().text().trim() || undefined;

  if (opts.force) reasons.push('FORCED');
  if (bodyText.length < MIN_BODY_TEXT_CHARS) reasons.push('EMPTY_BODY_TEXT');
  if (rawAnchorCount === 0) reasons.push('NO_ANCHORS');
  else if (
    rawAnchorCount < 5 &&
    (SPA_FINGERPRINTS.some((f) => f.test.test(html)) || /<script[^>]+src=["'][^"']*\/_next\/static\//i.test(html))
  ) {
    reasons.push('INSUFFICIENT_LINKS');
  }

  for (const selector of MOUNT_SELECTORS) {
    const node = $(selector).first();
    if (node.length > 0 && node.children().length === 0 && node.text().trim() === '') {
      reasons.push('EMPTY_MOUNT_NODE');
      break;
    }
  }

  if (SPA_FINGERPRINTS.some((f) => f.test.test(html))) {
    reasons.push('SPA_FINGERPRINT');
  }

  // A title the framework rewrites is only knowable after a render, so this
  // arm exists for the re-check, never for the first decision.
  if (opts.renderedTitle && rawTitle && opts.renderedTitle.trim() !== rawTitle) {
    reasons.push('SPA_FINGERPRINT');
  }

  return {
    escalate: reasons.length > 0,
    reasons: [...new Set(reasons)],
    rawBodyTextLength: bodyText.length,
    rawAnchorCount,
    rawTitle,
  };
}

/** Names the SPA fingerprints present, for evidence strings. */
export function spaFingerprints(rawHtml: string): string[] {
  return SPA_FINGERPRINTS.filter((f) => f.test.test(rawHtml || '')).map((f) => f.id);
}
