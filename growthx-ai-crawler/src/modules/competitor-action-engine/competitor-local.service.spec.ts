import { CompetitorLocalService, bestMatch, searchQueryFor } from './competitor-local.service';

describe('searchQueryFor', () => {
  it('prefers the Maps name and adds the city when it is not already there', () => {
    expect(searchQueryFor({ mapsName: 'Country Delight', city: 'Mumbai' })).toBe('Country Delight Mumbai');
    expect(searchQueryFor({ mapsName: 'Country Delight Mumbai', city: 'Mumbai' })).toBe(
      'Country Delight Mumbai',
    );
  });

  it('falls back to the business name when no Maps name was given', () => {
    expect(searchQueryFor({ name: 'Acme Dairy', city: 'Pune' })).toBe('Acme Dairy Pune');
  });

  it('searches nothing rather than searching a domain', () => {
    // A domain is a poor local query and matches the wrong shop confidently.
    expect(searchQueryFor({ city: 'Pune' })).toBeNull();
    expect(searchQueryFor({})).toBeNull();
  });
});

describe('bestMatch', () => {
  const place = (name: string) => ({ placeId: `p_${name}`, name });

  it('matches a listing that shares the distinctive words', () => {
    const result = bestMatch([place('Country Delight - Mumbai')], 'Country Delight');
    expect(result?.name).toContain('Country Delight');
  });

  it('refuses a near-miss rather than attaching the wrong business', () => {
    // Storing a stranger's reviews under a competitor's name corrupts every
    // comparison built on it, and is far harder to notice than a blank.
    expect(bestMatch([place('Delight Sweets & Bakery')], 'Country Delight')).toBeNull();
    expect(bestMatch([place('Amul Parlour')], 'Country Delight')).toBeNull();
  });

  it('skips a wrong first result to reach the right one', () => {
    // Google ranks by its own relevance, which is often not ours.
    const result = bestMatch([place('Sagar Ratna'), place('Country Delight Andheri')], 'Country Delight');
    expect(result?.name).toBe('Country Delight Andheri');
  });

  it('ignores corporate boilerplate when comparing names', () => {
    const result = bestMatch([place('Sarda Farms Private Limited')], 'Sarda Farms Pvt Ltd');
    expect(result).not.toBeNull();
  });

  it('needs every distinctive word for a one-word brand', () => {
    expect(bestMatch([place('Amul Ice Cream Parlour')], 'Amul')).not.toBeNull();
    expect(bestMatch([place('Gokul Dairy')], 'Amul')).toBeNull();
  });

  it('returns nothing when there is nothing to match on', () => {
    expect(bestMatch([place('Anything')], '')).toBeNull();
    expect(bestMatch([], 'Country Delight')).toBeNull();
  });
});

describe('CompetitorLocalService', () => {
  let prisma: any;
  let localSeo: any;
  let service: CompetitorLocalService;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, GOOGLE_PLACES_API_KEY: 'a-real-looking-places-key-1234567890' };
    prisma = {
      competitorDomain: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'c1', name: 'Country Delight', label: null, domain: 'countrydelight.in', mapsName: 'Country Delight', city: 'Mumbai' },
        ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    localSeo = {
      searchBusiness: jest.fn().mockResolvedValue([
        { placeId: 'place_1', name: 'Country Delight Mumbai', address: 'Andheri, Mumbai', rating: 4.3, userRatingsTotal: 812 },
      ]),
    };
    service = new CompetitorLocalService(prisma, localSeo);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('stores the matched listing against the competitor', async () => {
    const result = await service.refreshProject('p1');

    expect(result).toEqual({ checked: 1, matched: 1 });
    const written = prisma.competitorDomain.update.mock.calls[0][0].data;
    expect(written.placeId).toBe('place_1');
    expect(written.localReviewCount).toBe(812);
    expect(written.localRating).toBe(4.3);
    expect(written.localCheckedAt).toBeInstanceOf(Date);
  });

  it('writes nothing when no listing confidently matches', async () => {
    localSeo.searchBusiness.mockResolvedValue([{ placeId: 'x', name: 'Completely Different Shop' }]);

    const result = await service.refreshProject('p1');

    expect(result.matched).toBe(0);
    expect(prisma.competitorDomain.update).not.toHaveBeenCalled();
  });

  it('says the capability is off rather than reporting zero matches', async () => {
    // "0 of 3 matched" and "we never looked" need opposite responses.
    delete process.env.GOOGLE_PLACES_API_KEY;

    const result = await service.refreshProject('p1');

    expect(result.skippedReason).toContain('GOOGLE_PLACES_API_KEY');
    expect(localSeo.searchBusiness).not.toHaveBeenCalled();
  });

  it('keeps going when one competitor lookup fails', async () => {
    prisma.competitorDomain.findMany.mockResolvedValue([
      { id: 'c1', name: 'A', mapsName: 'A Dairy', city: 'Pune', domain: 'a.com', label: null },
      { id: 'c2', name: 'B', mapsName: 'B Dairy', city: 'Pune', domain: 'b.com', label: null },
    ]);
    localSeo.searchBusiness
      .mockRejectedValueOnce(new Error('quota exceeded'))
      .mockResolvedValueOnce([{ placeId: 'p2', name: 'B Dairy Pune', rating: 4, userRatingsTotal: 10 }]);

    const result = await service.refreshProject('p1');

    expect(result.checked).toBe(2);
    expect(result.matched).toBe(1);
  });

  it('skips a competitor with nothing searchable', async () => {
    prisma.competitorDomain.findMany.mockResolvedValue([
      { id: 'c1', name: null, label: null, mapsName: null, city: 'Pune', domain: 'a.com' },
    ]);

    const result = await service.refreshProject('p1');

    expect(result.checked).toBe(0);
    expect(localSeo.searchBusiness).not.toHaveBeenCalled();
  });
});
