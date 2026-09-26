import { BusinessProfileInsightsService } from './business-profile-insights.service';
import { fakePrisma } from './business-profile.testing';
import { PlacesListing, PlacesListingService, PlacesSnapshot } from './places-listing.service';

/**
 * The public Maps listing standing in while Business Profile is locked.
 *
 * What matters is less that the listing is shown than what it is never
 * mistaken for: a response built from Places says so, keeps the connection
 * truthful, and gives way the moment Business Profile has delivered.
 */
describe('Places fallback for the Business Profile tabs', () => {
  const PROJECT = 'p1';
  const LOCATION = 'locations/12345';

  const listing: PlacesListing = {
    placeId: 'ChIJ-milk',
    name: 'Milqu Fresh',
    address: 'Sector 5, Panvel, Maharashtra 410206, India',
    shortAddress: 'Sector 5, Panvel',
    latitude: 18.99,
    longitude: 73.11,
    rating: 4.6,
    userRatingCount: 212,
    primaryType: 'dairy_store',
    primaryTypeDisplayName: 'Dairy store',
    types: [
      { type: 'dairy_store', displayName: 'Dairy store' },
      { type: 'grocery_store', displayName: 'Grocery store' },
    ],
    phone: '098765 43210',
    internationalPhone: '+91 98765 43210',
    website: 'https://milquufresh.in/',
    googleMapsUri: 'https://maps.google.com/?cid=1',
    businessStatus: 'OPERATIONAL',
    editorialSummary: null,
    hours: { weekdayDescriptions: ['Monday: 6:00 AM – 9:00 PM'], periods: [] },
    reviews: [
      {
        name: 'places/ChIJ-milk/reviews/a',
        authorName: 'Asha',
        authorPhotoUrl: null,
        authorUri: null,
        rating: 5,
        text: 'Fresh every morning.',
        publishTime: '2026-09-01T06:00:00Z',
        relativePublishTime: '3 weeks ago',
        googleMapsUri: null,
      },
    ],
    photos: [
      {
        name: 'places/ChIJ-milk/photos/x',
        widthPx: 1200,
        heightPx: 900,
        url: 'https://lh3.googleusercontent.com/x',
        attribution: 'Asha',
        attributionUri: null,
      },
    ],
  };

  const ready: PlacesSnapshot = {
    state: 'READY',
    placeId: listing.placeId,
    listing,
    fetchedAt: new Date('2026-09-26T08:00:00Z'),
    error: null,
    suggestedQuery: null,
  };

  function harness(integration: Record<string, any> | null, snapshot: PlacesSnapshot = ready) {
    const prisma = fakePrisma();
    if (integration) {
      prisma.integration.rows.push({
        id: 'i1',
        projectId: PROJECT,
        provider: 'business_profile',
        selectedResourceId: LOCATION,
        selectedResourceName: 'Milqu Fresh',
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: null,
        ...integration,
      });
    }
    const oauth = { configuration: () => ({ configured: true, missing: [] }) };
    const places = { snapshot: jest.fn().mockResolvedValue(snapshot) };
    const service = new BusinessProfileInsightsService(prisma as any, oauth as any, places as any);
    return { prisma, places, service };
  }

  const pendingApproval = {
    status: 'ERROR',
    statusMessage: 'Google refused this Business Profile request (403).',
  };

  it('fills the overview from the public listing while approval is pending', async () => {
    const { service } = harness(pendingApproval);
    const result: any = await service.overview(PROJECT);

    expect(result.dataSource).toBe('places');
    // The connection is still reported as it is: approval has not landed.
    expect(result.connection.state).toBe('ERROR');
    expect(result.profile).toMatchObject({
      businessName: 'Milqu Fresh',
      phone: '098765 43210',
      website: 'https://milquufresh.in/',
      primaryCategory: 'Dairy store',
      rating: 4.6,
      reviewCount: 212,
      hoursText: ['Monday: 6:00 AM – 9:00 PM'],
      // Places cannot see these, so they are not claimed either way.
      description: null,
      verified: null,
    });
    expect(result.completeness).toMatchObject({ present: 6, total: 6 });
  });

  it('reports the listing totals for reviews, not an average of the five shown', async () => {
    const { service } = harness(pendingApproval);
    const result: any = await service.reviews(PROJECT);

    expect(result.dataSource).toBe('places');
    expect(result.summary).toEqual({ total: 212, rated: 212, averageRating: 4.6, shown: 1 });
    // Places carries no owner replies, so nothing is said about them.
    expect(result.reviews[0]).toMatchObject({ googleReply: null, replyStatus: 'UNKNOWN' });
  });

  it('serves photos and categories from the listing', async () => {
    const { service } = harness(null);

    const photos: any = await service.photos(PROJECT);
    expect(photos.dataSource).toBe('places');
    expect(photos.connection.state).toBe('NOT_CONNECTED');
    expect(photos.photos[0]).toMatchObject({ url: 'https://lh3.googleusercontent.com/x', attribution: 'Asha' });

    const categories: any = await service.categories(PROJECT);
    expect(categories.primary).toEqual({ categoryId: 'dairy_store', displayName: 'Dairy store' });
    expect(categories.additional).toEqual([{ categoryId: 'grocery_store', displayName: 'Grocery store' }]);
  });

  it('never replaces data Business Profile has delivered, even an empty list', async () => {
    const synced = new Date('2026-09-20T00:00:00Z');
    const { prisma, places, service } = harness({ lastSyncedAt: synced });
    prisma.gbpSourceStatus.rows.push({
      projectId: PROJECT,
      locationName: LOCATION,
      source: 'media',
      state: 'OK',
      message: null,
      httpStatus: null,
      lastCount: 0,
      lastSuccessAt: synced,
    });

    const result: any = await service.photos(PROJECT);
    expect(result.dataSource).toBe('business_profile');
    expect(result.photos).toEqual([]);
    expect(places.snapshot).not.toHaveBeenCalled();
  });

  it('falls back for photos Google refused on an otherwise synced profile', async () => {
    // v4 media is routinely refused even after approval. The public photos
    // are better than a refusal notice, and are labelled as what they are.
    const synced = new Date('2026-09-20T00:00:00Z');
    const { prisma, service } = harness({ lastSyncedAt: synced });
    prisma.gbpSourceStatus.rows.push({
      projectId: PROJECT,
      locationName: LOCATION,
      source: 'media',
      state: 'UNAVAILABLE',
      message: 'Google refused this Business Profile request (403).',
      httpStatus: 403,
      lastCount: null,
      lastSuccessAt: null,
    });

    const result: any = await service.photos(PROJECT);
    expect(result.dataSource).toBe('places');
    expect(result.photos).toHaveLength(1);
  });

  it('tells the tab what to search for when no listing is attached', async () => {
    const { service } = harness(pendingApproval, {
      state: 'NO_PLACE',
      placeId: null,
      listing: null,
      fetchedAt: null,
      error: null,
      suggestedQuery: 'Milqu Fresh',
    });
    const result: any = await service.overview(PROJECT);

    expect(result.profile).toBeNull();
    expect(result.places).toMatchObject({ state: 'NO_PLACE', suggestedQuery: 'Milqu Fresh' });
  });

  it('does not fall back while the connection needs a fresh sign-in', async () => {
    const { places, service } = harness({ status: 'NEEDS_REAUTH' });
    const result: any = await service.overview(PROJECT);

    expect(result.profile).toBeNull();
    expect(places.snapshot).not.toHaveBeenCalled();
  });
});

describe('PlacesListingService', () => {
  const PROJECT = 'p1';
  const realFetch = global.fetch;
  const realKey = process.env.GOOGLE_PLACES_API_KEY;

  afterEach(() => {
    global.fetch = realFetch;
    if (realKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = realKey;
  });

  function prismaWith(placeId: string | null) {
    const snapshots: any[] = [];
    return {
      snapshots,
      localLocation: {
        findFirst: jest.fn().mockResolvedValue(placeId ? { placeId, latitude: 18.99, longitude: 73.11 } : null),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      integration: { findUnique: jest.fn().mockResolvedValue({ selectedResourceId: null, selectedResourceName: 'Milqu Fresh' }) },
      gbpLocationProfile: { findUnique: jest.fn().mockResolvedValue(null) },
      placesListingSnapshot: {
        findUnique: jest.fn(async () => snapshots[0] ?? null),
        upsert: jest.fn(async ({ update, create }: any) => {
          snapshots[0] = snapshots[0] ? { ...snapshots[0], ...update } : { ...create };
          return snapshots[0];
        }),
      },
    };
  }

  function respond(body: unknown, status = 200) {
    return { ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) };
  }

  it('says NO_PLACE, with a search to suggest, when nothing is attached', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    const service = new PlacesListingService(prismaWith(null) as any);
    const snapshot = await service.snapshot(PROJECT);

    expect(snapshot).toMatchObject({ state: 'NO_PLACE', suggestedQuery: 'Milqu Fresh' });
  });

  it('says NOT_CONFIGURED without an API key rather than failing', async () => {
    delete process.env.GOOGLE_PLACES_API_KEY;
    const service = new PlacesListingService(prismaWith('ChIJ-milk') as any);

    expect((await service.snapshot(PROJECT)).state).toBe('NOT_CONFIGURED');
  });

  it('reads the listing once, resolves photo URLs, and serves it from the snapshot after', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    const prisma = prismaWith('ChIJ-milk');
    const fetchMock = jest.fn(async (url: string) => {
      if (url.includes('/media')) return respond({ photoUri: 'https://lh3.googleusercontent.com/x' });
      return respond({
        id: 'ChIJ-milk',
        displayName: { text: 'Milqu Fresh' },
        rating: 4.6,
        userRatingCount: 212,
        primaryType: 'dairy_store',
        primaryTypeDisplayName: { text: 'Dairy store' },
        types: ['dairy_store', 'point_of_interest', 'establishment'],
        photos: [{ name: 'places/ChIJ-milk/photos/x', widthPx: 1200, heightPx: 900, authorAttributions: [{ displayName: 'Asha' }] }],
        reviews: [{ name: 'r1', rating: 5, originalText: { text: 'Fresh.' }, authorAttribution: { displayName: 'Asha' } }],
      });
    });
    global.fetch = fetchMock as any;

    const service = new PlacesListingService(prisma as any);
    const first = await service.snapshot(PROJECT);

    expect(first.state).toBe('READY');
    expect(first.listing).toMatchObject({
      rating: 4.6,
      userRatingCount: 212,
      // Generic types Google puts on everything are dropped.
      types: [{ type: 'dairy_store', displayName: 'Dairy store' }],
      photos: [{ url: 'https://lh3.googleusercontent.com/x', attribution: 'Asha' }],
      reviews: [{ authorName: 'Asha', rating: 5, text: 'Fresh.' }],
    });
    // The key goes in a header, never in a URL that could end up in a log.
    const detailsCall = fetchMock.mock.calls.find(([url]) => !String(url).includes('/media'))!;
    expect(String(detailsCall[0])).not.toContain('key=');
    expect(prisma.localLocation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ rating: 4.6, reviewCount: 212 }) }),
    );

    fetchMock.mockClear();
    const second = await service.snapshot(PROJECT);
    expect(second.state).toBe('READY');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the last good listing when a refresh fails, and says why', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    const prisma = prismaWith('ChIJ-milk');
    prisma.snapshots[0] = {
      data: { placeId: 'ChIJ-milk', name: 'Milqu Fresh', photos: [], reviews: [] },
      fetchedAt: new Date('2026-09-01T00:00:00Z'),
      lastError: null,
    };
    global.fetch = jest.fn(async () =>
      respond({ error: { message: 'Billing is not enabled', details: [{ reason: 'BILLING_DISABLED' }] } }, 403),
    ) as any;

    const service = new PlacesListingService(prisma as any);
    const snapshot = await service.refreshOnce(PROJECT);

    expect(snapshot.state).toBe('READY');
    expect(snapshot.listing?.name).toBe('Milqu Fresh');
    expect(snapshot.error).toContain('BILLING_DISABLED');
  });

  it('marks your own listing in competitor results, and reports no rank when absent', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'k';
    global.fetch = jest.fn(async () =>
      respond({
        places: [
          { id: 'rival', displayName: { text: 'Country Delight' }, rating: 4.2, userRatingCount: 900 },
          { id: 'ChIJ-milk', displayName: { text: 'Milqu Fresh' }, rating: 4.6, userRatingCount: 212 },
        ],
      }),
    ) as any;

    const found = await new PlacesListingService(prismaWith('ChIJ-milk') as any).competitors(PROJECT, 'milk delivery Panvel');
    expect(found.yourRank).toBe(2);
    expect(found.results.map((result) => result.isYou)).toEqual([false, true]);

    const absent = await new PlacesListingService(prismaWith('ChIJ-other') as any).competitors(PROJECT, 'milk delivery Panvel');
    expect(absent.yourRank).toBeNull();
  });
});
