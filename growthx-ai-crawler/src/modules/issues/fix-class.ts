/**
 * How the Fix Engine should handle a finding, decided by what the fix touches
 * and never by which detector raised it. See §5 of
 * docs/workflow/00-ARCHITECTURE.md.
 *
 * - AUTO     Invisible to visitors, reversible, low blast radius. Applies
 *            directly, snapshot first.
 * - APPROVAL Touches code or anything a visitor sees. Staged with a diff, never
 *            auto-merged.
 * - MANUAL   Needs judgement or an account we do not hold. Drafted, handed over.
 *
 * Lives on its own rather than inside the copy table so the queue can count
 * "Fix all safe (n)" today, and so the plain-language copy added later imports
 * this instead of keeping a second opinion about what is safe to automate.
 */
export type FixClass = 'AUTO' | 'APPROVAL' | 'MANUAL';

export const FIX_CLASS: Readonly<Record<string, FixClass>> = {
  // Search-result metadata and hidden markup. Nothing a visitor sees changes.
  MISSING_TITLE: 'AUTO',
  LONG_TITLE: 'AUTO',
  SHORT_TITLE: 'AUTO',
  DUPLICATE_TITLE: 'AUTO',
  MISSING_META_DESCRIPTION: 'AUTO',
  LONG_META_DESCRIPTION: 'AUTO',
  MISSING_ALT_TEXT: 'AUTO',
  MISSING_CANONICAL: 'AUTO',
  BROKEN_CANONICAL: 'AUTO',
  NOT_IN_SITEMAP: 'AUTO',

  // Visible to visitors, or wrong in a way that costs the whole site if the
  // fix is itself wrong. A human sees the change before it ships.
  CANONICAL_CROSS_DOMAIN: 'APPROVAL',
  NOINDEX_DETECTED: 'APPROVAL',
  INCORRECT_ROBOTS: 'APPROVAL',
  MISSING_H1: 'APPROVAL',
  MULTIPLE_H1: 'APPROVAL',
  BROKEN_LINK_4XX: 'APPROVAL',
  BROKEN_IMAGE: 'APPROVAL',
  REDIRECT_CHAIN: 'APPROVAL',
  MIXED_CONTENT: 'APPROVAL',
  LARGE_HTML: 'APPROVAL',
  URL_STRUCTURE_ISSUE: 'APPROVAL',
  ORPHAN_PAGE: 'APPROVAL',

  // Lives outside the site's code, or needs words in the owner's own voice.
  REDIRECT_LOOP: 'MANUAL',
  SERVER_ERROR_5XX: 'MANUAL',
  HTTPS_ISSUE: 'MANUAL',
  THIN_CONTENT: 'MANUAL',
};

/**
 * The fix class for any issue type, including ones this table has never heard
 * of.
 *
 * `SCHEMA_<type>_<PROPERTY>` types are generated rather than enumerated, so
 * they are matched by pattern: structured data is invisible to visitors, which
 * is exactly the AUTO condition.
 *
 * Anything else unknown is MANUAL. The failure this guards against is
 * asymmetric: an unrecognised type wrongly routed to MANUAL costs one person a
 * click, while one wrongly routed to AUTO changes a live site nobody reviewed.
 */
export function fixClassFor(issueType: string): FixClass {
  const known = FIX_CLASS[issueType];
  if (known) return known;
  if (/^SCHEMA_/.test(issueType)) return 'AUTO';
  return 'MANUAL';
}
