import { completenessScore, detectProductSignals, matchConfidence } from './product-detector';

const detect = (over: Partial<Parameters<typeof detectProductSignals>[0]> = {}) =>
  detectProductSignals({
    url: 'https://indianfruitspulp.com/our-products/mango-pulp',
    jsonLd: [],
    bodyText: '',
    pageTypeIsProduct: false,
    ...over,
  });

/**
 * Catalog (You) and Catalog (Them) both read straight off this. A page
 * wrongly counted as a product inflates the catalog with noise; a real
 * product page missed here just never shows up at all — either way the Gaps
 * tab compares a catalog that isn't the site's actual one.
 */
describe('detectProductSignals — schema.org Product markup', () => {
  it('reads name, price and stock straight from a well-formed Product node', () => {
    const signal = detect({
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Product',
          name: 'Alphonso Mango Pulp — 850g Tin',
          category: 'Aseptic Fruit Pulp',
          offers: {
            '@type': 'Offer',
            price: '349.00',
            priceCurrency: 'INR',
            availability: 'https://schema.org/InStock',
          },
        },
      ],
    });

    expect(signal.isProductPage).toBe(true);
    expect(signal.hasProductSchema).toBe(true);
    expect(signal.name).toBe('Alphonso Mango Pulp — 850g Tin');
    expect(signal.category).toBe('Aseptic Fruit Pulp');
    expect(signal.priceStatus).toBe('FOUND');
    expect(signal.priceMinorUnits).toBe(34900);
    expect(signal.currency).toBe('INR');
    expect(signal.stockStatus).toBe('FOUND');
    expect(signal.stockValue).toBe('IN_STOCK');
  });

  it('unwraps an @graph container the way SchemaValidatorService does', () => {
    const signal = detect({
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@graph': [
            { '@type': 'Organization', name: 'Acme' },
            { '@type': 'Product', name: 'Frozen Mango Cubes 1kg', offers: { price: 199, priceCurrency: 'INR' } },
          ],
        },
      ],
    });

    expect(signal.hasProductSchema).toBe(true);
    expect(signal.name).toBe('Frozen Mango Cubes 1kg');
  });

  it('reports NOT_PUBLISHED rather than a blank when a B2B listing has no offer at all', () => {
    // Common on wholesale sites: the product exists, the price is quote-only.
    const signal = detect({
      jsonLd: [{ '@type': 'Product', name: 'IQF Diced Mango — Bulk', category: 'IQF Fruits' }],
      bodyText: 'IQF Diced Mango — Bulk. Request a quote for wholesale pricing.',
    });

    expect(signal.hasProductSchema).toBe(true);
    expect(signal.priceStatus).toBe('NOT_PUBLISHED');
    expect(signal.priceMinorUnits).toBeNull();
    expect(signal.stockStatus).toBe('NOT_PUBLISHED');
    expect(signal.ctaType).toBe('REQUEST_QUOTE');
    expect(signal.isProductPage).toBe(true);
  });
});

describe('detectProductSignals — price regex and CTA, no structured data', () => {
  it('flags a page with both a price and a buy CTA even with no schema at all', () => {
    const signal = detect({
      bodyText: 'Alphonso Mango Pulp — 850g Tin. Price: ₹349. Add to cart.',
    });

    expect(signal.hasProductSchema).toBe(false);
    expect(signal.isProductPage).toBe(true);
    expect(signal.priceStatus).toBe('FOUND');
    expect(signal.priceMinorUnits).toBe(34900);
    expect(signal.currency).toBe('INR');
    expect(signal.ctaType).toBe('ADD_TO_CART');
  });

  it('does not flag a page that only mentions a price in passing', () => {
    // A blog post quoting a competitor's price is not a product page — one
    // weak signal alone must not be enough, or every article about pricing
    // pollutes the catalog.
    const signal = detect({
      url: 'https://x.com/blog/why-fruit-pulp-costs-more-this-year',
      bodyText: 'Last year a tin cost about ₹300; this year it is closer to ₹349 across most suppliers.',
      pageTypeIsProduct: false,
    });

    expect(signal.isProductPage).toBe(false);
  });

  it('does not flag a page that only has a CTA with no price anywhere', () => {
    const signal = detect({
      url: 'https://x.com/contact',
      bodyText: 'Have a question? Enquire now and our team will get back to you.',
      pageTypeIsProduct: false,
    });

    expect(signal.isProductPage).toBe(false);
  });

  it('accepts the URL-path classifier\'s vote combined with just one weaker signal', () => {
    // classifyPageType already said PRODUCT from the URL; a lone price
    // mention or a lone CTA is corroboration enough once that vote is in.
    const signal = detect({
      bodyText: 'Alphonso Mango Pulp — 850g Tin. Add to cart.',
      pageTypeIsProduct: true,
    });

    expect(signal.isProductPage).toBe(true);
    expect(signal.priceStatus).toBe('NOT_PUBLISHED');
  });

  it('recognises Rs., USD and EUR alongside the symbol forms', () => {
    expect(detect({ bodyText: 'Rs. 1,299 — Add to cart' }).currency).toBe('INR');
    expect(detect({ bodyText: '$49.99 — Buy now' }).currency).toBe('USD');
    expect(detect({ bodyText: 'EUR 89 — Buy now' }).currency).toBe('EUR');
  });

  it('ignores a bare number with no currency marker', () => {
    // Otherwise a word count or a phone number becomes a price.
    const signal = detect({ bodyText: '2,499 people ordered this last month. Add to cart.' });
    expect(signal.priceStatus).toBe('NOT_PUBLISHED');
    expect(signal.isProductPage).toBe(false);
  });
});

describe('detectProductSignals — category fallback from the URL', () => {
  it('takes the segment before the product slug when JSON-LD gives no category', () => {
    const signal = detect({ url: 'https://x.com/shop/frozen-fruits/mango-puree', bodyText: '₹249 Add to cart' });
    expect(signal.category).toBe('Frozen Fruits');
  });

  it('skips a purely routing segment like "products" and falls back to null', () => {
    const signal = detect({ url: 'https://x.com/products/mango-pulp', bodyText: '₹249 Add to cart' });
    expect(signal.category).toBeNull();
  });
});

describe('completenessScore', () => {
  it('is 1 when every field carries a real value', () => {
    expect(
      completenessScore({ name: 'Mango Pulp', priceStatus: 'FOUND', currency: 'INR', stockStatus: 'FOUND', category: 'Fruit Pulp' }),
    ).toBe(1);
  });

  it('counts NOT_PUBLISHED as unpopulated, not as a value', () => {
    expect(completenessScore({ name: 'Mango Pulp', priceStatus: 'NOT_PUBLISHED', currency: null, stockStatus: 'NOT_PUBLISHED', category: null })).toBe(
      0.2,
    );
  });

  it('is 0 for a row with nothing at all', () => {
    expect(completenessScore({ name: null, priceStatus: 'NOT_PUBLISHED', currency: null, stockStatus: 'NOT_PUBLISHED', category: null })).toBe(0);
  });
});

/**
 * Only ever read for a competitor row — Catalog (Them) shows this next to
 * every result because a competitor's HTML was never built for us to parse.
 */
describe('matchConfidence', () => {
  it('trusts schema.org markup almost outright', () => {
    expect(matchConfidence({ hasProductSchema: true, priceStatus: 'NOT_PUBLISHED', ctaType: null })).toBe(0.95);
  });

  it('scores the regex-plus-CTA inference lower than a direct claim by the site', () => {
    expect(matchConfidence({ hasProductSchema: false, priceStatus: 'FOUND', ctaType: 'ADD_TO_CART' })).toBe(0.65);
  });

  it('scores lowest when the corroboration came from the URL-path vote rather than the page itself', () => {
    expect(matchConfidence({ hasProductSchema: false, priceStatus: 'NOT_PUBLISHED', ctaType: 'ENQUIRE' })).toBe(0.4);
  });
});
