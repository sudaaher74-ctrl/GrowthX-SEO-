import { FIX_CLASS, fixClassFor } from './fix-class';

describe('fixClassFor', () => {
  it('returns the table entry for a known type', () => {
    expect(fixClassFor('MISSING_META_DESCRIPTION')).toBe('AUTO');
    expect(fixClassFor('MISSING_H1')).toBe('APPROVAL');
    expect(fixClassFor('SERVER_ERROR_5XX')).toBe('MANUAL');
  });

  it('routes the generated SCHEMA_* namespace to AUTO', () => {
    // SCHEMA_PRODUCT_OFFERS is the type filling the Aiva priority queue. It is
    // generated, not enumerated, so it has to be matched by pattern.
    expect(fixClassFor('SCHEMA_PRODUCT_OFFERS')).toBe('AUTO');
    expect(fixClassFor('SCHEMA_ARTICLE_AUTHOR')).toBe('AUTO');
  });

  it('routes anything unrecognised to MANUAL, never AUTO', () => {
    // The safe direction: a wrongly-MANUAL type costs a click; a wrongly-AUTO
    // one changes a live site nobody reviewed.
    expect(fixClassFor('SOMETHING_NEW')).toBe('MANUAL');
    expect(fixClassFor('')).toBe('MANUAL');
  });

  it('never marks a visitor-facing change AUTO', () => {
    for (const type of ['MISSING_H1', 'MULTIPLE_H1', 'BROKEN_LINK_4XX', 'NOINDEX_DETECTED', 'INCORRECT_ROBOTS']) {
      expect(FIX_CLASS[type]).not.toBe('AUTO');
    }
  });
});
