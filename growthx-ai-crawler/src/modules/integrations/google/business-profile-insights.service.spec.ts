import { BusinessProfileInsightsService } from './business-profile-insights.service';
import { fakePrisma } from './business-profile.testing';

/**
 * What the tabs read, and specifically what they read when there is nothing to
 * read.
 *
 * Four situations all produce zero rows — not connected, connected but never
 * synced, synced and the merchant genuinely has none, and synced but Google
 * refused this Cloud project — and a tab that cannot tell them apart will pick
 * one and be wrong the other three times. That is the whole subject of this
 * file; the aggregation is the easy part.
 */
describe('BusinessProfileInsightsService', () => {
  const PROJECT = 'p1';
  const LOCATION = 'locations/12345';

  function harness(integration?: Record<string, any>) {
    const prisma = fakePrisma();
    if (integration) {
      prisma.integration.rows.push({
        id: 'i1',
        projectId: PROJECT,
        provider: 'business_profile',
        selectedResourceId: LOCATION,
        selectedResourceName: 'Bright Dental',
        status: 'CONNECTED',
        statusMessage: null,
        lastSyncedAt: null,
        ...integration,
      });
    }
    const oauth = { configuration: () => ({ configured: true, missing: [] }) };
    return { prisma, service: new BusinessProfileInsightsService(prisma as any, oauth as any) };
  }

  describe('the four kinds of nothing', () => {
    it('says NOT_CONNECTED when no connection exists', async () => {
      const { service } = harness();
      const result = await service.photos(PROJECT);

      expect(result.connection.state).toBe('NOT_CONNECTED');
      expect(result.photos).toEqual([]);
      // Nobody has ever looked, which is not "there are none".
      expect(result.source.state).toBe('NEVER_ATTEMPTED');
    });

    it('says NEVER_SYNCED when the location is chosen but no sync has run', async () => {
      // The customer has done everything right and simply has not pressed
      // Sync. Telling them their profile is empty would be wrong and unkind.
      const { service } = harness({ lastSyncedAt: null });
      const result = await service.photos(PROJECT);

      expect(result.connection.state).toBe('NEVER_SYNCED');
      expect(result.source.state).toBe('NEVER_ATTEMPTED');
    });

    it('distinguishes "read it, found none" from "could not read"', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date('2026-09-01T00:00:00Z') });
      prisma.gbpSourceStatus.rows.push({
        projectId: PROJECT,
        locationName: LOCATION,
        source: 'media',
        state: 'OK',
        message: null,
        httpStatus: null,
        lastCount: 0,
        lastSuccessAt: new Date('2026-09-01T00:00:00Z'),
      });

      const found = await service.photos(PROJECT);
      expect(found.connection.state).toBe('SYNCED');
      expect(found.source).toMatchObject({ state: 'OK', lastCount: 0 });

      prisma.gbpSourceStatus.rows[0] = {
        ...prisma.gbpSourceStatus.rows[0],
        state: 'UNAVAILABLE',
        message: 'Google refused this Business Profile request (403).',
        httpStatus: 403,
        lastCount: null,
        lastSuccessAt: null,
      };

      const refused = await service.photos(PROJECT);
      expect(refused.photos).toEqual([]);
      // Same empty array, opposite meaning, and the tab can tell.
      expect(refused.source).toMatchObject({ state: 'UNAVAILABLE', httpStatus: 403 });
      expect(refused.source.message).toMatch(/403/);
    });

    it('says NEEDS_SELECTION rather than pretending a location was picked', async () => {
      const { service } = harness({ status: 'NEEDS_SELECTION', selectedResourceId: null });
      const result = await service.overview(PROJECT);

      expect(result.connection.state).toBe('NEEDS_SELECTION');
      expect(result.profile).toBeNull();
      expect(result.completeness).toBeNull();
    });

    it('carries the pending-approval message onto every tab', async () => {
      const message = 'Business Profile API access is pending Google’s approval for this Cloud project.';
      const { service } = harness({ status: 'ERROR', statusMessage: message });

      const result = await service.categories(PROJECT);
      expect(result.connection.state).toBe('ERROR');
      expect(result.connection.statusMessage).toBe(message);
      // Surfaced everywhere because it is the single commonest reason a
      // correctly built connection returns nothing.
      expect(result.connection.requiresGoogleApproval).toBe(true);
    });
  });

  describe('metrics', () => {
    function withDays(prisma: ReturnType<typeof fakePrisma>, entries: [number, string, number][]) {
      for (const [daysAgo, metric, value] of entries) {
        const date = new Date();
        date.setUTCHours(0, 0, 0, 0);
        date.setUTCDate(date.getUTCDate() - daysAgo);
        prisma.gbpDailyMetric.rows.push({ projectId: PROJECT, locationName: LOCATION, date, metric, value });
      }
    }

    it('reports no totals at all rather than a row of zeroes', async () => {
      const { service } = harness({ lastSyncedAt: new Date() });
      const result = await service.metrics(PROJECT, 28);

      // Zeroes would say the business was found by nobody, which is a
      // measurement. Null says nothing was measured, which is the truth.
      expect(result.totals).toBeNull();
      expect(result.daily).toEqual([]);
      expect(result.coveredDays).toBe(0);
      // The range is still stated, so a chart can label its own emptiness.
      expect(result.range.days).toBe(28);
    });

    it('sums only the days Google actually reported, and says how many those were', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date() });
      withDays(prisma, [
        [1, 'WEBSITE_CLICKS', 4],
        [2, 'WEBSITE_CLICKS', 6],
        [1, 'CALL_CLICKS', 2],
        [1, 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH', 100],
        [2, 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS', 20],
      ]);

      const result = await service.metrics(PROJECT, 28);

      expect(result.totals).toMatchObject({ websiteClicks: 10, callClicks: 2, impressions: 120 });
      // A 28-day request answered with two days of data is a fact the chart
      // has to be able to state rather than draw as 26 empty columns.
      expect(result.coveredDays).toBe(2);
      expect(result.daily).toHaveLength(2);
    });

    it('leaves a metric Google never reported null instead of zero', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date() });
      withDays(prisma, [[1, 'WEBSITE_CLICKS', 4]]);

      const result = await service.metrics(PROJECT, 28);

      expect(result.totals!.bookings).toBeNull();
      expect(result.totals!.conversations).toBeNull();
      // No impression series was reported, so there is no impression total.
      expect(result.totals!.impressions).toBeNull();
    });

    it('excludes days outside the window', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date() });
      withDays(prisma, [
        [1, 'WEBSITE_CLICKS', 4],
        [90, 'WEBSITE_CLICKS', 999],
      ]);

      const result = await service.metrics(PROJECT, 7);
      expect(result.totals!.websiteClicks).toBe(4);
    });
  });

  describe('overview completeness', () => {
    it('counts the fields Google returned, and nothing else', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date() });
      prisma.gbpLocationProfile.rows.push({
        projectId: PROJECT,
        locationName: LOCATION,
        title: 'Corner Shop',
        addressSummary: '4 Mill Lane',
        address: { addressLines: ['4 Mill Lane'] },
        additionalPhones: [],
        primaryPhone: null,
        websiteUri: null,
        description: null,
        primaryCategoryId: null,
        primaryCategoryName: null,
        additionalCategories: [],
        regularHours: null,
        hasVoiceOfMerchant: null,
        fieldsReturned: ['title', 'address'],
        syncedAt: new Date(),
      });

      const result = await service.overview(PROJECT);

      expect(result.completeness).toMatchObject({ present: 2, total: 9 });
      expect(result.completeness!.fields.find((field) => field.field === 'description')).toEqual({
        field: 'description',
        present: false,
      });
      // Not false. Google said nothing about verification, and rendering that
      // as "unverified" is a claim nobody made.
      expect(result.profile!.verified).toBeNull();
    });
  });

  describe('reviews', () => {
    it('averages only the reviews Google gave a rating for', async () => {
      const { prisma, service } = harness({ lastSyncedAt: new Date() });
      prisma.localReview.rows.push(
        { projectId: PROJECT, locationName: LOCATION, googleReviewId: 'a', authorName: 'A', rating: 5, replyStatus: 'PENDING' },
        { projectId: PROJECT, locationName: LOCATION, googleReviewId: 'b', authorName: 'B', rating: 3, replyStatus: 'PENDING' },
        // Google would not state this one's rating. Averaging it in as a
        // middling score would be inventing the score.
        { projectId: PROJECT, locationName: LOCATION, googleReviewId: 'c', authorName: 'C', rating: 0, replyStatus: 'PENDING' },
      );

      const result = await service.reviews(PROJECT);

      expect(result.summary).toEqual({ total: 3, rated: 2, averageRating: 4 });
      expect(result.reviews.find((review) => review.googleReviewId === 'c')!.rating).toBeNull();
    });

    it('has no average at all when nothing is rated', async () => {
      const { service } = harness({ lastSyncedAt: new Date() });
      const result = await service.reviews(PROJECT);
      expect(result.summary.averageRating).toBeNull();
    });
  });
});
