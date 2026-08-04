import { detectCitation, normalizeDomain } from './citation-detector';

const OWN = ['northwindoutdoors.com'];
const COMPETITORS = ['trailheadco.com', 'summitgrove.com'];

function detect(answer: string, overrides: Partial<Parameters<typeof detectCitation>[0]> = {}) {
  return detectCitation({ answer, ownDomains: OWN, competitors: COMPETITORS, ...overrides });
}

describe('normalizeDomain', () => {
  it.each([
    ['https://www.Acme.com/path?q=1', 'acme.com'],
    ['HTTP://acme.com', 'acme.com'],
    ['www.acme.com', 'acme.com'],
    ['acme.com:443', 'acme.com'],
    ['  acme.com  ', 'acme.com'],
  ])('normalizes %s', (input, expected) => {
    expect(normalizeDomain(input)).toBe(expected);
  });
});

describe('detectCitation', () => {
  describe('finding the customer', () => {
    it('detects a bare domain mention', () => {
      const result = detect('I would look at northwindoutdoors.com for insulated jackets.');
      expect(result.cited).toBe(true);
      expect(result.position).toBe(1);
    });

    it('detects the brand name derived from the domain', () => {
      expect(detect('Northwindoutdoors makes a solid winter shell.').cited).toBe(true);
    });

    it('detects an explicitly supplied brand spelling', () => {
      const result = detect('Northwind Outdoors makes a solid winter shell.', {
        ownBrandNames: ['Northwind Outdoors'],
      });
      expect(result.cited).toBe(true);
    });

    it('counts a subdomain as the customer', () => {
      expect(detect('See shop.northwindoutdoors.com for stock.').cited).toBe(true);
    });

    it('is case-insensitive', () => {
      expect(detect('Try NorthwindOutdoors.COM').cited).toBe(true);
    });

    it('reports not-cited when the answer never mentions them', () => {
      const result = detect('For winter hiking, layering matters more than any single brand.');
      expect(result).toEqual({ cited: false, position: null, citedUrl: null, competitorsCited: [] });
    });

    it('does not match a different domain that merely ends with theirs', () => {
      expect(detect('Check notnorthwindoutdoors.com instead.').cited).toBe(false);
    });

    it('does not match the brand inside a longer word', () => {
      expect(detect('The northwindoutdoorsy crowd disagrees.').cited).toBe(false);
    });

    it('returns not-cited for an empty answer', () => {
      expect(detect('   ').cited).toBe(false);
    });

    it('returns not-cited when no own domain is configured', () => {
      expect(detect('northwindoutdoors.com is great', { ownDomains: [] }).cited).toBe(false);
    });
  });

  describe('position among brands', () => {
    it('ranks the customer first when named first', () => {
      const result = detect('Northwindoutdoors.com is the best pick, though trailheadco.com is cheaper.');
      expect(result.position).toBe(1);
    });

    it('ranks the customer second when a competitor leads', () => {
      const result = detect('Trailheadco.com leads here. Northwindoutdoors.com is a close second.');
      expect(result.position).toBe(2);
      expect(result.competitorsCited).toEqual(['trailheadco.com']);
    });

    it('ranks third behind two competitors', () => {
      const result = detect(
        'Start with trailheadco.com, then summitgrove.com, and northwindoutdoors.com is also worth a look.',
      );
      expect(result.position).toBe(3);
      expect(result.competitorsCited).toEqual(['trailheadco.com', 'summitgrove.com']);
    });

    it('ranks by first mention, not by how often a brand appears', () => {
      const result = detect(
        'Northwindoutdoors.com is my pick. Trailheadco.com is fine. Trailheadco.com again. And trailheadco.com.',
      );
      expect(result.position).toBe(1);
    });
  });

  describe('competitors', () => {
    it('lists competitors even when the customer is absent', () => {
      const result = detect('Most people buy from trailheadco.com or summitgrove.com.');
      expect(result.cited).toBe(false);
      expect(result.competitorsCited).toEqual(['trailheadco.com', 'summitgrove.com']);
    });

    it('never counts a customer domain as a competitor', () => {
      const result = detect('northwindoutdoors.com is great', {
        competitors: ['northwindoutdoors.com', 'trailheadco.com'],
      });
      expect(result.competitorsCited).toEqual([]);
      expect(result.position).toBe(1);
    });

    it('deduplicates repeated competitor mentions', () => {
      const result = detect('trailheadco.com, and again trailheadco.com, plus northwindoutdoors.com');
      expect(result.competitorsCited).toEqual(['trailheadco.com']);
    });
  });

  describe('cited URL extraction', () => {
    it('captures a deep link on the customer domain', () => {
      const result = detect('See https://northwindoutdoors.com/guides/insulated-jackets for details.');
      expect(result.citedUrl).toBe('https://northwindoutdoors.com/guides/insulated-jackets');
    });

    it('strips sentence punctuation from the end of a URL', () => {
      const result = detect('Read https://northwindoutdoors.com/journal/merino.');
      expect(result.citedUrl).toBe('https://northwindoutdoors.com/journal/merino');
    });

    it('handles www and subdomains', () => {
      const result = detect('Buy at https://www.shop.northwindoutdoors.com/tents');
      expect(result.citedUrl).toBe('https://www.shop.northwindoutdoors.com/tents');
    });

    it('ignores competitor URLs', () => {
      const result = detect('Compare https://trailheadco.com/x with northwindoutdoors.com.');
      expect(result.cited).toBe(true);
      expect(result.citedUrl).toBeNull();
    });

    it('is null when the brand is named without a link', () => {
      expect(detect('Northwindoutdoors is a good option.').citedUrl).toBeNull();
    });

    it('does not throw on malformed URLs', () => {
      expect(() => detect('see http://[not a url northwindoutdoors.com')).not.toThrow();
    });
  });

  describe('realistic answers', () => {
    it('handles a markdown comparison answer', () => {
      const answer = [
        'Here are the best insulated jackets for winter hiking:',
        '',
        '1. **Trailhead Co** — [Alpine Parka](https://trailheadco.com/alpine) — warmest overall.',
        '2. **Northwind Outdoors** — see https://northwindoutdoors.com/guides/insulated-jackets — best value.',
        '3. **Summit Grove** — lightweight but pricey.',
      ].join('\n');

      expect(
        detect(answer, {
          ownBrandNames: ['Northwind Outdoors'],
          competitors: [
            { domain: 'trailheadco.com', names: ['Trailhead Co'] },
            { domain: 'summitgrove.com', names: ['Summit Grove'] },
          ],
        }),
      ).toEqual({
        cited: true,
        position: 2,
        citedUrl: 'https://northwindoutdoors.com/guides/insulated-jackets',
        competitorsCited: ['trailheadco.com', 'summitgrove.com'],
      });
    });

    it('misses a spaced brand name when no label is configured', () => {
      // Documents a real limitation: "Summit Grove" cannot be derived from
      // "summitgrove.com", so CompetitorDomain.label has to be set for it.
      const answer = 'Summit Grove is the pick, ahead of northwindoutdoors.com.';
      expect(detect(answer).competitorsCited).toEqual([]);
      expect(detect(answer, { competitors: [{ domain: 'summitgrove.com', names: ['Summit Grove'] }] })
        .competitorsCited).toEqual(['summitgrove.com']);
    });
  });
});
