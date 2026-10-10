import { readTitleEvidence, readTitleVariants } from './pr-title-evidence';
describe('Pull request title evidence', () => {
  it('reads the final literal title without executing code', () => {
    expect(readTitleEvidence('<Helmet><title>{"Contact Us | Business"}</title></Helmet>')).toEqual({ value: 'Contact Us | Business', expression: null });
  });
  it('deduplicates identical titles in alternate return paths', () => {
    expect(readTitleEvidence('<><title>{"Cart"}</title><title>{"Cart"}</title></>').value).toBe('Cart');
  });
  it('does not claim a dynamic category expression is a fixed live title', () => {
    expect(readTitleEvidence('<title>{category.title + " | Business"}</title>')).toEqual({ value: null, expression: 'category.title + " | Business"' });
  });
  it('does not guess when different page states have different titles', () => {
    expect(readTitleEvidence('<><title>{"One"}</title><title>{"Two"}</title></>').value).toBeNull();
  });
  it('does not manufacture titles from an absent revision or unrelated markup', () => {
    expect(readTitleEvidence(null).value).toBeNull();
    expect(readTitleEvidence('<h1>Fresh Milk</h1>').value).toBeNull();
  });
  it('shows category options only when they are literal values in the actual source', () => {
    expect(readTitleVariants("const meta = {milk: {title: 'Fresh Milk'}, vegetables: {title: 'Vegetables'}}", "(meta[category]?.title || 'Products') + ' | Store'"))
      .toEqual(['Products | Store', 'Fresh Milk | Store', 'Vegetables | Store']);
    expect(readTitleVariants('const meta = fetchPrivateData()', "(meta[category]?.title || 'Products') + ' | Store'")).toEqual([]);
  });
});
