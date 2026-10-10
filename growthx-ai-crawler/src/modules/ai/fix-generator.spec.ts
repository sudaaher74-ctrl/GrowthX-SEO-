import { isPublishableSeoText, planFix, renderFromModel } from './fix-generator';

describe('publishable SEO fix values', () => {
  it('rejects cached editing advice rather than publishing it as a title', () => {
    expect(isPublishableSeoText('META_TITLE', "Rewrite the title tag to 'Your Cart - MilQuu Fresh'")).toBe(false);
    expect(isPublishableSeoText('META_TITLE', 'Your Cart - MilQuu Fresh')).toBe(true);
    expect(isPublishableSeoText('META_DESCRIPTION', '<meta name="description">')).toBe(false);
    expect(isPublishableSeoText('META_TITLE', 'x'.repeat(66))).toBe(false);
  });
  it('rejects model instructions so the existing page-derived fallback is used', () => {
    const page = { url: 'https://example.com/cart', title: 'Shop', h1: ['Your cart'] };
    const plan = planFix('DUPLICATE_TITLE', page);
    expect(renderFromModel(plan, { title: 'Rewrite the title tag to Your Cart' }, page)).toBeNull();
    expect(renderFromModel(plan, { title: 'Your Cart | Example' }, page)?.proposedValue).toBe('Your Cart | Example');
  });
});
