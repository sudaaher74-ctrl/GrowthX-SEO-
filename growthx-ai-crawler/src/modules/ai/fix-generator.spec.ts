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
  it('generates a literal title for duplicate-title issues, including when the model is unavailable', () => {
    const page = { url: 'https://milquufresh.in/products', title: 'MilQuu Fresh – Premium Dairy Delivery Service', h1: [] };
    const plan = planFix('DUPLICATE_TITLE', page, 'Rewrite title tag to uniquely reflect the distinct topic of this specific page.');
    const fallback = plan.heuristic();
    expect(plan.prompt).toContain('Write a title tag');
    expect(fallback.proposedValue).toBe('Products | milquufresh.in');
    expect(isPublishableSeoText(plan.fixType, fallback.proposedValue)).toBe(true);
    expect(fallback.codeSnippet).toBe('<title>Products | milquufresh.in</title>');
    expect(fallback.proposedValue).not.toContain('Rewrite');
  });
});
