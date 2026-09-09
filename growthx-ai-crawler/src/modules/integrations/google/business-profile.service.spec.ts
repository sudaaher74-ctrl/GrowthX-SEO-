import { google } from 'googleapis';
import { BusinessProfileService } from './business-profile.service';
import { fakePrisma } from './business-profile.testing';

jest.mock('googleapis', () => ({
  google: {
    mybusinessaccountmanagement: jest.fn(),
    mybusinessbusinessinformation: jest.fn(),
    businessprofileperformance: jest.fn(),
  },
}));

/**
 * The Business Profile connector, exercised against the three things that
 * actually go wrong with it.
 *
 * Google gates these APIs behind an application review granted per Cloud
 * project, so a 403 is the *ordinary* answer on a fresh deployment. What that
 * turns into is the whole product decision: an error the operator can act on,
 * or eight tabs of confident zeroes. The first test is that one.
 *
 * The second is idempotency, checked against a store that enforces the
 * schema's unique constraints rather than a mock that counts calls — a mock
 * cannot tell a correctly keyed upsert from one keyed on nothing in
 * particular, which is the bug it would need to catch.
 *
 * The third is that a half-filled profile stays half-filled. Every fabricator
 * removed from this codebase started as a reasonable-looking default for a
 * field the source did not send.
 */
describe('BusinessProfileService', () => {
  const PROJECT = 'p1';
  const LOCATION = 'locations/12345';
  const ACCOUNT = 'accounts/999';

  /** A location as Google returns it, with everything filled in. */
  const fullLocation = {
    name: LOCATION,
    title: 'Bright Dental',
    storefrontAddress: { addressLines: ['12 High Street'], locality: 'Leeds', postalCode: 'LS1 1AA', regionCode: 'GB' },
    phoneNumbers: { primaryPhone: '+44 113 496 0000', additionalPhones: ['+44 113 496 0001'] },
    websiteUri: 'https://bright.example',
    profile: { description: 'A dental practice.' },
    categories: {
      primaryCategory: { name: 'gcid:dentist', displayName: 'Dentist' },
      additionalCategories: [{ name: 'gcid:orthodontist', displayName: 'Orthodontist' }],
    },
    regularHours: { periods: [{ openDay: 'MONDAY', openTime: { hours: 9 }, closeDay: 'MONDAY', closeTime: { hours: 17 } }] },
    serviceItems: [
      { structuredServiceItem: { serviceTypeId: 'job_type_id:teeth_whitening', description: 'Whitening' } },
      { freeFormServiceItem: { category: 'gcid:dentist', label: { displayName: 'Check-up' } }, price: { currencyCode: 'GBP', units: '40' } },
    ],
    metadata: { hasVoiceOfMerchant: true, placeId: 'ChIJabc', mapsUri: 'https://maps.example/1' },
    openInfo: { status: 'OPEN' },
    latlng: { latitude: 53.8, longitude: -1.55 },
  };

  function harness(options: {
    location?: any;
    locationError?: any;
    performance?: any;
    performanceError?: any;
    v4?: (path: string) => any;
  } = {}) {
    const prisma = fakePrisma();
    prisma.integration.rows.push({
      id: 'i1',
      projectId: PROJECT,
      provider: 'business_profile',
      selectedResourceId: LOCATION,
      status: 'CONNECTED',
      lastSyncedAt: null,
    });

    const oauth = {
      clientFor: jest.fn().mockResolvedValue({ getAccessToken: async () => ({ token: 'access-token' }) }),
      markNeedsReauth: jest.fn().mockResolvedValue(undefined),
      markError: jest.fn().mockResolvedValue(undefined),
      clearError: jest.fn().mockResolvedValue(undefined),
      configuration: () => ({ configured: true, missing: [] }),
    };

    (google.mybusinessaccountmanagement as jest.Mock).mockReturnValue({
      accounts: { list: jest.fn().mockResolvedValue({ data: { accounts: [{ name: ACCOUNT }] } }) },
    });

    (google.mybusinessbusinessinformation as jest.Mock).mockReturnValue({
      accounts: {
        locations: {
          list: jest.fn().mockResolvedValue({ data: { locations: [{ name: LOCATION, title: 'Bright Dental' }] } }),
        },
      },
      locations: {
        get: jest.fn(async () => {
          if (options.locationError) throw options.locationError;
          return { data: options.location ?? fullLocation };
        }),
        patch: jest.fn().mockResolvedValue({ data: {} }),
      },
    });

    (google.businessprofileperformance as jest.Mock).mockReturnValue({
      locations: {
        fetchMultiDailyMetricsTimeSeries: jest.fn(async () => {
          if (options.performanceError) throw options.performanceError;
          return { data: options.performance ?? { multiDailyMetricTimeSeries: [] } };
        }),
      },
    });

    const fetchMock = jest.fn(async (url: string) => {
      const path = String(url);
      const result = options.v4 ? options.v4(path) : { status: 403 };
      if (result.status && result.status >= 400) {
        return {
          ok: false,
          status: result.status,
          text: async () => JSON.stringify({ error: { message: result.message ?? 'permission denied' } }),
        } as any;
      }
      return { ok: true, status: 200, json: async () => result.body ?? {} } as any;
    });
    (global as any).fetch = fetchMock;

    return {
      prisma,
      oauth,
      fetchMock,
      service: new BusinessProfileService(prisma as any, oauth as any),
    };
  }

  /** Google's client shape for an HTTP failure. */
  function googleError(status: number, message: string) {
    const error: any = new Error(message);
    error.code = status;
    error.response = { status, data: { error: { message } } };
    return error;
  }

  afterEach(() => {
    jest.clearAllMocks();
    delete (global as any).fetch;
  });

  describe('when Google has not approved this Cloud project', () => {
    it('reports the wait as the connection state instead of returning empty data', async () => {
      const { service, oauth, prisma } = harness({
        locationError: googleError(
          403,
          'Business Profile API has not been used in project 1234 before or it is disabled.',
        ),
        performanceError: googleError(403, 'Business Profile API has not been used in project 1234 before or it is disabled.'),
      });

      const result = await service.sync(PROJECT);

      // Not a throw the page renders as a blank tab, and not a success with
      // nothing in it. The connection itself carries the reason.
      expect(oauth.markError).toHaveBeenCalledWith(
        PROJECT,
        'business_profile',
        expect.stringMatching(/pending Google’s approval/i),
      );
      // A 403 is not an expired grant. Telling the customer to reconnect sends
      // them round a loop that cannot end.
      expect(oauth.markNeedsReauth).not.toHaveBeenCalled();
      expect(result.status).toBe('FAILED');
      expect(prisma.gbpLocationProfile.rows).toHaveLength(0);
    });

    it('records which source was refused, so an empty tab does not claim there is nothing there', async () => {
      const { service, prisma } = harness({
        // v4 refuses everything, which is the common case: the first-party
        // APIs work and reviews, photos and posts do not.
        v4: () => ({ status: 403, message: 'The caller does not have permission' }),
      });

      await service.sync(PROJECT);

      const media = prisma.gbpSourceStatus.rows.find((row) => row.source === 'media');
      expect(media).toMatchObject({ state: 'UNAVAILABLE', httpStatus: 403 });
      expect(media!.message).toMatch(/403/);
      // Never read successfully, which is not the same as read and found none.
      expect(media!.lastCount ?? null).toBeNull();

      // And the profile, which Google did answer, is marked readable.
      expect(prisma.gbpSourceStatus.rows.find((row) => row.source === 'profile')).toMatchObject({ state: 'OK' });
    });

    it('does not mark the whole connection broken because only the legacy sources are refused', async () => {
      // A project that reads the profile and the performance numbers is
      // working. Flagging it ERROR would hide the data that did arrive.
      const { service, oauth } = harness({ v4: () => ({ status: 403 }) });

      const result = await service.sync(PROJECT);

      expect(oauth.markError).not.toHaveBeenCalled();
      expect(result.status).toBe('PARTIAL');
      expect(result.failedSources).toEqual(expect.arrayContaining(['reviews', 'media', 'posts']));
    });

    it('treats a 401 as a reconnect and a 403 as a wait', async () => {
      const { service } = harness();

      expect(service.classifyFailure(googleError(401, 'Invalid Credentials')).kind).toBe('REAUTH');
      expect(service.classifyFailure(googleError(403, 'The caller does not have permission')).kind).toBe(
        'PENDING_APPROVAL',
      );
      expect(service.classifyFailure(googleError(429, 'Quota exceeded')).kind).toBe('RATE_LIMITED');
    });
  });

  describe('idempotency', () => {
    const v4WithContent = (path: string): any => {
      if (path.includes('/reviews')) {
        return {
          body: {
            reviews: [
              {
                name: `${ACCOUNT}/locations/12345/reviews/r-1`,
                reviewId: 'r-1',
                reviewer: { displayName: 'Sam' },
                starRating: 'FIVE',
                comment: 'Great.',
                createTime: '2026-08-01T10:00:00Z',
                updateTime: '2026-08-01T10:00:00Z',
              },
            ],
          },
        };
      }
      if (path.includes('/media')) {
        return { body: { mediaItems: [{ name: `${ACCOUNT}/locations/12345/media/m-1`, mediaFormat: 'PHOTO' }] } };
      }
      if (path.includes('/localPosts')) {
        return { body: { localPosts: [{ name: `${ACCOUNT}/locations/12345/localPosts/p-1`, summary: 'Open late' }] } };
      }
      return { body: {} };
    };

    const performance = {
      multiDailyMetricTimeSeries: [
        {
          dailyMetricTimeSeries: [
            {
              dailyMetric: 'WEBSITE_CLICKS',
              timeSeries: {
                datedValues: [
                  { date: { year: 2026, month: 8, day: 1 }, value: '7' },
                  { date: { year: 2026, month: 8, day: 2 }, value: '3' },
                ],
              },
            },
          ],
        },
      ],
    };

    it('leaves one copy of everything when it runs twice', async () => {
      const { service, prisma } = harness({ performance, v4: v4WithContent });

      const first = await service.sync(PROJECT);
      const second = await service.sync(PROJECT);

      expect(first.counts).toEqual(second.counts);
      expect(prisma.gbpLocationProfile.rows).toHaveLength(1);
      expect(prisma.gbpServiceItem.rows).toHaveLength(2);
      expect(prisma.gbpDailyMetric.rows).toHaveLength(2);
      expect(prisma.gbpMedia.rows).toHaveLength(1);
      expect(prisma.gbpLocalPost.rows).toHaveLength(1);
      expect(prisma.localReview.rows).toHaveLength(1);
    });

    it('updates a review in place rather than storing a second version of it', async () => {
      const { service, prisma } = harness({ performance, v4: v4WithContent });
      await service.sync(PROJECT);

      // The merchant replied on Google between syncs.
      const withReply = (path: string): any => {
        const base = v4WithContent(path);
        if (path.includes('/reviews')) {
          base.body.reviews[0].reviewReply = { comment: 'Thank you!', updateTime: '2026-08-03T09:00:00Z' };
        }
        return base;
      };
      const second = harness({ performance, v4: withReply });
      // Same store, so the second sync sees the first one's rows.
      (second.service as any).prisma = prisma;
      await (second.service as any).sync(PROJECT);

      expect(prisma.localReview.rows).toHaveLength(1);
      expect(prisma.localReview.rows[0].googleReplyText).toBe('Thank you!');
    });

    it('drops a service the merchant removed on Google rather than keeping it on the page', async () => {
      const { service, prisma } = harness({ performance, v4: v4WithContent });
      await service.sync(PROJECT);
      expect(prisma.gbpServiceItem.rows).toHaveLength(2);

      const shorter = { ...fullLocation, serviceItems: [fullLocation.serviceItems[0]] };
      const next = harness({ location: shorter, performance, v4: v4WithContent });
      (next.service as any).prisma = prisma;
      await next.service.sync(PROJECT);

      expect(prisma.gbpServiceItem.rows).toHaveLength(1);
    });

    it('re-reads recent days without doubling them', async () => {
      // Google restates recent days, so the window is deliberately fetched
      // again. Inserting over the top would keep the first, stale value.
      const { service, prisma } = harness({ performance, v4: v4WithContent });
      await service.sync(PROJECT);

      const restated = {
        multiDailyMetricTimeSeries: [
          {
            dailyMetricTimeSeries: [
              {
                dailyMetric: 'WEBSITE_CLICKS',
                timeSeries: {
                  datedValues: [
                    { date: { year: 2026, month: 8, day: 1 }, value: '9' },
                    { date: { year: 2026, month: 8, day: 2 }, value: '3' },
                  ],
                },
              },
            ],
          },
        ],
      };
      const next = harness({ performance: restated, v4: v4WithContent });
      (next.service as any).prisma = prisma;
      await next.service.sync(PROJECT);

      expect(prisma.gbpDailyMetric.rows).toHaveLength(2);
      const first = prisma.gbpDailyMetric.rows.find((row) => row.date.getUTCDate() === 1);
      expect(first!.value).toBe(9);
    });
  });

  describe('a partial payload', () => {
    it('stores nothing Google did not send', async () => {
      // A real profile in this state: a name and an address, nothing else.
      const sparse = { name: LOCATION, title: 'Corner Shop', storefrontAddress: { addressLines: ['4 Mill Lane'] } };
      const { service, prisma } = harness({ location: sparse, v4: () => ({ status: 403 }) });

      await service.sync(PROJECT);

      const profile = prisma.gbpLocationProfile.rows[0];
      expect(profile.description).toBeNull();
      expect(profile.websiteUri).toBeNull();
      expect(profile.primaryCategoryName).toBeNull();
      expect(profile.primaryPhone).toBeNull();
      // Not false. Google said nothing about verification, and rendering that
      // as "not verified" is a claim nobody made.
      expect(profile.hasVoiceOfMerchant).toBeNull();
      // The completeness denominator is a list of observations, and only the
      // two Google actually sent are on it.
      expect(profile.fieldsReturned).toEqual(['title', 'address']);
      expect(prisma.gbpServiceItem.rows).toHaveLength(0);
    });

    it('records a metric day Google omitted as absent, not as zero', async () => {
      const { service, prisma } = harness({
        performance: {
          multiDailyMetricTimeSeries: [
            {
              dailyMetricTimeSeries: [
                {
                  dailyMetric: 'CALL_CLICKS',
                  timeSeries: {
                    datedValues: [
                      { date: { year: 2026, month: 8, day: 1 }, value: '4' },
                      // Google omits the value when the count is zero — that
                      // is a reported zero, and is stored as one.
                      { date: { year: 2026, month: 8, day: 2 } },
                      // 3 August is missing entirely: Google reported nothing,
                      // and nothing is what is stored.
                    ],
                  },
                },
              ],
            },
          ],
        },
        v4: () => ({ status: 403 }),
      });

      await service.sync(PROJECT);

      const days = prisma.gbpDailyMetric.rows.filter((row) => row.metric === 'CALL_CLICKS');
      expect(days).toHaveLength(2);
      expect(days.map((row) => row.value).sort()).toEqual([0, 4]);
    });

    it('does not score a review whose rating Google would not state', async () => {
      const { service, prisma } = harness({
        v4: (path) =>
          path.includes('/reviews')
            ? {
                body: {
                  reviews: [
                    { reviewId: 'r-9', reviewer: {}, starRating: 'STAR_RATING_UNSPECIFIED', createTime: '2026-08-01T00:00:00Z' },
                  ],
                },
              }
            : { status: 403 },
      });

      await service.sync(PROJECT);

      // 0 means unstated, and the reader excludes it from the average rather
      // than averaging in a middling guess.
      expect(prisma.localReview.rows[0].rating).toBe(0);
    });
  });

  describe('selection', () => {
    it('says whether the Google account has any locations at all', async () => {
      // An empty picker has two opposite causes and the same appearance.
      const { service } = harness();
      const result = await service.listLocations(PROJECT);

      expect(result.locations).toHaveLength(1);
      expect(result.locations[0].id).toBe(LOCATION);
      expect(result.diagnostics).toMatchObject({ accountsReturnedByGoogle: 1, googleAccountHasAnyLocation: true });
    });

    it('refuses a sync when no location has been chosen', async () => {
      const { service, prisma } = harness();
      prisma.integration.rows[0].selectedResourceId = null;

      await expect(service.sync(PROJECT)).rejects.toThrow(/No Google Business Profile location has been selected/);
    });
  });

  describe('recovery', () => {
    it('clears a pending-approval error once Google starts answering', async () => {
      const { service, oauth } = harness({ v4: () => ({ status: 403 }) });

      await service.sync(PROJECT);

      // Otherwise a project whose approval finally landed keeps telling its
      // owner the approval is still pending.
      expect(oauth.clearError).toHaveBeenCalledWith(PROJECT, 'business_profile');
    });
  });
});
