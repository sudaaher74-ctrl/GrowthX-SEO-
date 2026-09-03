import axios from 'axios';
import { BusinessProfileService } from './business-profile.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Only the homepage answers; the /about probe 404s like most small sites. */
function siteServing(html: string) {
  return jest.fn().mockImplementation((url: string) => {
    if (/\/(about|products|services|what-we-do)/.test(url)) {
      return Promise.reject(new Error('404'));
    }
    return Promise.resolve({ data: html });
  });
}

const NASHIK_EXPORTER = `
  <html>
    <head>
      <title>AIVA Enterprises — Aseptic Mango Pulp &amp; IQF Fruit Exporter, Nashik</title>
      <meta name="description" content="Bulk supplier of alphonso and totapuri mango pulp, fruit concentrates and IQF frozen fruit." />
      <script type="application/ld+json">
        {"@type":"Organization","name":"AIVA Enterprises",
         "address":{"addressLocality":"Nashik","addressRegion":"Maharashtra","addressCountry":"India"}}
      </script>
    </head>
    <body><h1>Aseptic fruit pulp for bulk export</h1><p>IQF frozen mango dice and guava puree.</p></body>
  </html>
`;

describe('BusinessProfileService', () => {
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      projectBusinessProfile: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn().mockResolvedValue({}),
      },
    };
  });

  describe('without a model configured', () => {
    it('reads the niche and the market geography off the site, so no niche has to be picked', async () => {
      mockedAxios.get = siteServing(NASHIK_EXPORTER);
      const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

      const profile = await service.getProfile('p1', 'aivaenterprises.com');

      expect(profile.businessName).toBe('AIVA Enterprises');
      expect(profile.industry).toContain('Fruit Pulp');
      expect(profile.city).toBe('Nashik');
      expect(profile.state).toBe('Maharashtra');
      expect(profile.suggestedRegion).toBe('maharashtra');
      expect(profile.source).toBe('heuristic');
      expect(profile.seedKeywords.length).toBeGreaterThan(0);
    });

    it('names the business from its own title rather than a catch-all category', async () => {
      mockedAxios.get = siteServing(
        '<html><head><title>Deshmukh Falconry Restorations — Hand-stitched hoods and jesses</title></head><body><h1>Falconry equipment restored by hand</h1></body></html>',
      );
      const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

      const profile = await service.getProfile('p1', 'deshmukhfalconry.in');

      // The old code answered "Digital Products & Market Services" here, which
      // matched every unrecognised site and described none of them.
      expect(profile.industry).not.toContain('Digital Products & Market Services');
      expect(profile.industry.toLowerCase()).toContain('falconry');
      expect(profile.confidence).toBe('low');
    });

    it('falls back to the domain and records why when the site cannot be reached', async () => {
      mockedAxios.get = jest.fn().mockRejectedValue(new Error('ENOTFOUND'));
      const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

      const profile = await service.getProfile('p1', 'unreachable-site.in');

      expect(profile.businessName).toBe('Unreachable Site');
      expect(profile.confidence).toBe('low');
      expect(profile.signals.join(' ')).toContain('could not be reached');
      expect(profile.suggestedRegion).toBe('india');
    });
  });

  describe('with a model configured', () => {
    it('uses the model reading of the site and keeps the address it found', async () => {
      mockedAxios.get = siteServing(NASHIK_EXPORTER);
      const models = {
        isConfigured: () => true,
        generate: jest.fn().mockResolvedValue({
          text: JSON.stringify({
            businessName: 'AIVA Enterprises',
            industry: 'Aseptic mango pulp, fruit concentrates and IQF processing for bulk export',
            summary: 'A Nashik agro-exporter selling aseptic fruit pulp to beverage manufacturers.',
            offerings: ['Aseptic mango pulp', 'IQF frozen fruit'],
            businessModel: 'B2B',
            city: 'Nashik',
            state: 'Maharashtra',
            country: 'India',
            seedKeywords: ['aseptic mango pulp supplier', 'iqf frozen fruit exporter'],
            confidence: 'high',
          }),
        }),
      };
      const service = new BusinessProfileService(prisma, models as any);

      const profile = await service.getProfile('p1', 'aivaenterprises.com');

      expect(profile.source).toBe('ai');
      expect(profile.industry).toContain('Aseptic mango pulp');
      expect(profile.suggestedRegion).toBe('maharashtra');
      expect(profile.offerings).toContain('IQF frozen fruit');
      expect(prisma.projectBusinessProfile.upsert).toHaveBeenCalled();
    });

    it('falls back to heuristics when the model returns nothing usable', async () => {
      mockedAxios.get = siteServing(NASHIK_EXPORTER);
      const models = {
        isConfigured: () => true,
        generate: jest.fn().mockResolvedValue({ text: 'not json at all' }),
      };
      const service = new BusinessProfileService(prisma, models as any);

      const profile = await service.getProfile('p1', 'aivaenterprises.com');

      expect(profile.source).toBe('heuristic');
      expect(profile.industry).toContain('Fruit Pulp');
    });
  });

  it('reuses a cached profile instead of re-reading the site on every page load', async () => {
    prisma.projectBusinessProfile.findUnique.mockResolvedValue({
      domain: 'aivaenterprises.com',
      businessName: 'AIVA Enterprises',
      industry: 'Fruit Pulp & Agro Exports',
      summary: '',
      offerings: [],
      businessModel: '',
      city: 'Nashik',
      state: 'Maharashtra',
      country: 'India',
      suggestedRegion: 'maharashtra',
      seedKeywords: [],
      confidence: 'high',
      signals: [],
      source: 'ai',
      detectedAt: new Date(),
    });
    mockedAxios.get = jest.fn();
    const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

    const profile = await service.getProfile('p1', 'aivaenterprises.com');

    expect(profile.industry).toBe('Fruit Pulp & Agro Exports');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('re-reads the site when the project has moved to a different domain', async () => {
    prisma.projectBusinessProfile.findUnique.mockResolvedValue({
      domain: 'old-domain.com',
      businessName: 'Old Brand',
      industry: 'Something Else',
      suggestedRegion: 'worldwide',
      offerings: [],
      seedKeywords: [],
      signals: [],
      confidence: 'high',
      source: 'ai',
      detectedAt: new Date(),
    });
    mockedAxios.get = siteServing(NASHIK_EXPORTER);
    const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

    const profile = await service.getProfile('p1', 'aivaenterprises.com');

    expect(profile.domain).toBe('aivaenterprises.com');
    expect(profile.industry).toContain('Fruit Pulp');
  });

  it('stores an operator correction as the project profile', async () => {
    mockedAxios.get = siteServing(NASHIK_EXPORTER);
    const service = new BusinessProfileService(prisma, { isConfigured: () => false } as any);

    const profile = await service.overrideProfile('p1', 'aivaenterprises.com', {
      industry: 'Organic dried fruit and nut exports',
      region: 'india',
    });

    expect(profile.industry).toBe('Organic dried fruit and nut exports');
    expect(profile.suggestedRegion).toBe('india');
    expect(profile.confidence).toBe('high');
    expect(profile.signals).toContain('Confirmed by operator');
  });
});
