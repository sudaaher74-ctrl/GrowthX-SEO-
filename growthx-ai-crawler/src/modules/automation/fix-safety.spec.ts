import { isSafeFixType, unsafeFixReason } from './fix-safety';

describe('fix safety', () => {
  it('prepares text, alt text and structured data', () => {
    for (const t of ['META_TITLE', 'META_DESCRIPTION', 'ALT_TEXT', 'FAQ_SCHEMA', 'PRODUCT_SCHEMA']) expect(isSafeFixType(t)).toBe(true);
  });

  it('leaves changes that can move rankings to a person, and says why', () => {
    for (const t of ['CANONICAL_URL', 'HEADING_STRUCTURE', 'INTERNAL_LINKING']) {
      expect(isSafeFixType(t)).toBe(false);
      expect(unsafeFixReason(t)).toContain('person');
    }
  });

  it('treats an unknown fix type as not safe', () => {
    expect(isSafeFixType('REDIRECT')).toBe(false);
    expect(isSafeFixType('NOINDEX')).toBe(false);
  });
});
