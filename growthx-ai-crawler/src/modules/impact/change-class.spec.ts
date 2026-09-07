import { ChangeClass } from '@prisma/client';
import { changeClassForFixType } from './change-class';

describe('changeClassForFixType', () => {
  it('files both metadata patches under one class', () => {
    // The ledger's question is "does rewriting page metadata move citation",
    // not "does rewriting the title move it differently from the description".
    expect(changeClassForFixType('META_TITLE')).toBe(ChangeClass.METADATA);
    expect(changeClassForFixType('META_DESCRIPTION')).toBe(ChangeClass.METADATA);
  });

  it('collapses every schema patch into SCHEMA_MARKUP', () => {
    // Splitting these would imply the ledger can tell whether FAQ markup beats
    // Product markup, which it cannot at the sample sizes it will have for its
    // first year. A distinction the data cannot support is worse than a coarse
    // one.
    for (const fixType of ['FAQ_SCHEMA', 'PRODUCT_SCHEMA', 'ORGANIZATION_SCHEMA', 'BREADCRUMB_SCHEMA']) {
      expect(changeClassForFixType(fixType)).toBe(ChangeClass.SCHEMA_MARKUP);
    }
  });

  it('maps the remaining patches to their own classes', () => {
    expect(changeClassForFixType('CANONICAL_URL')).toBe(ChangeClass.CANONICAL_CONSOLIDATION);
    expect(changeClassForFixType('ALT_TEXT')).toBe(ChangeClass.MEDIA_ALT);
  });

  it('files an unknown patch as OTHER rather than dropping it', () => {
    // A change that shipped and went unrecorded is invisible to every later
    // measurement. A growing pile of OTHER is the signal to extend the map.
    expect(changeClassForFixType('SOME_FUTURE_PATCH')).toBe(ChangeClass.OTHER);
    expect(changeClassForFixType('')).toBe(ChangeClass.OTHER);
    expect(changeClassForFixType(undefined as unknown as string)).toBe(ChangeClass.OTHER);
  });

  it('covers every patch type the fix engine can apply', () => {
    // Kept in step with patch-generation.service.ts deliberately: a patch type
    // added there without a class here would silently pile up as OTHER.
    const patcherFixTypes = [
      'META_TITLE',
      'META_DESCRIPTION',
      'CANONICAL_URL',
      'ALT_TEXT',
      'FAQ_SCHEMA',
      'PRODUCT_SCHEMA',
      'ORGANIZATION_SCHEMA',
      'BREADCRUMB_SCHEMA',
    ];

    for (const fixType of patcherFixTypes) {
      expect(changeClassForFixType(fixType)).not.toBe(ChangeClass.OTHER);
    }
  });
});
