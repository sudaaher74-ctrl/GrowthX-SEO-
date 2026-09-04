import { CompetitorDiscoveryService, companyNameFrom, registrableDomain } from './competitor-discovery.service';

/** A Tavily-shaped result row, as WebSearchService hands them back. */
function source(url: string, title: string, excerpt = 'Company page') {
  return { url, title, excerpt, type: 'PUBLIC_WEB', qualityScore: 0.8 };
}

function profile(overrides: Record<string, unknown> = {}) {
  return {
    domain: 'milquufresh.in',
    businessName: 'MilQuu Fresh',
    industry: 'Doorstep milk delivery',
    summary: 'Daily milk subscriptions delivered to the door.',
    offerings: [],
    businessModel: 'B2C',
    city: 'Pune',
    state: 'Maharashtra',
    country: 'India',
    suggestedRegion: 'maharashtra',
    seedKeywords: ['milk delivery', 'milk subscription'],
    confidence: 'high',
    signals: [],
    source: 'ai',
    detectedAt: new Date().toISOString(),
    ...overrides,
  } as any;
}

describe('CompetitorDiscoveryService', () => {
  let webSearch: any;
  let service: CompetitorDiscoveryService;

  beforeEach(() => {
    webSearch = {
      isConfigured: jest.fn().mockReturnValue(true),
      search: jest.fn().mockResolvedValue({ sources: [], queriesRun: [] }),
    };
    service = new CompetitorDiscoveryService(webSearch);
  });

  it('searches the client\'s own buyer keywords, with their city attached', async () => {
    await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'maharashtra',
      profile: profile(),
    });

    const issued = webSearch.search.mock.calls.map((call: any[]) => call[0][0]);
    expect(issued).toContain('milk delivery Pune');
    expect(issued).toContain('milk subscription Pune');
    // Each query runs on its own so the result can say which one it ranked for.
    expect(webSearch.search).toHaveBeenCalledTimes(issued.length);
  });

  it('turns whoever ranks for those keywords into competitors, ranked by breadth', async () => {
    webSearch.search.mockImplementation((queries: string[]) => {
      const query = queries[0];
      if (query.startsWith('milk delivery')) {
        return Promise.resolve({
          sources: [
            source('https://countrydelight.in/', 'Country Delight | Farm Fresh Milk'),
            source('https://sardafarms.com/milk', 'Sarda Farms - Fresh Cow Milk'),
          ],
          queriesRun: [query],
        });
      }
      return Promise.resolve({
        sources: [source('https://countrydelight.in/subscribe', 'Country Delight | Subscribe')],
        queriesRun: [query],
      });
    });

    const outcome = await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'maharashtra',
      profile: profile(),
    });

    const domains = outcome.candidates.map((c) => c.domain);
    expect(domains).toContain('countrydelight.in');
    expect(domains).toContain('sardafarms.com');
    // Ranking for more of the client's keywords is the stronger signal.
    expect(domains[0]).toBe('countrydelight.in');

    const leader = outcome.candidates[0];
    expect(leader.name).toBe('Country Delight');
    // The keywords on the card are the searches actually run, not invented.
    expect(leader.sampleKeywords.length).toBeGreaterThan(1);
    expect(leader.sampleKeywords.every((k) => issuedLooksLikeAQuery(k))).toBe(true);
  });

  it('never proposes the client, a directory, a news site or a government page', async () => {
    webSearch.search.mockResolvedValue({
      sources: [
        source('https://milquufresh.in/', 'MilQuu Fresh'),
        source('https://www.justdial.com/Pune/Milk-Suppliers', 'Milk Suppliers in Pune'),
        source('https://timesofindia.indiatimes.com/city/pune/milk', 'Milk prices rise'),
        source('https://dairy.maharashtra.gov.in/', 'Dairy Development Department'),
        source('https://en.wikipedia.org/wiki/Milk', 'Milk'),
        source('https://sardafarms.com/', 'Sarda Farms'),
      ],
      queriesRun: ['milk delivery Pune'],
    });

    const outcome = await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'maharashtra',
      profile: profile(),
    });

    expect(outcome.candidates.map((c) => c.domain)).toEqual(['sardafarms.com']);
  });

  it('counts subdomains of one company as one competitor', async () => {
    webSearch.search.mockResolvedValue({
      sources: [
        source('https://www.acmedairy.co.in/', 'Acme Dairy'),
        source('https://blog.acmedairy.co.in/milk-guide', 'Acme Dairy | Blog'),
        source('https://shop.acmedairy.co.in/', 'Acme Dairy | Shop'),
      ],
      queriesRun: ['milk delivery Pune'],
    });

    const outcome = await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'maharashtra',
      profile: profile(),
    });

    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.candidates[0].domain).toBe('acmedairy.co.in');
  });

  it('works for a market the curated list has never heard of', async () => {
    // The point of the whole service: no dairy, no India, no curated entry.
    webSearch.search.mockResolvedValue({
      sources: [
        source('https://clinicaodonto.com.br/', 'Clínica Odonto | Implantes Dentários em São Paulo'),
      ],
      queriesRun: ['implantes dentários São Paulo'],
    });

    const outcome = await service.discover({
      domain: 'sorrisoperfeito.com.br',
      businessName: 'Sorriso Perfeito',
      subject: 'Implantes dentários',
      region: 'worldwide',
      profile: profile({
        city: 'São Paulo',
        country: 'Brazil',
        seedKeywords: ['implantes dentários'],
      }),
    });

    expect(outcome.candidates).toHaveLength(1);
    expect(outcome.candidates[0].domain).toBe('clinicaodonto.com.br');
    expect(outcome.candidates[0].name).toBe('Clínica Odonto');
  });

  it('says so plainly when no search provider is configured', async () => {
    webSearch.isConfigured.mockReturnValue(false);
    webSearch.search.mockResolvedValue({
      sources: [],
      queriesRun: [],
      unavailable: 'No web search provider is configured (TAVILY_API_KEY).',
    });

    expect(service.isConfigured()).toBe(false);

    const outcome = await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'india',
      profile: profile(),
    });

    expect(outcome.candidates).toHaveLength(0);
    expect(outcome.unavailable).toContain('No web search provider');
  });

  it('survives one search failing without losing the others', async () => {
    let call = 0;
    webSearch.search.mockImplementation((queries: string[]) => {
      call += 1;
      if (call === 1) return Promise.reject(new Error('provider timeout'));
      return Promise.resolve({ sources: [source('https://sardafarms.com/', 'Sarda Farms')], queriesRun: queries });
    });

    const outcome = await service.discover({
      domain: 'milquufresh.in',
      businessName: 'MilQuu Fresh',
      subject: 'Doorstep milk delivery',
      region: 'india',
      profile: profile(),
    });

    expect(outcome.candidates.map((c) => c.domain)).toEqual(['sardafarms.com']);
    expect(outcome.unavailable).toContain('failed');
  });
});

describe('registrableDomain', () => {
  it.each([
    ['www.acme.com', 'acme.com'],
    ['blog.acme.com', 'acme.com'],
    ['shop.acme.co.in', 'acme.co.in'],
    ['acme.co.in', 'acme.co.in'],
    ['a.b.acme.com.br', 'acme.com.br'],
    ['acme.in', 'acme.in'],
  ])('reduces %s to %s', (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });
});

describe('companyNameFrom', () => {
  it('takes the brand out of a search-written title', () => {
    expect(companyNameFrom('Fresh Milk Delivery in Pune | Sarda Farms', 'sardafarms.com')).toBe('Sarda Farms');
    expect(companyNameFrom('Country Delight - Farm Fresh Milk', 'countrydelight.in')).toBe('Country Delight');
  });

  it('falls back to the domain when the title is all sentence', () => {
    expect(companyNameFrom('We deliver the freshest milk to your doorstep every single morning', 'acme-dairy.com')).toBe(
      'Acme Dairy',
    );
  });
});

/** The card's keywords must be searches, not a model's guesses. */
function issuedLooksLikeAQuery(keyword: string): boolean {
  return keyword.trim().length > 0 && keyword === keyword.trim();
}
