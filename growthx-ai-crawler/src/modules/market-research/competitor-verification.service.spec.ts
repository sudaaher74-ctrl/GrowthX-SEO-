import axios from 'axios';
import { CompetitorVerificationService, VerifiableCompetitor } from './competitor-verification.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function candidate(overrides: Partial<VerifiableCompetitor> = {}): VerifiableCompetitor {
  return {
    domain: 'sahyadrifarms.com',
    name: 'Sahyadri Farms',
    industry: 'Fruit Processing',
    description: 'Farmer collective processing mango and guava pulp',
    overlapScore: 95,
    marketPosition: 'Market Leader',
    location: 'Nashik, Maharashtra',
    sampleKeywords: ['mango pulp exporter'],
    keyDifferentiator: 'Farmer supply chain',
    ...overrides,
  };
}

/** A live page whose copy mentions the client's market. */
function page(body: string, title = 'Sahyadri Farms — Fruit Pulp & Purees') {
  return {
    status: 200,
    data: `<html><head><title>${title}</title></head><body>${body}</body></html>`,
  };
}

const NICHE = 'Fruit pulp, aseptic mango puree, concentrates and IQF processing for bulk export';

describe('CompetitorVerificationService', () => {
  let service: CompetitorVerificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new CompetitorVerificationService();
  });

  it('keeps a competitor whose live site is reachable and talks about the same market', async () => {
    mockedAxios.get.mockResolvedValue(
      page('We are one of India\'s largest processors of aseptic mango pulp and IQF frozen fruit. '.repeat(6)),
    );

    const outcome = await service.verify([candidate()], 'aivaenterprises.com', NICHE);

    expect(outcome.verified).toHaveLength(1);
    expect(outcome.verified[0].verified).toBe(true);
    expect(outcome.verified[0].verifiedTitle).toContain('Sahyadri Farms');
    expect(outcome.verified[0].matchedTerms.length).toBeGreaterThan(0);
    expect(outcome.rejected).toHaveLength(0);
  });

  it('drops an invented domain that does not resolve', async () => {
    mockedAxios.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND marketpulse.in'));

    const outcome = await service.verify(
      [candidate({ domain: 'marketpulse.in', name: 'MarketPulse' })],
      'aivaenterprises.com',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected[0].reason).toBe('offline');
  });

  it('drops a parked domain that a model guessed from a brand name', async () => {
    mockedAxios.get.mockResolvedValue(
      page('This domain is for sale. Buy this domain today from our registrar. '.repeat(6), 'sugarcane.com'),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'sugarcane.com', name: 'Sugarcane' })],
      'aivaenterprises.com',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected[0].reason).toBe('parked');
  });

  it('drops a live site that has nothing to do with the client market', async () => {
    mockedAxios.get.mockResolvedValue(
      page(
        'We build enterprise networking hardware and carrier-grade routers for telecom operators. '.repeat(6),
        'Cisco Systems — Networking, Cloud and Cybersecurity',
      ),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'cisco.com', name: 'Cisco' })],
      'aivaenterprises.com',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected[0].reason).toBe('off_niche');
  });

  it('returns one row per company when the same competitor is proposed twice', async () => {
    mockedAxios.get.mockResolvedValue(page('Aseptic mango pulp and fruit puree processing. '.repeat(8)));

    const outcome = await service.verify(
      [
        candidate({ domain: 'sugarcane.com', name: 'Sugarcane' }),
        candidate({ domain: 'sugarcane.com', name: 'Sugarcane' }),
        candidate({ domain: 'www.sugarcane.com', name: 'Sugarcane Foods' }),
      ],
      'aivaenterprises.com',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(1);
    expect(outcome.rejected.filter((r) => r.reason === 'duplicate')).toHaveLength(2);
  });

  it('rejects placeholders, the client itself, and non-competitors without a network call', async () => {
    const outcome = await service.verify(
      [
        candidate({ domain: 'example.com', name: 'Example' }),
        candidate({ domain: 'aivaenterprises.com', name: 'AIVA' }),
        candidate({ domain: 'indiamart.com', name: 'IndiaMART' }),
      ],
      'aivaenterprises.com',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected.map((r) => r.reason).sort()).toEqual([
      'not_a_competitor',
      'placeholder',
      'self',
    ]);
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('keeps a large brand whose WAF answers a bot with 403', async () => {
    // Amul, Nestlé and most consumer brands refuse a non-browser client. A
    // refusal still proves a server is there, which a fabricated domain never
    // manages — dropping these was deleting the best-known names in the market.
    mockedAxios.get.mockResolvedValue({ status: 403, data: 'Access denied' });

    const outcome = await service.verify(
      [candidate({ domain: 'milkbasket.com', name: 'Milkbasket' })],
      'milquufresh.in',
      NICHE,
    );

    expect(outcome.rejected).toHaveLength(0);
    expect(outcome.verified).toHaveLength(1);
    expect(outcome.verified[0].verificationLevel).toBe('reachable');
  });

  it('still drops a domain whose every address refuses to connect', async () => {
    mockedAxios.get.mockRejectedValue(new Error('getaddrinfo ENOTFOUND nowhere.in'));

    const outcome = await service.verify(
      [candidate({ domain: 'nowhere.in', name: 'Nowhere Dairy' })],
      'milquufresh.in',
      NICHE,
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected[0].reason).toBe('offline');
  });

  it('reads a single-page app that only describes itself in its head and JSON-LD', async () => {
    mockedAxios.get.mockResolvedValue({
      status: 200,
      data:
        '<html><head><title>Country Delight</title>' +
        '<meta name="description" content="Farm fresh milk delivered to your doorstep every morning.">' +
        '<script type="application/ld+json">{"@type":"Organization","name":"Country Delight",' +
        '"description":"Daily milk and dairy subscriptions delivered to the doorstep."}</script>' +
        '</head><body><div id="root"></div></body></html>',
    });

    const outcome = await service.verify(
      [candidate({ domain: 'countrydelight.in', name: 'Country Delight' })],
      'milquufresh.in',
      'Dairy, fresh milk delivery and daily milk subscriptions',
    );

    expect(outcome.rejected).toHaveLength(0);
    expect(outcome.verified[0].verificationLevel).toBe('content');
    expect(outcome.verified[0].matchedTerms).toContain('milk');
  });

  it('matches a niche word against the inflection a real site writes', async () => {
    // "dairy" on the client's side, "dairies" on the competitor's page.
    mockedAxios.get.mockResolvedValue(
      page(
        'One of the largest cooperative dairies in western India, collecting from 200,000 farmers. '.repeat(4),
        'Gokul — Kolhapur Zilla Sahakari Dudh Utpadak Sangh',
      ),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'gokulmilk.coop', name: 'Gokul Milk' })],
      'milquufresh.in',
      'Dairy products and doorstep delivery',
    );

    expect(outcome.verified).toHaveLength(1);
    expect(outcome.verified[0].matchedTerms).toContain('dairy');
  });

  it('drops a company that sells the same thing on another continent', async () => {
    // Selling milk in Wisconsin is not competing with a milk round in Pune.
    // Nothing downstream used to disagree, so an Indian client was shown
    // whoever the model knew best — which is usually American.
    mockedAxios.get.mockResolvedValue(
      page(
        'Organic whole milk delivered across the Midwest. Pay $4.99 per half gallon. '.repeat(5),
        'Prairie Creamery — Organic Milk Delivery',
      ),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'prairiecreamery.com', name: 'Prairie Creamery' })],
      'milquufresh.in',
      'Milk delivery and dairy subscriptions',
      'india',
    );

    expect(outcome.verified).toHaveLength(0);
    expect(outcome.rejected[0].reason).toBe('off_region');
  });

  it('keeps a competitor that trades in the client\'s country', async () => {
    mockedAxios.get.mockResolvedValue(
      page(
        'Fresh cow milk delivered every morning across Pune and Mumbai. Subscribe from \u20b9 70 per litre. '.repeat(4),
        'Sarda Farms — Farm to Home Milk',
      ),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'sardafarms.com', name: 'Sarda Farms' })],
      'milquufresh.in',
      'Milk delivery and dairy subscriptions',
      'maharashtra',
    );

    expect(outcome.rejected).toHaveLength(0);
    expect(outcome.verified).toHaveLength(1);
  });

  it('accepts a national brand for a state-level scope', async () => {
    // Amul is registered in Gujarat and sells on every street in Pune.
    // Narrowing Maharashtra to the state would drop the rival that matters most.
    mockedAxios.get.mockResolvedValue(
      page('Milk, butter and dairy sold across India since 1946. '.repeat(5), 'Amul — The Taste of India'),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'amul.com', name: 'Amul' })],
      'milquufresh.in',
      'Milk and dairy products',
      'maharashtra',
    );

    expect(outcome.verified).toHaveLength(1);
  });

  it('does not apply the geography test to a worldwide scope', async () => {
    mockedAxios.get.mockResolvedValue(
      page('Organic whole milk delivered across the Midwest. '.repeat(5), 'Prairie Creamery'),
    );

    const outcome = await service.verify(
      [candidate({ domain: 'prairiecreamery.com', name: 'Prairie Creamery' })],
      'globaldairy.com',
      'Milk delivery and dairy subscriptions',
      'worldwide',
    );

    expect(outcome.verified).toHaveLength(1);
  });

  it('does not apply the relevance test when the niche is too vague to judge on', async () => {
    mockedAxios.get.mockResolvedValue(page('An established company serving customers since 1994. '.repeat(6)));

    const outcome = await service.verify([candidate()], 'aivaenterprises.com', 'services');

    expect(outcome.verified).toHaveLength(1);
  });
});
