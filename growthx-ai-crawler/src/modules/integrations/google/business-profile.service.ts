import { Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { google } from 'googleapis';
import type { OAuth2Client } from 'googleapis-common';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';

/**
 * Reads a customer's Google Business Profile into the GrowthX data layer.
 *
 * A connector, not an engine, and built on the same shape as the Search
 * Console one: list what the account can see, pull it into local tables on a
 * `sync`, and let every read endpoint serve from those tables. Nothing here
 * decides what any of it means, and nothing here produces a value Google did
 * not send.
 *
 * Business Profile is spread across four Google APIs, and the seams between
 * them are the whole difficulty:
 *
 *  - `mybusinessaccountmanagement` lists the accounts. A location cannot be
 *    reached without knowing which account owns it.
 *  - `mybusinessbusinessinformation` is the profile itself — name, address,
 *    categories, hours, services, description.
 *  - `businessprofileperformance` is the daily numbers: impressions, calls,
 *    direction requests, website clicks.
 *  - Reviews, photos and posts exist on NONE of those. They are only on the
 *    legacy v4 API, which is not in the SDK and which many Cloud projects are
 *    not approved for. They are fetched over plain HTTPS and a refusal is
 *    recorded per source, because "this merchant has no photos" and "we are
 *    not allowed to read photos" must never render as the same empty tab.
 *
 * All four sit behind a Google application review, granted per Cloud project
 * and taking days to weeks. A 403 is therefore the *expected* answer on a
 * fresh deployment, not an anomaly, and it is reported as a state the operator
 * can act on rather than as a failed request or as no data.
 */

/** The daily series Google publishes for a location. */
export const GBP_DAILY_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
  'BUSINESS_CONVERSATIONS',
  'BUSINESS_DIRECTION_REQUESTS',
  'CALL_CLICKS',
  'WEBSITE_CLICKS',
  'BUSINESS_BOOKINGS',
] as const;

export type GbpSourceName = 'profile' | 'performance' | 'reviews' | 'media' | 'posts';

/**
 * The profile fields the overview reports on.
 *
 * This list is the completeness denominator. It is a list of things Google can
 * return for a location, not a weighting anyone invented: a field counts as
 * present when Google sent a value for it and absent when it did not.
 */
export const GBP_PROFILE_FIELDS = [
  'title',
  'address',
  'phone',
  'website',
  'description',
  'primaryCategory',
  'additionalCategories',
  'regularHours',
  'serviceItems',
] as const;

/** What a Google failure means for the customer, and for the connection row. */
type FailureKind = 'REAUTH' | 'PENDING_APPROVAL' | 'RATE_LIMITED' | 'NOT_FOUND' | 'OTHER';

interface ClassifiedFailure {
  kind: FailureKind;
  httpStatus: number | null;
  /** Safe to show: never a token, never a raw payload. */
  message: string;
}

@Injectable()
export class BusinessProfileService {
  private readonly logger = new Logger(BusinessProfileService.name);

  /** Reviews, media and local posts live only here. */
  static readonly V4_BASE = 'https://mybusiness.googleapis.com/v4';

  /** How much history a sync pulls when it has none. */
  static readonly DEFAULT_METRIC_DAYS = 180;

  /**
   * Google's performance data is not final for the most recent days, so a
   * sync always re-reads this much of the tail rather than assuming settled.
   */
  static readonly RESTATEMENT_WINDOW_DAYS = 7;

  /**
   * Every field the profile sync stores. Google rejects a readMask naming a
   * field that does not exist, so this is kept in one place next to the code
   * that reads it.
   */
  private static readonly LOCATION_READ_MASK = [
    'name',
    'title',
    'storeCode',
    'storefrontAddress',
    'phoneNumbers',
    'categories',
    'websiteUri',
    'profile',
    'regularHours',
    'specialHours',
    'moreHours',
    'serviceArea',
    'serviceItems',
    'labels',
    'latlng',
    'metadata',
    'openInfo',
  ].join(',');

  /** The narrower mask the picker needs: enough to choose between locations. */
  private static readonly PICKER_READ_MASK = [
    'name',
    'title',
    'storefrontAddress',
    'categories',
    'metadata',
    'openInfo',
  ].join(',');

  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
  ) {}

  private async auth(projectId: string): Promise<OAuth2Client> {
    return this.oauth.clientFor(projectId, 'business_profile');
  }

  // ───────────────────────────────────────────────── selection

  /**
   * Every location this Google account can manage, for the picker.
   *
   * Locations hang off accounts, and one Google login often has several — a
   * personal account plus each location group an agency was added to. All of
   * them are walked, because a customer whose location sits in the third group
   * would otherwise be told they have no locations at all.
   *
   * `id` is Google's resource name, which is what the existing select endpoint
   * stores as `selectedResourceId` and what every other call here addresses.
   */
  async listLocations(projectId: string) {
    const auth = await this.auth(projectId);
    const accountApi = google.mybusinessaccountmanagement({ version: 'v1', auth });
    const infoApi = google.mybusinessbusinessinformation({ version: 'v1', auth });

    try {
      const accounts = await this.listAccounts(accountApi);
      const locations: {
        id: string;
        accountId: string;
        title: string | null;
        address: string | null;
        primaryCategory: string | null;
        /**
         * Google's own hasVoiceOfMerchant. Null when Google did not return
         * metadata for the location — "we do not know" rather than "no".
         */
        verified: boolean | null;
      }[] = [];

      for (const account of accounts) {
        let pageToken: string | undefined;
        do {
          const { data } = await infoApi.accounts.locations.list({
            parent: account.name!,
            readMask: BusinessProfileService.PICKER_READ_MASK,
            pageSize: 100,
            pageToken,
          });
          for (const location of data.locations ?? []) {
            locations.push({
              id: location.name!,
              accountId: account.name!,
              title: location.title ?? null,
              address: formatAddress(location.storefrontAddress) ?? null,
              primaryCategory: location.categories?.primaryCategory?.displayName ?? null,
              verified: location.metadata?.hasVoiceOfMerchant ?? null,
            });
          }
          pageToken = data.nextPageToken ?? undefined;
        } while (pageToken);
      }

      // Returned alongside the list for the same reason Search Console does it:
      // an empty picker has several very different causes, and from the outside
      // they look identical. "No accounts" means this Google login manages no
      // Business Profile at all; "two accounts, no locations" means it manages
      // one but has not been given a location in it.
      return {
        locations,
        diagnostics: {
          accountsReturnedByGoogle: accounts.length,
          googleAccountHasAnyLocation: locations.length > 0,
        },
      };
    } catch (error) {
      throw await this.surface(projectId, error);
    }
  }

  private async listAccounts(accountApi: ReturnType<typeof google.mybusinessaccountmanagement>) {
    const accounts: { name: string }[] = [];
    let pageToken: string | undefined;
    do {
      const { data } = await accountApi.accounts.list({ pageSize: 20, pageToken });
      for (const account of data.accounts ?? []) {
        if (account.name) accounts.push({ name: account.name });
      }
      pageToken = data.nextPageToken ?? undefined;
    } while (pageToken);
    return accounts;
  }

  // ───────────────────────────────────────────────── sync

  /**
   * Pulls everything Google will give us for the selected location.
   *
   * Each source is attempted independently and its outcome recorded, because
   * they fail independently: v4 is routinely refused on a project that reads
   * the profile and the performance numbers perfectly well. A sync that got
   * the profile and the metrics but not the photos is worth keeping, worth
   * reporting as partial, and must not make the photos tab claim there are
   * none.
   */
  async sync(projectId: string, options: { metricDays?: number } = {}) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
      select: { selectedResourceId: true },
    });
    if (!integration?.selectedResourceId) {
      throw new NotFoundException('No Google Business Profile location has been selected for this project.');
    }
    const locationName = integration.selectedResourceId;

    const job = await this.prisma.dataSyncJob.create({
      data: { projectId, provider: 'business_profile', status: 'RUNNING' },
    });

    const counts = { reviews: 0, photos: 0, posts: 0, services: 0, metricDays: 0 };
    const failed: GbpSourceName[] = [];
    const attempted: GbpSourceName[] = ['profile', 'performance', 'reviews', 'media', 'posts'];

    try {
      const auth = await this.auth(projectId);
      const accountName = await this.resolveAccountName(projectId, auth, locationName);

      // The profile first: it is the one source whose failure means the others
      // cannot be trusted either, and it is where the account name comes from.
      try {
        counts.services = await this.syncProfile(projectId, auth, locationName, accountName);
        await this.recordSource(projectId, locationName, 'profile', { count: counts.services });
      } catch (error) {
        failed.push('profile');
        await this.recordFailure(projectId, locationName, 'profile', error);
      }

      try {
        counts.metricDays = await this.syncPerformance(projectId, auth, locationName, options.metricDays);
        await this.recordSource(projectId, locationName, 'performance', { count: counts.metricDays });
      } catch (error) {
        failed.push('performance');
        await this.recordFailure(projectId, locationName, 'performance', error);
      }

      // The v4 sources. Without an account name they cannot even be addressed,
      // which is itself a state to record rather than an empty result.
      if (!accountName) {
        for (const source of ['reviews', 'media', 'posts'] as const) {
          failed.push(source);
          await this.recordSource(projectId, locationName, source, {
            failure: {
              kind: 'NOT_FOUND',
              httpStatus: null,
              message:
                'The Business Profile account that owns this location could not be identified, so reviews, photos ' +
                'and posts cannot be addressed. They live on Google endpoints keyed by account and location.',
            },
          });
        }
      } else {
        try {
          counts.reviews = await this.syncReviews(projectId, auth, accountName, locationName);
          await this.recordSource(projectId, locationName, 'reviews', { count: counts.reviews });
        } catch (error) {
          failed.push('reviews');
          await this.recordFailure(projectId, locationName, 'reviews', error);
        }

        try {
          counts.photos = await this.syncMedia(projectId, auth, accountName, locationName);
          await this.recordSource(projectId, locationName, 'media', { count: counts.photos });
        } catch (error) {
          failed.push('media');
          await this.recordFailure(projectId, locationName, 'media', error);
        }

        try {
          counts.posts = await this.syncPosts(projectId, auth, accountName, locationName);
          await this.recordSource(projectId, locationName, 'posts', { count: counts.posts });
        } catch (error) {
          failed.push('posts');
          await this.recordFailure(projectId, locationName, 'posts', error);
        }
      }

      const status =
        failed.length === 0 ? 'SUCCEEDED' : failed.length === attempted.length ? 'FAILED' : 'PARTIAL';
      const syncedAt = new Date();

      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: {
          status,
          rowsWritten: counts.reviews + counts.photos + counts.posts + counts.services + counts.metricDays,
          finishedAt: syncedAt,
          errorMessage: failed.length ? `Could not read: ${failed.join(', ')}.` : null,
        },
      });

      if (status !== 'FAILED') {
        await this.prisma.integration.update({
          where: { projectId_provider: { projectId, provider: 'business_profile' } },
          data: { lastSyncedAt: syncedAt },
        });
        // A sync that read anything at all clears an ERROR left by a previous
        // refusal. Leaving it would tell the customer their access is still
        // pending after Google granted it.
        await this.oauth.clearError(projectId, 'business_profile');
      }

      return { syncedAt, counts, status, failedSources: failed };
    } catch (error: any) {
      await this.prisma.dataSyncJob.update({
        where: { id: job.id },
        data: { status: 'FAILED', finishedAt: new Date(), errorMessage: String(error?.message ?? '').slice(0, 500) },
      });
      throw await this.surface(projectId, error);
    }
  }

  /**
   * Which account owns the selected location.
   *
   * Cached on the profile row after the first sync, because finding it means
   * listing every location of every account — cheap once, wasteful daily. A
   * location that has moved between accounts is picked up the next time the
   * cached name stops working, since the v4 calls then 404 and are recorded as
   * such rather than as "no reviews".
   */
  private async resolveAccountName(
    projectId: string,
    auth: OAuth2Client,
    locationName: string,
  ): Promise<string | null> {
    const cached = await this.prisma.gbpLocationProfile.findUnique({
      where: { projectId_locationName: { projectId, locationName } },
      select: { accountName: true },
    });
    if (cached?.accountName) return cached.accountName;

    const accountApi = google.mybusinessaccountmanagement({ version: 'v1', auth });
    const infoApi = google.mybusinessbusinessinformation({ version: 'v1', auth });

    const accounts = await this.listAccounts(accountApi);
    for (const account of accounts) {
      let pageToken: string | undefined;
      do {
        const { data } = await infoApi.accounts.locations.list({
          parent: account.name,
          readMask: 'name',
          pageSize: 100,
          pageToken,
        });
        if ((data.locations ?? []).some((location) => location.name === locationName)) {
          return account.name;
        }
        pageToken = data.nextPageToken ?? undefined;
      } while (pageToken);
    }
    return null;
  }

  /** The profile itself, and the services listed on it. Returns the service count. */
  private async syncProfile(
    projectId: string,
    auth: OAuth2Client,
    locationName: string,
    accountName: string | null,
  ): Promise<number> {
    const infoApi = google.mybusinessbusinessinformation({ version: 'v1', auth });
    const { data: location } = await infoApi.locations.get({
      name: locationName,
      readMask: BusinessProfileService.LOCATION_READ_MASK,
    });

    const primaryCategory = location.categories?.primaryCategory;
    const additionalCategories = (location.categories?.additionalCategories ?? []).map((category) => ({
      categoryId: category.name ?? null,
      displayName: category.displayName ?? null,
    }));
    const phones = location.phoneNumbers;
    const serviceItems = location.serviceItems ?? [];

    // Which fields Google actually populated. Recorded rather than derived
    // later from the stored columns, because a column can be null for two
    // reasons — Google sent nothing, or the readMask never asked — and only
    // the sync knows which.
    const fieldsReturned = [
      location.title ? 'title' : null,
      location.storefrontAddress ? 'address' : null,
      phones?.primaryPhone ? 'phone' : null,
      location.websiteUri ? 'website' : null,
      location.profile?.description ? 'description' : null,
      primaryCategory ? 'primaryCategory' : null,
      additionalCategories.length > 0 ? 'additionalCategories' : null,
      location.regularHours?.periods?.length ? 'regularHours' : null,
      serviceItems.length > 0 ? 'serviceItems' : null,
    ].filter((field): field is string => field !== null);

    const values = {
      accountName,
      title: location.title ?? null,
      storeCode: location.storeCode ?? null,
      address: (location.storefrontAddress ?? null) as any,
      addressSummary: formatAddress(location.storefrontAddress),
      primaryPhone: phones?.primaryPhone ?? null,
      additionalPhones: (phones?.additionalPhones ?? []).filter((phone): phone is string => !!phone),
      websiteUri: location.websiteUri ?? null,
      description: location.profile?.description ?? null,
      primaryCategoryId: primaryCategory?.name ?? null,
      primaryCategoryName: primaryCategory?.displayName ?? null,
      additionalCategories: additionalCategories as any,
      regularHours: (location.regularHours ?? null) as any,
      specialHours: (location.specialHours ?? null) as any,
      moreHours: (location.moreHours ?? null) as any,
      serviceArea: (location.serviceArea ?? null) as any,
      labels: (location.labels ?? []).filter((label): label is string => !!label),
      latitude: location.latlng?.latitude ?? null,
      longitude: location.latlng?.longitude ?? null,
      openStatus: location.openInfo?.status ?? null,
      openingDate: formatDate(location.openInfo?.openingDate),
      placeId: location.metadata?.placeId ?? null,
      mapsUri: location.metadata?.mapsUri ?? null,
      newReviewUri: location.metadata?.newReviewUri ?? null,
      hasVoiceOfMerchant: location.metadata?.hasVoiceOfMerchant ?? null,
      hasPendingEdits: location.metadata?.hasPendingEdits ?? null,
      fieldsReturned,
      raw: location as any,
      syncedAt: new Date(),
    };

    await this.prisma.gbpLocationProfile.upsert({
      where: { projectId_locationName: { projectId, locationName } },
      update: values,
      create: { projectId, locationName, ...values },
    });

    return this.storeServiceItems(projectId, locationName, serviceItems);
  }

  private async storeServiceItems(projectId: string, locationName: string, items: any[]): Promise<number> {
    const keys: string[] = [];

    for (const item of items) {
      const structured = item.structuredServiceItem;
      const free = item.freeFormServiceItem;
      // Service items carry no resource name of their own, so the key is
      // whichever field identifies the item to Google. Without a stable key a
      // re-sync would append a second copy of every service the merchant lists.
      const serviceKey = structured?.serviceTypeId
        ? `structured:${structured.serviceTypeId}`
        : free?.label?.displayName
          ? `freeform:${free.category ?? ''}:${free.label.displayName}`
          : null;
      if (!serviceKey) continue;
      keys.push(serviceKey);

      const values = {
        kind: structured ? 'STRUCTURED' : 'FREE_FORM',
        displayName: free?.label?.displayName ?? null,
        description: structured?.description ?? free?.label?.description ?? null,
        serviceTypeId: structured?.serviceTypeId ?? null,
        categoryId: free?.category ?? null,
        priceCurrency: item.price?.currencyCode ?? null,
        priceUnits: item.price?.units ?? null,
        priceNanos: item.price?.nanos ?? null,
        syncedAt: new Date(),
      };

      await this.prisma.gbpServiceItem.upsert({
        where: { projectId_locationName_serviceKey: { projectId, locationName, serviceKey } },
        update: values,
        create: { projectId, locationName, serviceKey, ...values },
      });
    }

    // A service the merchant removed on Google has to disappear here too.
    // Keeping it would show the customer a service they no longer offer, which
    // is the same class of untruth as inventing one.
    await this.prisma.gbpServiceItem.deleteMany({
      where: { projectId, locationName, serviceKey: { notIn: keys.length ? keys : [' '] } },
    });

    return keys.length;
  }

  /** The daily numbers. Returns how many (day, metric) values were stored. */
  private async syncPerformance(
    projectId: string,
    auth: OAuth2Client,
    locationName: string,
    requestedDays?: number,
  ): Promise<number> {
    const performanceApi = google.businessprofileperformance({ version: 'v1', auth });
    const { start, end } = await this.metricWindow(projectId, locationName, requestedDays);

    const { data } = await performanceApi.locations.fetchMultiDailyMetricsTimeSeries({
      location: locationName,
      dailyMetrics: [...GBP_DAILY_METRICS],
      'dailyRange.startDate.year': start.getUTCFullYear(),
      'dailyRange.startDate.month': start.getUTCMonth() + 1,
      'dailyRange.startDate.day': start.getUTCDate(),
      'dailyRange.endDate.year': end.getUTCFullYear(),
      'dailyRange.endDate.month': end.getUTCMonth() + 1,
      'dailyRange.endDate.day': end.getUTCDate(),
    });

    const rows: { projectId: string; locationName: string; date: Date; metric: string; value: number }[] = [];

    for (const multi of data.multiDailyMetricTimeSeries ?? []) {
      for (const series of multi.dailyMetricTimeSeries ?? []) {
        const metric = series.dailyMetric;
        if (!metric) continue;
        for (const point of series.timeSeries?.datedValues ?? []) {
          const date = pointDate(point.date);
          if (!date) continue;
          // Google documents that `value` is omitted when the count is zero.
          // Storing 0 is reading Google's answer, not filling in a blank: a day
          // Google does not mention at all gets no row, and the read endpoint
          // reports the dates actually covered rather than padding the window.
          rows.push({
            projectId,
            locationName,
            date,
            metric,
            value: point.value === null || point.value === undefined ? 0 : Number(point.value),
          });
        }
      }
    }

    // The window is cleared and rewritten rather than inserted over. Google
    // restates recent days, and this window is deliberately re-read to pick
    // those corrections up — skipping duplicates would keep the first, stale
    // value and make the re-read pointless.
    await this.prisma.gbpDailyMetric.deleteMany({
      where: { projectId, locationName, date: { gte: start, lte: end } },
    });

    const CHUNK = 1000;
    for (let index = 0; index < rows.length; index += CHUNK) {
      await this.prisma.gbpDailyMetric.createMany({
        data: rows.slice(index, index + CHUNK),
        skipDuplicates: true,
      });
    }

    return rows.length;
  }

  private async metricWindow(
    projectId: string,
    locationName: string,
    requestedDays?: number,
  ): Promise<{ start: Date; end: Date }> {
    // Not today: Business Profile performance lags, and asking for days Google
    // has not published yet returns nothing, which on a chart looks like the
    // business stopped being found.
    const end = utcDay(new Date());
    end.setUTCDate(end.getUTCDate() - 1);

    if (requestedDays === undefined) {
      const newest = await this.prisma.gbpDailyMetric.findFirst({
        where: { projectId, locationName },
        orderBy: { date: 'desc' },
        select: { date: true },
      });
      if (newest) {
        const start = utcDay(newest.date);
        start.setUTCDate(start.getUTCDate() - BusinessProfileService.RESTATEMENT_WINDOW_DAYS);
        if (start < end) return { start, end };
      }
    }

    const start = utcDay(end);
    start.setUTCDate(start.getUTCDate() - (requestedDays ?? BusinessProfileService.DEFAULT_METRIC_DAYS));
    return { start, end };
  }

  // ───────────────────────────────────────────────── v4 sources

  /**
   * The v4 endpoints, over plain HTTPS.
   *
   * Reviews, media and local posts have no SDK client at all — they were never
   * carried over from the deprecated Google My Business v4 API, and Google has
   * published no replacement. The access token comes from the same OAuth2
   * client every other call uses, so it is refreshed and re-encrypted by the
   * one handler that owns that.
   */
  protected async v4(
    auth: OAuth2Client,
    path: string,
    options: { query?: Record<string, string>; method?: string; body?: unknown } = {},
  ): Promise<any> {
    const { token } = await auth.getAccessToken();
    if (!token) {
      throw new ServiceUnavailableException('Google did not return an access token for this connection.');
    }

    const url = new URL(`${BusinessProfileService.V4_BASE}/${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

    const response = await fetch(url.toString(), {
      method: options.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
        ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      let detail = '';
      try {
        detail = JSON.parse(body)?.error?.message ?? '';
      } catch {
        detail = body.slice(0, 300);
      }
      const error: any = new Error(detail || `Google returned HTTP ${response.status}.`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  /** Every page of a v4 collection. */
  private async v4All(
    auth: OAuth2Client,
    path: string,
    collection: string,
    query: Record<string, string> = {},
  ): Promise<any[]> {
    const items: any[] = [];
    let pageToken: string | undefined;
    do {
      const page = await this.v4(auth, path, { query: pageToken ? { ...query, pageToken } : query });
      items.push(...(page?.[collection] ?? []));
      pageToken = page?.nextPageToken;
    } while (pageToken);
    return items;
  }

  private async syncReviews(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const reviews = await this.v4All(auth, `${accountName}/locations/${locationId}/reviews`, 'reviews', {
      pageSize: '50',
    });

    for (const review of reviews) {
      const googleReviewId: string | undefined = review.reviewId ?? review.name?.split('/').pop();
      if (!googleReviewId) continue;

      const values = {
        authorName: review.reviewer?.displayName ?? 'Google user',
        authorPhotoUrl: review.reviewer?.profilePhotoUrl ?? null,
        rating: starRating(review.starRating),
        text: review.comment ?? null,
        // Kept as Google's own timestamp string. LocalReview has always stored
        // these as text and other callers read them that way.
        time: review.createTime ?? '',
        relativeTime: '',
        locationName,
        googleReplyText: review.reviewReply?.comment ?? null,
        googleReplyUpdatedAt: parseTime(review.reviewReply?.updateTime),
        googleUpdateTime: parseTime(review.updateTime),
      };

      await this.prisma.localReview.upsert({
        where: { projectId_googleReviewId: { projectId, googleReviewId } },
        update: values,
        // replyStatus is left to its default on create and untouched on update:
        // it is this product's own workflow state, and a re-sync must not
        // reset a reply someone already worked on.
        create: { projectId, googleReviewId, ...values },
      });
    }

    return reviews.length;
  }

  private async syncMedia(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const media = await this.v4All(auth, `${accountName}/locations/${locationId}/media`, 'mediaItems', {
      pageSize: '100',
    });

    const names: string[] = [];
    for (const item of media) {
      if (!item.name) continue;
      names.push(item.name);
      const values = {
        locationName,
        mediaFormat: item.mediaFormat ?? null,
        category: item.locationAssociation?.category ?? null,
        googleUrl: item.googleUrl ?? null,
        thumbnailUrl: item.thumbnailUrl ?? null,
        sourceUrl: item.sourceUrl ?? null,
        description: item.description ?? null,
        widthPx: item.dimensions?.widthPixels ?? null,
        heightPx: item.dimensions?.heightPixels ?? null,
        // Absent when Google reports no insights for the item. Left null
        // rather than zeroed — "not reported" is not "never viewed".
        viewCount: item.insights?.viewCount === undefined ? null : Number(item.insights.viewCount),
        // Google attributes an item only when a customer contributed it, so a
        // missing attribution is an absence of information rather than proof
        // the merchant uploaded it. Left null, not guessed at as MERCHANT.
        attribution: item.attribution?.profileName ? 'CUSTOMER' : null,
        createTime: parseTime(item.createTime),
        syncedAt: new Date(),
      };
      await this.prisma.gbpMedia.upsert({
        where: { projectId_mediaName: { projectId, mediaName: item.name } },
        update: values,
        create: { projectId, mediaName: item.name, ...values },
      });
    }

    // A photo the merchant deleted on Google must stop being shown here.
    await this.prisma.gbpMedia.deleteMany({
      where: { projectId, locationName, mediaName: { notIn: names.length ? names : [' '] } },
    });

    return names.length;
  }

  private async syncPosts(
    projectId: string,
    auth: OAuth2Client,
    accountName: string,
    locationName: string,
  ): Promise<number> {
    const locationId = locationName.split('/').pop();
    const posts = await this.v4All(auth, `${accountName}/locations/${locationId}/localPosts`, 'localPosts', {
      pageSize: '100',
    });

    const names: string[] = [];
    for (const post of posts) {
      if (!post.name) continue;
      names.push(post.name);
      const values = {
        locationName,
        summary: post.summary ?? null,
        languageCode: post.languageCode ?? null,
        state: post.state ?? null,
        topicType: post.topicType ?? null,
        searchUrl: post.searchUrl ?? null,
        callToActionType: post.callToAction?.actionType ?? null,
        callToActionUrl: post.callToAction?.url ?? null,
        eventTitle: post.event?.title ?? null,
        eventStart: formatDate(post.event?.schedule?.startDate),
        eventEnd: formatDate(post.event?.schedule?.endDate),
        mediaUrls: (post.media ?? [])
          .map((item: any) => item.googleUrl ?? item.sourceUrl)
          .filter((url: unknown): url is string => typeof url === 'string'),
        createTime: parseTime(post.createTime),
        updateTime: parseTime(post.updateTime),
        syncedAt: new Date(),
      };
      await this.prisma.gbpLocalPost.upsert({
        where: { projectId_postName: { projectId, postName: post.name } },
        update: values,
        create: { projectId, postName: post.name, ...values },
      });
    }

    await this.prisma.gbpLocalPost.deleteMany({
      where: { projectId, locationName, postName: { notIn: names.length ? names : [' '] } },
    });

    return names.length;
  }

  // ───────────────────────────────────────── writing back to Google

  /**
   * The selected location as Google holds it right now.
   *
   * A live read rather than the synced copy, because the two callers — the
   * profile auditor and the fix pusher — are both about to act on it, and
   * acting on a day-old copy is how a fix overwrites an edit the merchant made
   * this morning.
   */
  async fetchLocation(projectId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
      select: { selectedResourceId: true },
    });
    if (!integration?.selectedResourceId) {
      throw new NotFoundException('No Google Business Profile location has been selected for this project.');
    }

    try {
      const auth = await this.auth(projectId);
      const infoApi = google.mybusinessbusinessinformation({ version: 'v1', auth });
      const { data } = await infoApi.locations.get({
        name: integration.selectedResourceId,
        readMask: BusinessProfileService.LOCATION_READ_MASK,
      });
      return data;
    } catch (error) {
      throw await this.surface(projectId, error);
    }
  }

  /**
   * Applies an approved change to the customer's profile.
   *
   * The only write in this connector, and it happens only when a person has
   * approved a specific proposal. `business.manage` is the sole scope Google
   * publishes for Business Profile — there is no read-only alternative — so
   * the restraint has to live here rather than in the grant.
   */
  async patchLocation(projectId: string, locationName: string, updateMask: string, body: Record<string, unknown>) {
    try {
      const auth = await this.auth(projectId);
      const infoApi = google.mybusinessbusinessinformation({ version: 'v1', auth });
      const { data } = await infoApi.locations.patch({
        name: locationName,
        updateMask,
        requestBody: body,
      });
      return data;
    } catch (error) {
      throw await this.surface(projectId, error);
    }
  }

  /**
   * Publishes the merchant's reply to a review, on Google.
   *
   * The only reason this exists separately from patchLocation is that replies
   * are a v4 endpoint. It matters because marking a reply "published" locally
   * without sending it is a lie the operator has no way to detect: the review
   * sits on Google unanswered while the product reports it handled.
   */
  async replyToReview(projectId: string, googleReviewId: string, comment: string) {
    const location = await this.selectedLocation(projectId);
    if (!location.accountName) {
      throw new ServiceUnavailableException(
        'The Business Profile account that owns this location is not known yet, so a reply cannot be addressed. ' +
          'Run a Business Profile sync first.',
      );
    }

    const locationId = location.locationName.split('/').pop();
    try {
      const auth = await this.auth(projectId);
      const response = await this.v4(
        auth,
        `${location.accountName}/locations/${locationId}/reviews/${googleReviewId}/reply`,
        { method: 'PUT', body: { comment } },
      );
      return {
        comment: response?.comment ?? comment,
        updateTime: parseTime(response?.updateTime),
      };
    } catch (error) {
      throw await this.surface(projectId, error);
    }
  }

  /** The location this project reads, and the account that owns it. */
  async selectedLocation(projectId: string): Promise<{ locationName: string; accountName: string | null }> {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
      select: { selectedResourceId: true },
    });
    if (!integration?.selectedResourceId) {
      throw new NotFoundException('No Google Business Profile location has been selected for this project.');
    }
    const profile = await this.prisma.gbpLocationProfile.findUnique({
      where: { projectId_locationName: { projectId, locationName: integration.selectedResourceId } },
      select: { accountName: true },
    });
    return { locationName: integration.selectedResourceId, accountName: profile?.accountName ?? null };
  }

  // ───────────────────────────────────────────────── failure states

  /**
   * What a Google failure means, in words the customer can act on.
   *
   * The distinction that matters most is 401 from 403. A 401 is a grant that
   * is gone and a reconnect fixes it. A 403 on Business Profile is almost
   * always the Cloud project not yet being approved for these APIs — a wait,
   * not a reconnect — and telling someone to reconnect sends them round a loop
   * that cannot terminate.
   */
  classifyFailure(error: any): ClassifiedFailure {
    const httpStatus: number | null =
      error?.status ?? error?.response?.status ?? (typeof error?.code === 'number' ? error.code : null);
    const raw: string = error?.response?.data?.error?.message ?? error?.message ?? '';

    if (httpStatus === 401) {
      return {
        kind: 'REAUTH',
        httpStatus,
        message:
          'Google rejected the stored authorization for this Business Profile. Reconnect Google Business Profile ' +
          'to resume reading it.',
      };
    }

    if (httpStatus === 403) {
      if (/has not been used in project|is disabled|SERVICE_DISABLED|accessNotConfigured/i.test(raw)) {
        return {
          kind: 'PENDING_APPROVAL',
          httpStatus,
          message:
            'Business Profile API access is pending Google’s approval for this Cloud project. The API is not ' +
            'enabled yet, so no profile data can be read. This is granted by Google per project and is not something ' +
            'reconnecting will fix.',
        };
      }
      return {
        kind: 'PENDING_APPROVAL',
        httpStatus,
        message:
          'Google refused this Business Profile request (403). The usual cause is that this Cloud project has not ' +
          'been approved for the Business Profile APIs, which Google grants per project and can take weeks; the ' +
          'other is that the connected Google account does not manage this location.',
      };
    }

    if (httpStatus === 404) {
      return {
        kind: 'NOT_FOUND',
        httpStatus,
        message: 'Google no longer has this location, or it has moved to another account. Re-select the location.',
      };
    }

    if (httpStatus === 429) {
      return {
        kind: 'RATE_LIMITED',
        httpStatus,
        message: 'Google is rate-limiting Business Profile requests for this project. The next sync will retry.',
      };
    }

    return {
      kind: 'OTHER',
      httpStatus,
      // Truncated and taken from Google's own message field, which carries no
      // token and no credential.
      message: raw ? `Google could not answer this Business Profile request: ${raw.slice(0, 300)}` : 'Google could not answer this Business Profile request.',
    };
  }

  /**
   * Turns a failure into the connection state that describes it, and returns
   * an exception whose message is the same thing the customer will see.
   */
  private async surface(projectId: string, error: any): Promise<Error> {
    const failure = this.classifyFailure(error);

    if (failure.kind === 'REAUTH') {
      await this.oauth.markNeedsReauth(projectId, 'business_profile', 'Google returned 401 for Business Profile.');
    } else if (failure.kind === 'PENDING_APPROVAL' || failure.kind === 'RATE_LIMITED') {
      await this.oauth.markError(projectId, 'business_profile', failure.message);
    }

    this.logger.warn(`[GBP ${projectId}] ${failure.httpStatus ?? '—'}: ${failure.message}`);
    return new ServiceUnavailableException(failure.message);
  }

  /** Records that one source was read, and how many records it held. */
  private async recordSource(
    projectId: string,
    locationName: string,
    source: GbpSourceName,
    result: { count?: number; failure?: ClassifiedFailure },
  ) {
    const now = new Date();
    const values = result.failure
      ? {
          state: 'UNAVAILABLE',
          message: result.failure.message,
          httpStatus: result.failure.httpStatus,
          lastAttemptAt: now,
        }
      : {
          state: 'OK',
          message: null,
          httpStatus: null,
          // 0 here means "read it, found none", which is exactly the thing an
          // empty tab has to be able to claim.
          lastCount: result.count ?? 0,
          lastAttemptAt: now,
          lastSuccessAt: now,
        };

    await this.prisma.gbpSourceStatus
      .upsert({
        where: { projectId_locationName_source: { projectId, locationName, source } },
        update: values,
        create: { projectId, locationName, source, ...values },
      })
      .catch((error: any) => this.logger.error(`Could not record GBP source status: ${error.message}`));
  }

  private async recordFailure(projectId: string, locationName: string, source: GbpSourceName, error: any) {
    const failure = this.classifyFailure(error);
    if (failure.kind === 'REAUTH') {
      await this.oauth.markNeedsReauth(projectId, 'business_profile', `Google returned 401 for ${source}.`);
    } else if (failure.kind === 'PENDING_APPROVAL' && (source === 'profile' || source === 'performance')) {
      // Only the two first-party APIs speak for the connection as a whole. v4
      // being refused is normal on an otherwise healthy connection, and
      // marking the whole integration broken because photos are unreadable
      // would hide the profile data that did arrive.
      await this.oauth.markError(projectId, 'business_profile', failure.message);
    }
    this.logger.warn(`[GBP ${projectId}] ${source}: ${failure.message}`);
    await this.recordSource(projectId, locationName, source, { failure });
  }
}

/** A single line for display. Null when Google gave no address at all. */
function formatAddress(address: any): string | null {
  if (!address) return null;
  const parts = [
    ...(address.addressLines ?? []),
    address.locality,
    address.administrativeArea,
    address.postalCode,
    address.regionCode,
  ].filter((part: unknown) => typeof part === 'string' && part.trim().length > 0);
  return parts.length ? parts.join(', ') : null;
}

/** Google's Date type as an ISO-ish string, without inventing missing parts. */
function formatDate(date: any): string | null {
  if (!date || !date.year) return null;
  const month = date.month ? String(date.month).padStart(2, '0') : null;
  const day = date.day ? String(date.day).padStart(2, '0') : null;
  if (month && day) return `${date.year}-${month}-${day}`;
  if (month) return `${date.year}-${month}`;
  return String(date.year);
}

/** A datapoint's date. Null when it is not a whole day, which cannot be stored. */
function pointDate(date: any): Date | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  return new Date(Date.UTC(date.year, date.month - 1, date.day));
}

function utcDay(input: Date): Date {
  const date = new Date(input);
  date.setUTCHours(0, 0, 0, 0);
  return date;
}

function parseTime(value: unknown): Date | null {
  if (typeof value !== 'string' || !value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Google's star rating is a word, not a number.
 *
 * STAR_RATING_UNSPECIFIED has no numeric meaning, so it becomes 0 rather than
 * a guess — a review whose rating Google would not state must not be averaged
 * in as though it were three stars.
 */
function starRating(value: unknown): number {
  switch (value) {
    case 'ONE':
      return 1;
    case 'TWO':
      return 2;
    case 'THREE':
      return 3;
    case 'FOUR':
      return 4;
    case 'FIVE':
      return 5;
    default:
      return 0;
  }
}
