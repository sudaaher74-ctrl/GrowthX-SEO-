/**
 * Which fixes the engine may prepare on its own.
 *
 * A change can be prepared for a pull request only when a mistake in it costs
 * little and is easy to spot in the diff: text in a title or description, alt
 * text, and structured data added alongside the page. Canonical tags, heading
 * structure and internal links can move a page's ranking, or pull it out of
 * Google, if they are wrong, so those are left to a person. They are reported
 * as skipped, with the reason, never silently dropped.
 */
export const SAFE_FIX_TYPES: ReadonlySet<string> = new Set([
  'META_TITLE',
  'META_DESCRIPTION',
  'METADATA',
  'ALT_TEXT',
  'BREADCRUMB_SCHEMA',
  'FAQ_SCHEMA',
  'ORGANIZATION_SCHEMA',
  'PRODUCT_SCHEMA',
]);

export function isSafeFixType(fixType: string): boolean {
  return SAFE_FIX_TYPES.has(fixType);
}

/** Why a fix type is not prepared automatically, in words for the customer. */
export function unsafeFixReason(fixType: string): string {
  switch (fixType) {
    case 'CANONICAL_URL':
      return 'a wrong canonical tag can remove a page from Google, so a person should make this change';
    case 'HEADING_STRUCTURE':
      return 'it changes how the page is structured, so a person should review it';
    case 'INTERNAL_LINKING':
      return 'it edits another page to add a link, so a person should decide where';
    default:
      return 'this kind of change is not one the engine prepares on its own';
  }
}
