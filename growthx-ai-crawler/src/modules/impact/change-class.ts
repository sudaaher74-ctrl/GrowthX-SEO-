import { ChangeClass } from '@prisma/client';

/**
 * Translates the fix engine's patch vocabulary into the ledger's.
 *
 * Two vocabularies on purpose. The patcher's names describe the edit it makes
 * to a file; the ledger's describe the kind of structural change a page
 * received, which is the thing worth comparing across customers, verticals and
 * engines. They are not the same list and should not be forced into one — the
 * patcher will grow file-level operations that are the same structural change,
 * and the ledger must keep counting those together.
 *
 * The four schema patches deliberately collapse to SCHEMA_MARKUP. Splitting
 * them would imply the ledger can tell whether FAQ markup outperforms Product
 * markup, and with the sample sizes this will have for its first year it
 * cannot. A distinction the data cannot support is worse than a coarse one.
 */
const FIX_TYPE_TO_CHANGE_CLASS: Readonly<Record<string, ChangeClass>> = {
  META_TITLE: ChangeClass.METADATA,
  META_DESCRIPTION: ChangeClass.METADATA,
  CANONICAL_URL: ChangeClass.CANONICAL_CONSOLIDATION,
  ALT_TEXT: ChangeClass.MEDIA_ALT,
  FAQ_SCHEMA: ChangeClass.SCHEMA_MARKUP,
  PRODUCT_SCHEMA: ChangeClass.SCHEMA_MARKUP,
  ORGANIZATION_SCHEMA: ChangeClass.SCHEMA_MARKUP,
  BREADCRUMB_SCHEMA: ChangeClass.SCHEMA_MARKUP,
};

/**
 * The change class a patch belongs to.
 *
 * An unrecognised fix type files as OTHER rather than being dropped. A change
 * that shipped and went unrecorded is invisible to every later measurement,
 * and OTHER at least keeps it countable and findable; a new patch type showing
 * up as a growing pile of OTHER is the signal to extend the map above.
 */
export function changeClassForFixType(fixType: string): ChangeClass {
  return FIX_TYPE_TO_CHANGE_CLASS[fixType?.toUpperCase?.() ?? ''] ?? ChangeClass.OTHER;
}
