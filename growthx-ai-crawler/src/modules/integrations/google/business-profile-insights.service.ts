import { Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { GoogleOAuthService } from './google-oauth.service';
import { GBP_DAILY_METRICS, GBP_PROFILE_FIELDS, GbpSourceName } from './business-profile.service';
import { PlacesListing, PlacesListingService, PlacesSnapshot } from './places-listing.service';

/**
 * Everything the Business Profile tabs read, served from the synced tables.
 *
 * No call from here ever reaches Google. That is the same rule the Search
 * Console reader follows and it exists for the same reason: a page render must
 * not depend on a third party being up, and eight tabs must not each pay for
 * their own round trip to the same location.
 *
 * The harder job is the one an empty array cannot do. Every response carries
 * the connection's state and the state of the source it came from, because
 * "not connected", "connected but never synced", "synced and this merchant has
 * no photos" and "synced but Google will not let this Cloud project read
 * photos" are four different things that all produce zero rows, and a tab that
 * cannot tell them apart will pick one and be wrong three times out of four.
 *
 * Where Business Profile has not delivered a source — most often because the
 * Cloud project is still waiting on Google's approval — the overview, reviews,
 * photos and categories fall back to the public Google Maps listing from the
 * Places API. Those responses say so with `dataSource: 'places'`, keep the
 * connection envelope truthful, and never stand in for private data: services,
 * posts and performance have no public equivalent and stay locked.
 */

/** Which of the completeness fields a public Maps listing can speak to. */
const PLACES_PROFILE_FIELDS = ['title', 'address', 'phone', 'website', 'primaryCategory', 'regularHours'] as const;

/** How a tab should read the whole connection. */
export type GbpConnectionState =
  | 'NOT_CONNECTED'
  | 'NEEDS_SELECTION'
  | 'NEEDS_REAUTH'
  | 'ERROR'
  | 'NEVER_SYNCED'
  | 'SYNCED';

/** Google's metric names, in the shape the client reads. */
const METRIC_KEYS: Record<(typeof GBP_DAILY_METRICS)[number], string> = {
  BUSINESS_IMPRESSIONS_DESKTOP_MAPS: 'desktopMapsImpressions',
  BUSINESS_IMPRESSIONS_DESKTOP_SEARCH: 'desktopSearchImpressions',
  BUSINESS_IMPRESSIONS_MOBILE_MAPS: 'mobileMapsImpressions',
  BUSINESS_IMPRESSIONS_MOBILE_SEARCH: 'mobileSearchImpressions',
  BUSINESS_CONVERSATIONS: 'conversations',
  BUSINESS_DIRECTION_REQUESTS: 'directionRequests',
  CALL_CLICKS: 'callClicks',
  WEBSITE_CLICKS: 'websiteClicks',
  BUSINESS_BOOKINGS: 'bookings',
};

/** The four series that together are "how often this business was seen". */
const IMPRESSION_METRICS = [
  'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
  'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
  'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
  'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
] as const;

@Injectable()
export class BusinessProfileInsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly oauth: GoogleOAuthService,
    @Optional() private readonly places?: PlacesListingService,
  ) {}

  /**
   * The public listing, when Business Profile has not delivered this source.
   *
   * `delivered` is the caller's own answer to "did Business Profile give us
   * something to show here". Once it has, Places is never consulted: synced
   * data always wins, including a synced empty list.
   */
  private async placesFallback(
    projectId: string,
    connection: { state: GbpConnectionState },
    delivered: boolean,
  ): Promise<PlacesSnapshot | null> {
    if (!this.places || delivered) return null;
    if (connection.state === 'NEEDS_REAUTH') return null;
    return this.places.snapshot(projectId);
  }

  /** What a tab needs to know about the public listing when it could not use one. */
  private placesMeta(snapshot: PlacesSnapshot | null) {
    if (!snapshot) return {};
    return {
      places: {
        state: snapshot.state,
        placeId: snapshot.placeId,
        fetchedAt: snapshot.fetchedAt,
        error: snapshot.error,
        suggestedQuery: snapshot.suggestedQuery,
        googleMapsUri: snapshot.listing?.googleMapsUri ?? null,
      },
    };
  }

  private placesSource(name: GbpSourceName, snapshot: PlacesSnapshot, count: number) {
    return {
      name,
      state: 'OK',
      message: null,
      httpStatus: null,
      lastSuccessAt: snapshot.fetchedAt,
      lastCount: count,
    };
  }

  /**
   * The connection, as every endpoint reports it.
   *
   * NEVER_SYNCED is deliberately separate from SYNCED with no rows. A customer
   * who has just picked their location has connected everything correctly and
   * simply has not pressed Sync; telling them their profile is empty would be
   * both wrong and demoralising.
   */
  async connection(projectId: string) {
    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
    });

    const configuration = this.oauth.configuration();

    if (!integration || integration.status === 'DISCONNECTED') {
      return {
        state: 'NOT_CONNECTED' as GbpConnectionState,
        status: 'NOT_CONNECTED',
        statusMessage: configuration.configured
          ? null
          : `Google integrations are not configured on this deployment. Missing: ${configuration.missing.join(', ')}.`,
        selectedResourceId: null,
        selectedResourceName: null,
        lastSyncedAt: null,
        // Surfaced on every response because it is the single most common
        // reason a correctly built connection still returns nothing.
        requiresGoogleApproval: true,
        configured: configuration.configured,
      };
    }

    const state: GbpConnectionState =
      integration.status === 'NEEDS_REAUTH'
        ? 'NEEDS_REAUTH'
        : integration.status === 'NEEDS_SELECTION' || !integration.selectedResourceId
          ? 'NEEDS_SELECTION'
          : integration.status === 'ERROR'
            ? 'ERROR'
            : integration.lastSyncedAt
              ? 'SYNCED'
              : 'NEVER_SYNCED';

    return {
      state,
      status: integration.status,
      statusMessage: integration.statusMessage,
      selectedResourceId: integration.selectedResourceId,
      selectedResourceName: integration.selectedResourceName,
      lastSyncedAt: integration.lastSyncedAt,
      requiresGoogleApproval: true,
      configured: configuration.configured,
    };
  }

  /**
   * What happened last time this particular source was read.
   *
   * NEVER_ATTEMPTED is its own answer: no row means no sync has tried, which
   * is not the same as having tried and found nothing.
   */
  private async source(projectId: string, locationName: string | null, source: GbpSourceName) {
    if (!locationName) {
      return { name: source, state: 'NEVER_ATTEMPTED', message: null, httpStatus: null, lastSuccessAt: null, lastCount: null };
    }
    const row = await this.prisma.gbpSourceStatus.findUnique({
      where: { projectId_locationName_source: { projectId, locationName, source } },
    });
    if (!row) {
      return { name: source, state: 'NEVER_ATTEMPTED', message: null, httpStatus: null, lastSuccessAt: null, lastCount: null };
    }
    return {
      name: source,
      state: row.state,
      message: row.message,
      httpStatus: row.httpStatus,
      lastSuccessAt: row.lastSuccessAt,
      lastCount: row.lastCount,
    };
  }

  // ───────────────────────────────────────────────── overview

  async overview(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'profile');

    const profile = locationName
      ? await this.prisma.gbpLocationProfile.findUnique({
          where: { projectId_locationName: { projectId, locationName } },
        })
      : null;

    if (!profile) {
      const fallback = await this.placesFallback(projectId, connection, false);
      if (fallback?.listing) return this.overviewFromPlaces(connection, fallback, fallback.listing);
      return { connection, source, profile: null, completeness: null, ...this.placesMeta(fallback) };
    }

    return {
      connection,
      source,
      dataSource: 'business_profile',
      profile: {
        locationName: profile.locationName,
        businessName: profile.title,
        address: profile.addressSummary,
        addressDetail: profile.address,
        phone: profile.primaryPhone,
        additionalPhones: profile.additionalPhones,
        website: profile.websiteUri,
        description: profile.description,
        primaryCategory: profile.primaryCategoryName,
        additionalCategories: (profile.additionalCategories as any[] | null) ?? [],
        hours: profile.regularHours,
        specialHours: profile.specialHours,
        serviceArea: profile.serviceArea,
        openStatus: profile.openStatus,
        openingDate: profile.openingDate,
        latitude: profile.latitude,
        longitude: profile.longitude,
        placeId: profile.placeId,
        mapsUri: profile.mapsUri,
        newReviewUri: profile.newReviewUri,
        // Google's own hasVoiceOfMerchant. Null means Google did not say, and
        // a tab should render that as unknown rather than as unverified.
        verified: profile.hasVoiceOfMerchant,
        hasPendingEdits: profile.hasPendingEdits,
        syncedAt: profile.syncedAt,
      },
      // Not a score. Every entry is a field Google can return for a location,
      // marked present because Google returned a value for it on the last
      // sync. There is no weighting and no target, so the number cannot drift
      // away from the thing it describes.
      completeness: {
        present: profile.fieldsReturned.length,
        total: GBP_PROFILE_FIELDS.length,
        fields: GBP_PROFILE_FIELDS.map((field): { field: string; present: boolean } => ({
          field,
          present: profile.fieldsReturned.includes(field),
        })),
      },
    };
  }

  private overviewFromPlaces(connection: any, snapshot: PlacesSnapshot, listing: PlacesListing) {
    const present = new Set<string>(
      [
        listing.name ? 'title' : null,
        listing.address ? 'address' : null,
        listing.phone ? 'phone' : null,
        listing.website ? 'website' : null,
        listing.primaryTypeDisplayName ? 'primaryCategory' : null,
        listing.hours?.weekdayDescriptions.length ? 'regularHours' : null,
      ].filter((field): field is string => field !== null),
    );

    return {
      connection,
      source: this.placesSource('profile', snapshot, 1),
      dataSource: 'places',
      ...this.placesMeta(snapshot),
      profile: {
        locationName: `places/${listing.placeId}`,
        businessName: listing.name,
        address: listing.address,
        addressDetail: null,
        phone: listing.phone,
        additionalPhones: listing.internationalPhone ? [listing.internationalPhone] : [],
        website: listing.website,
        // The merchant's own description is not public data. Google's
        // editorial summary is, and is reported under its own name.
        description: null,
        editorialSummary: listing.editorialSummary,
        primaryCategory: listing.primaryTypeDisplayName,
        additionalCategories: listing.types
          .filter((type) => type.type !== listing.primaryType)
          .map((type) => ({ categoryId: type.type, displayName: type.displayName })),
        hours: null,
        hoursText: listing.hours?.weekdayDescriptions ?? null,
        specialHours: null,
        serviceArea: null,
        openStatus: placesOpenStatus(listing.businessStatus),
        openingDate: null,
        latitude: listing.latitude,
        longitude: listing.longitude,
        placeId: listing.placeId,
        mapsUri: listing.googleMapsUri,
        newReviewUri: `https://search.google.com/local/writereview?placeid=${encodeURIComponent(listing.placeId)}`,
        // Places does not say whether a listing is verified.
        verified: null,
        hasPendingEdits: null,
        rating: listing.rating,
        reviewCount: listing.userRatingCount,
        syncedAt: snapshot.fetchedAt,
      },
      completeness: {
        present: present.size,
        total: PLACES_PROFILE_FIELDS.length,
        fields: PLACES_PROFILE_FIELDS.map((field): { field: string; present: boolean } => ({
          field,
          present: present.has(field),
        })),
      },
    };
  }

  // ───────────────────────────────────────────────── metrics

  /**
   * The daily performance series, aggregated over a window.
   *
   * `totals` is null rather than a set of zeroes when no synced day falls in
   * the window. Zeroes would say the business was seen by nobody, which is a
   * measurement; null says nothing was measured, which is the truth.
   */
  async metrics(projectId: string, days: number) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'performance');

    const to = new Date();
    to.setUTCHours(0, 0, 0, 0);
    to.setUTCDate(to.getUTCDate() - 1);
    const from = new Date(to);
    from.setUTCDate(from.getUTCDate() - (days - 1));

    const range = { from: iso(from), to: iso(to), days };

    if (!locationName) {
      return { connection, source, range, totals: null, daily: [], coveredDays: 0 };
    }

    const rows = await this.prisma.gbpDailyMetric.findMany({
      where: { projectId, locationName, date: { gte: from, lte: to } },
      orderBy: { date: 'asc' },
    });

    if (rows.length === 0) {
      return { connection, source, range, totals: null, daily: [], coveredDays: 0 };
    }

    const byDate = new Map<string, Record<string, number>>();
    for (const row of rows) {
      const key = iso(row.date);
      const day = byDate.get(key) ?? {};
      day[row.metric] = (day[row.metric] ?? 0) + row.value;
      byDate.set(key, day);
    }

    const daily = [...byDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, metrics]) => ({ date, ...shape(metrics) }));

    const summed: Record<string, number> = {};
    for (const row of rows) summed[row.metric] = (summed[row.metric] ?? 0) + row.value;

    return {
      connection,
      source,
      range,
      totals: shape(summed),
      daily,
      // How many days in the window Google actually reported. A 28-day request
      // answered with 11 days of data is a fact the chart has to be able to
      // state rather than draw as seventeen empty columns.
      coveredDays: byDate.size,
    };
  }

  // ───────────────────────────────────────────────── synced collections

  async reviews(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'reviews');

    const reviews = locationName
      ? await this.prisma.localReview.findMany({
          where: { projectId, locationName },
          orderBy: [{ googleUpdateTime: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    const fallback = await this.placesFallback(
      projectId,
      connection,
      connection.state === 'SYNCED' && (source.state === 'OK' || reviews.length > 0),
    );
    if (fallback?.listing) {
      const listing = fallback.listing;
      const sampleRated = listing.reviews.filter((review) => review.rating != null);
      return {
        connection,
        source: this.placesSource('reviews', fallback, listing.reviews.length),
        dataSource: 'places',
        ...this.placesMeta(fallback),
        reviews: listing.reviews.map((review, index) => ({
          id: review.name || `places-review-${index}`,
          googleReviewId: null,
          authorName: review.authorName,
          authorPhotoUrl: review.authorPhotoUrl,
          authorUri: review.authorUri,
          rating: review.rating,
          text: review.text,
          createTime: review.publishTime,
          relativePublishTime: review.relativePublishTime,
          googleMapsUri: review.googleMapsUri,
          updateTime: null,
          // Places does not return the owner's replies, so nothing is claimed
          // about whether these were answered.
          googleReply: null,
          googleReplyUpdatedAt: null,
          aiDraftedReply: null,
          replyStatus: 'UNKNOWN',
        })),
        // The listing's own totals, not an average of the five shown: Google
        // picks those five by relevance, so they are not a sample of anything.
        summary: {
          total: listing.userRatingCount ?? listing.reviews.length,
          rated: listing.userRatingCount ?? sampleRated.length,
          averageRating: listing.rating,
          shown: listing.reviews.length,
        },
      };
    }

    // Averaged over the reviews actually held, and only over those Google gave
    // a star rating for. A review whose rating Google would not state is not
    // counted as anything.
    const rated = reviews.filter((review) => review.rating > 0);
    const averageRating = rated.length
      ? Math.round((rated.reduce((sum, review) => sum + review.rating, 0) / rated.length) * 100) / 100
      : null;

    return {
      connection,
      source,
      reviews: reviews.map((review) => ({
        id: review.id,
        googleReviewId: review.googleReviewId,
        authorName: review.authorName,
        authorPhotoUrl: review.authorPhotoUrl,
        rating: review.rating > 0 ? review.rating : null,
        text: review.text,
        createTime: review.time || null,
        updateTime: review.googleUpdateTime,
        googleReply: review.googleReplyText,
        googleReplyUpdatedAt: review.googleReplyUpdatedAt,
        aiDraftedReply: review.aiDraftedReply,
        replyStatus: review.replyStatus,
      })),
      summary: { total: reviews.length, rated: rated.length, averageRating },
      dataSource: 'business_profile',
      ...this.placesMeta(fallback),
    };
  }

  async photos(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'media');

    const media = locationName
      ? await this.prisma.gbpMedia.findMany({
          where: { projectId, locationName },
          orderBy: [{ createTime: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    const fallback = await this.placesFallback(
      projectId,
      connection,
      connection.state === 'SYNCED' && (source.state === 'OK' || media.length > 0),
    );
    if (fallback?.listing) {
      return {
        connection,
        source: this.placesSource('media', fallback, fallback.listing.photos.length),
        dataSource: 'places',
        ...this.placesMeta(fallback),
        photos: fallback.listing.photos.map((photo) => ({
          id: photo.name,
          mediaName: photo.name,
          format: 'PHOTO',
          category: null,
          url: photo.url,
          thumbnailUrl: photo.url,
          description: null,
          width: photo.widthPx,
          height: photo.heightPx,
          viewCount: null,
          attribution: photo.attribution,
          attributionUri: photo.attributionUri,
          createTime: null,
        })),
      };
    }

    return {
      connection,
      source,
      photos: media.map((item) => ({
        id: item.id,
        mediaName: item.mediaName,
        format: item.mediaFormat,
        category: item.category,
        url: item.googleUrl ?? item.sourceUrl,
        thumbnailUrl: item.thumbnailUrl,
        description: item.description,
        width: item.widthPx,
        height: item.heightPx,
        viewCount: item.viewCount,
        attribution: item.attribution,
        createTime: item.createTime,
      })),
      dataSource: 'business_profile',
      ...this.placesMeta(fallback),
    };
  }

  async posts(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'posts');

    const posts = locationName
      ? await this.prisma.gbpLocalPost.findMany({
          where: { projectId, locationName },
          orderBy: [{ createTime: 'desc' }, { createdAt: 'desc' }],
        })
      : [];

    return {
      connection,
      source,
      posts: posts.map((post) => ({
        id: post.id,
        postName: post.postName,
        summary: post.summary,
        state: post.state,
        topicType: post.topicType,
        searchUrl: post.searchUrl,
        callToAction:
          post.callToActionType || post.callToActionUrl
            ? { type: post.callToActionType, url: post.callToActionUrl }
            : null,
        event:
          post.eventTitle || post.eventStart
            ? { title: post.eventTitle, start: post.eventStart, end: post.eventEnd }
            : null,
        mediaUrls: post.mediaUrls,
        createTime: post.createTime,
        updateTime: post.updateTime,
      })),
    };
  }

  async services(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    // Services arrive on the location resource, so their availability is the
    // profile's, not a source of their own.
    const source = await this.source(projectId, locationName, 'profile');

    const items = locationName
      ? await this.prisma.gbpServiceItem.findMany({
          where: { projectId, locationName },
          orderBy: { displayName: 'asc' },
        })
      : [];

    return {
      connection,
      source,
      services: items.map((item) => ({
        id: item.id,
        kind: item.kind,
        displayName: item.displayName,
        description: item.description,
        serviceTypeId: item.serviceTypeId,
        categoryId: item.categoryId,
        // Null unless the merchant set one. Money is reported exactly as
        // Google holds it, units and nanos apart, so nothing is rounded.
        price:
          item.priceUnits || item.priceNanos
            ? { currency: item.priceCurrency, units: item.priceUnits, nanos: item.priceNanos }
            : null,
      })),
    };
  }

  async categories(projectId: string) {
    const connection = await this.connection(projectId);
    const locationName = connection.selectedResourceId;
    const source = await this.source(projectId, locationName, 'profile');

    const profile = locationName
      ? await this.prisma.gbpLocationProfile.findUnique({
          where: { projectId_locationName: { projectId, locationName } },
          select: { primaryCategoryId: true, primaryCategoryName: true, additionalCategories: true },
        })
      : null;

    const fallback = await this.placesFallback(projectId, connection, Boolean(profile));
    if (fallback?.listing) {
      const listing = fallback.listing;
      return {
        connection,
        source: this.placesSource('profile', fallback, 1),
        dataSource: 'places',
        ...this.placesMeta(fallback),
        primary: listing.primaryType
          ? { categoryId: listing.primaryType, displayName: listing.primaryTypeDisplayName ?? listing.primaryType }
          : null,
        additional: listing.types
          .filter((type) => type.type !== listing.primaryType)
          .map((type) => ({ categoryId: type.type, displayName: type.displayName })),
      };
    }

    return {
      connection,
      source,
      dataSource: 'business_profile',
      ...this.placesMeta(fallback),
      primary: profile?.primaryCategoryName
        ? { categoryId: profile.primaryCategoryId, displayName: profile.primaryCategoryName }
        : null,
      additional: ((profile?.additionalCategories as any[] | null) ?? []).map((category) => ({
        categoryId: category?.categoryId ?? null,
        displayName: category?.displayName ?? null,
      })),
    };
  }
}

/**
 * Google's metric names in the client's shape.
 *
 * A metric Google did not report is null, never 0. `impressions` is the sum of
 * the four impression series and is null unless at least one of them was
 * reported — a total assembled from nothing is not a total.
 */
function shape(metrics: Record<string, number>) {
  const out: Record<string, number | null> = {};
  for (const metric of GBP_DAILY_METRICS) {
    out[METRIC_KEYS[metric]] = metric in metrics ? metrics[metric] : null;
  }

  const present = IMPRESSION_METRICS.filter((metric) => metric in metrics);
  out.impressions = present.length
    ? present.reduce((sum, metric) => sum + metrics[metric], 0)
    : null;

  return out;
}

/** Places' businessStatus in the vocabulary Business Profile's openInfo uses. */
function placesOpenStatus(status: string | null): string | null {
  switch (status) {
    case 'OPERATIONAL':
      return 'OPEN';
    case 'CLOSED_TEMPORARILY':
      return 'CLOSED_TEMPORARILY';
    case 'CLOSED_PERMANENTLY':
      return 'CLOSED_PERMANENTLY';
    default:
      return null;
  }
}

function iso(date: Date): string {
  return date.toISOString().slice(0, 10);
}
