import { BadGatewayException, BadRequestException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { describePlacesFailure } from './places-error';

/**
 * A project's public Google Maps listing, read from the Places API (New).
 *
 * The Business Profile APIs sit behind an application review that Google
 * grants per Cloud project, and until it lands every one of them refuses. The
 * Places API needs no such approval and returns what anyone can see on Maps:
 * rating, review count, categories, hours, photos, website, phone, and the
 * five reviews Google considers most relevant. That is enough to fill most of
 * the Business Profile screen, so this service fills it — while being plain
 * about what it is. Private data (performance insights, posts, the full review
 * list, replying to reviews) is never approximated from it.
 *
 * Reads are served from a stored snapshot rather than from Google on every
 * render. A snapshot older than a day is refreshed in the background the next
 * time it is read, and Sync refreshes it explicitly.
 */

const PLACES_BASE = 'https://places.googleapis.com/v1';

/** How long a snapshot is served before a read triggers a background refresh. */
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/** Places returns up to ten photos; each needs its own call to resolve a URL. */
const MAX_PHOTOS = 10;

/**
 * The listing fields read. `reviews` puts the call on the Places "Enterprise +
 * Atmosphere" SKU; everything else here is on Enterprise or below.
 */
const DETAILS_FIELD_MASK = [
  'id',
  'displayName',
  'formattedAddress',
  'shortFormattedAddress',
  'location',
  'rating',
  'userRatingCount',
  'types',
  'primaryType',
  'primaryTypeDisplayName',
  'regularOpeningHours',
  'nationalPhoneNumber',
  'internationalPhoneNumber',
  'websiteUri',
  'googleMapsUri',
  'businessStatus',
  'editorialSummary',
  'photos',
  'reviews',
].join(',');

/** Place types too generic to describe a business. Google attaches them to nearly everything. */
const GENERIC_TYPES = new Set(['point_of_interest', 'establishment', 'food', 'store', 'health', 'finance']);

export interface PlacesReview {
  /** Google's resource name for the review. The only stable id Places gives. */
  name: string;
  authorName: string;
  authorPhotoUrl: string | null;
  authorUri: string | null;
  /** Null when Google gave no star rating, never a guessed 0. */
  rating: number | null;
  text: string | null;
  publishTime: string | null;
  relativePublishTime: string | null;
  googleMapsUri: string | null;
}

export interface PlacesPhoto {
  name: string;
  widthPx: number | null;
  heightPx: number | null;
  /** A public image URL Google resolved for this photo. Null when it would not resolve one. */
  url: string | null;
  /** Who took it, as Google attributes it. Places requires this to be shown with the photo. */
  attribution: string | null;
  attributionUri: string | null;
}

export interface PlacesListing {
  placeId: string;
  name: string | null;
  address: string | null;
  shortAddress: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number | null;
  userRatingCount: number | null;
  primaryType: string | null;
  primaryTypeDisplayName: string | null;
  /** Descriptive place types, generic ones removed, in Google's order. */
  types: { type: string; displayName: string }[];
  phone: string | null;
  internationalPhone: string | null;
  website: string | null;
  googleMapsUri: string | null;
  /** OPERATIONAL | CLOSED_TEMPORARILY | CLOSED_PERMANENTLY */
  businessStatus: string | null;
  /** Google's own summary of the place — not the merchant's description. */
  editorialSummary: string | null;
  hours: { weekdayDescriptions: string[]; periods: unknown[] } | null;
  reviews: PlacesReview[];
  photos: PlacesPhoto[];
}

export type PlacesSnapshotState =
  /** GOOGLE_PLACES_API_KEY is not set on this deployment. */
  | 'NOT_CONFIGURED'
  /** No Google Maps listing is attached to the project yet. */
  | 'NO_PLACE'
  /** A listing is attached but no read of it has ever succeeded. */
  | 'FAILED'
  | 'READY';

export interface PlacesSnapshot {
  state: PlacesSnapshotState;
  placeId: string | null;
  listing: PlacesListing | null;
  fetchedAt: Date | null;
  /** Why the last read failed. Present alongside a READY listing when a refresh failed. */
  error: string | null;
  /**
   * What to search Maps for when no listing is attached — the name of the
   * Business Profile location the project selected, when there is one.
   */
  suggestedQuery: string | null;
}

export interface PlacesCompetitorResult {
  rank: number;
  placeId: string;
  name: string;
  address: string | null;
  rating: number | null;
  reviewCount: number | null;
  category: string | null;
  website: string | null;
  googleMapsUri: string | null;
  /** From the listing's own position. Null when the listing has no coordinates. */
  distanceKm: number | null;
  isYou: boolean;
}

@Injectable()
export class PlacesListingService {
  private readonly logger = new Logger(PlacesListingService.name);

  /** One refresh per project at a time: eight tabs load at once and must not each pay for one. */
  private readonly inFlight = new Map<string, Promise<PlacesSnapshot>>();

  constructor(private readonly prisma: PrismaService) {}

  private apiKey(): string | null {
    return process.env.GOOGLE_PLACES_API_KEY || null;
  }

  /**
   * The Maps listing this project tracks.
   *
   * A listing connected through Places search carries its place id directly.
   * A Business Profile location carries one too, but only once it has synced —
   * which is exactly what an unapproved project cannot do, so it comes second.
   */
  async resolvePlace(projectId: string): Promise<{ placeId: string | null; suggestedQuery: string | null }> {
    const local = await this.prisma.localLocation.findFirst({
      where: { projectId, placeId: { not: '' } },
      orderBy: { createdAt: 'asc' },
      select: { placeId: true },
    });
    if (local?.placeId) return { placeId: local.placeId, suggestedQuery: null };

    const integration = await this.prisma.integration.findUnique({
      where: { projectId_provider: { projectId, provider: 'business_profile' } },
      select: { selectedResourceId: true, selectedResourceName: true },
    });
    if (integration?.selectedResourceId) {
      const profile = await this.prisma.gbpLocationProfile.findUnique({
        where: { projectId_locationName: { projectId, locationName: integration.selectedResourceId } },
        select: { placeId: true },
      });
      if (profile?.placeId) return { placeId: profile.placeId, suggestedQuery: null };
    }

    return { placeId: null, suggestedQuery: integration?.selectedResourceName ?? null };
  }

  /**
   * The stored listing, reading Google only when there is nothing stored yet.
   *
   * A stale snapshot is served as it is and refreshed behind the response, so a
   * tab never waits on Google for data it already has.
   */
  async snapshot(projectId: string): Promise<PlacesSnapshot> {
    const { placeId, suggestedQuery } = await this.resolvePlace(projectId);
    if (!this.apiKey()) {
      return { state: 'NOT_CONFIGURED', placeId, listing: null, fetchedAt: null, error: null, suggestedQuery };
    }
    if (!placeId) {
      return { state: 'NO_PLACE', placeId: null, listing: null, fetchedAt: null, error: null, suggestedQuery };
    }

    const row = await this.prisma.placesListingSnapshot.findUnique({
      where: { projectId_placeId: { projectId, placeId } },
    });

    if (row?.data && row.fetchedAt) {
      if (Date.now() - row.fetchedAt.getTime() > STALE_AFTER_MS) {
        this.refreshOnce(projectId).catch(() => undefined);
      }
      return {
        state: 'READY',
        placeId,
        listing: row.data as unknown as PlacesListing,
        fetchedAt: row.fetchedAt,
        error: row.lastError,
        suggestedQuery: null,
      };
    }

    // Never read successfully. A recent failure is reported rather than
    // retried on every tab render; Sync is the way to try again.
    if (row?.lastErrorAt && Date.now() - row.lastErrorAt.getTime() < 10 * 60 * 1000) {
      return { state: 'FAILED', placeId, listing: null, fetchedAt: null, error: row.lastError, suggestedQuery: null };
    }
    return this.refreshOnce(projectId);
  }

  /** Reads the listing from Google now and stores it. Never throws: failures come back as state. */
  refreshOnce(projectId: string): Promise<PlacesSnapshot> {
    const running = this.inFlight.get(projectId);
    if (running) return running;
    const task = this.refresh(projectId).finally(() => this.inFlight.delete(projectId));
    this.inFlight.set(projectId, task);
    return task;
  }

  private async refresh(projectId: string): Promise<PlacesSnapshot> {
    const { placeId, suggestedQuery } = await this.resolvePlace(projectId);
    const apiKey = this.apiKey();
    if (!apiKey) {
      return { state: 'NOT_CONFIGURED', placeId, listing: null, fetchedAt: null, error: null, suggestedQuery };
    }
    if (!placeId) {
      return { state: 'NO_PLACE', placeId: null, listing: null, fetchedAt: null, error: null, suggestedQuery };
    }

    try {
      const listing = await this.fetchListing(placeId, apiKey);
      const fetchedAt = new Date();
      await this.prisma.placesListingSnapshot.upsert({
        where: { projectId_placeId: { projectId, placeId } },
        update: { data: listing as any, fetchedAt, lastError: null, lastErrorAt: null },
        create: { projectId, placeId, data: listing as any, fetchedAt },
      });

      // The tracked location's headline numbers follow the listing, so the
      // audit and the rank tracker are not left quoting the day it was added.
      await this.prisma.localLocation.updateMany({
        where: { projectId, placeId },
        data: {
          ...(listing.rating != null ? { rating: listing.rating } : {}),
          ...(listing.userRatingCount != null ? { reviewCount: listing.userRatingCount } : {}),
          ...(listing.latitude != null && listing.longitude != null
            ? { latitude: listing.latitude, longitude: listing.longitude }
            : {}),
        },
      });

      return { state: 'READY', placeId, listing, fetchedAt, error: null, suggestedQuery: null };
    } catch (error: any) {
      const message: string = error?.message ?? String(error);
      this.logger.warn(`[Places ${projectId}] ${message}`);
      const row = await this.prisma.placesListingSnapshot.upsert({
        where: { projectId_placeId: { projectId, placeId } },
        update: { lastError: message.slice(0, 1000), lastErrorAt: new Date() },
        create: { projectId, placeId, lastError: message.slice(0, 1000), lastErrorAt: new Date() },
      });
      // A refresh that failed does not throw away a listing that was read
      // before: it is still the most recent true answer, and the error rides
      // along with it.
      if (row.data && row.fetchedAt) {
        return {
          state: 'READY',
          placeId,
          listing: row.data as unknown as PlacesListing,
          fetchedAt: row.fetchedAt,
          error: message,
          suggestedQuery: null,
        };
      }
      return { state: 'FAILED', placeId, listing: null, fetchedAt: null, error: message, suggestedQuery: null };
    }
  }

  private async fetchListing(placeId: string, apiKey: string): Promise<PlacesListing> {
    const place = await this.places(`places/${encodeURIComponent(placeId)}`, apiKey, {
      headers: { 'X-Goog-FieldMask': DETAILS_FIELD_MASK },
    });

    const photos = await this.resolvePhotos((place.photos ?? []).slice(0, MAX_PHOTOS), apiKey);

    const types: { type: string; displayName: string }[] = (place.types ?? [])
      .filter((type: unknown): type is string => typeof type === 'string' && !GENERIC_TYPES.has(type))
      .map((type: string) => ({
        type,
        displayName:
          type === place.primaryType && place.primaryTypeDisplayName?.text
            ? place.primaryTypeDisplayName.text
            : humaniseType(type),
      }));

    return {
      placeId: place.id ?? placeId,
      name: place.displayName?.text ?? null,
      address: place.formattedAddress ?? null,
      shortAddress: place.shortFormattedAddress ?? null,
      latitude: place.location?.latitude ?? null,
      longitude: place.location?.longitude ?? null,
      rating: typeof place.rating === 'number' ? place.rating : null,
      userRatingCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      primaryType: place.primaryType ?? null,
      primaryTypeDisplayName: place.primaryTypeDisplayName?.text ?? null,
      types,
      phone: place.nationalPhoneNumber ?? null,
      internationalPhone: place.internationalPhoneNumber ?? null,
      website: place.websiteUri ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
      businessStatus: place.businessStatus ?? null,
      editorialSummary: place.editorialSummary?.text ?? null,
      hours: place.regularOpeningHours
        ? {
            weekdayDescriptions: place.regularOpeningHours.weekdayDescriptions ?? [],
            periods: place.regularOpeningHours.periods ?? [],
          }
        : null,
      reviews: (place.reviews ?? []).map(
        (review: any): PlacesReview => ({
          name: review.name ?? '',
          authorName: review.authorAttribution?.displayName ?? 'Google user',
          authorPhotoUrl: review.authorAttribution?.photoUri ?? null,
          authorUri: review.authorAttribution?.uri ?? null,
          rating: typeof review.rating === 'number' && review.rating > 0 ? review.rating : null,
          // The original text where Google has it: `text` may be a machine
          // translation into the request language.
          text: review.originalText?.text ?? review.text?.text ?? null,
          publishTime: review.publishTime ?? null,
          relativePublishTime: review.relativePublishTimeDescription ?? null,
          googleMapsUri: review.googleMapsUri ?? null,
        }),
      ),
      photos,
    };
  }

  /**
   * Turns photo resource names into image URLs.
   *
   * The media endpoint normally answers with a redirect to the image, which an
   * `<img>` tag cannot follow without the API key. `skipHttpRedirect` returns
   * the destination instead, a public URL that carries no key.
   */
  private async resolvePhotos(photos: any[], apiKey: string): Promise<PlacesPhoto[]> {
    const settled = await Promise.allSettled(
      photos.map((photo) =>
        this.places(`${photo.name}/media`, apiKey, {
          query: { maxWidthPx: '1200', skipHttpRedirect: 'true' },
        }),
      ),
    );

    return photos.map((photo, index) => {
      const result = settled[index];
      const author = photo.authorAttributions?.[0];
      return {
        name: photo.name,
        widthPx: photo.widthPx ?? null,
        heightPx: photo.heightPx ?? null,
        url: result.status === 'fulfilled' ? (result.value?.photoUri ?? null) : null,
        attribution: author?.displayName ?? null,
        attributionUri: author?.uri ?? null,
      };
    });
  }

  // ───────────────────────────────────────────────── competitors

  /**
   * Who shows up for a local search, in Google's order, around this listing.
   *
   * One Text Search biased to the listing's surroundings: the same call each
   * geo-grid point makes, taken from the storefront, with the fields needed to
   * compare businesses side by side.
   */
  async competitors(projectId: string, keyword: string, radiusKm = 5) {
    const apiKey = this.apiKey();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'Competitor search is unavailable: GOOGLE_PLACES_API_KEY is not configured on this deployment.',
      );
    }
    const query = keyword?.trim();
    if (!query) throw new BadRequestException('Enter a search, such as "milk delivery Panvel".');

    const center = await this.center(projectId);
    if (!center) {
      throw new NotFoundException(
        'This project has no Google Maps listing with a location yet. Find your listing first, so results can be ' +
          'searched from where your business is.',
      );
    }

    const radiusM = Math.min(Math.max(radiusKm, 1), 50) * 1000;
    const data = await this.places('places:searchText', apiKey, {
      method: 'POST',
      headers: {
        'X-Goog-FieldMask': [
          'places.id',
          'places.displayName',
          'places.formattedAddress',
          'places.location',
          'places.rating',
          'places.userRatingCount',
          'places.primaryTypeDisplayName',
          'places.websiteUri',
          'places.googleMapsUri',
        ].join(','),
      },
      body: {
        textQuery: query,
        maxResultCount: 20,
        locationBias: { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } },
      },
    });

    const results: PlacesCompetitorResult[] = (data.places ?? []).map((place: any, index: number) => ({
      rank: index + 1,
      placeId: place.id,
      name: place.displayName?.text ?? 'Unknown',
      address: place.formattedAddress ?? null,
      rating: typeof place.rating === 'number' ? place.rating : null,
      reviewCount: typeof place.userRatingCount === 'number' ? place.userRatingCount : null,
      category: place.primaryTypeDisplayName?.text ?? null,
      website: place.websiteUri ?? null,
      googleMapsUri: place.googleMapsUri ?? null,
      distanceKm:
        place.location?.latitude != null && place.location?.longitude != null
          ? Math.round(haversineKm(center.lat, center.lng, place.location.latitude, place.location.longitude) * 10) / 10
          : null,
      isYou: place.id === center.placeId,
    }));

    const you = results.find((result) => result.isYou) ?? null;
    return {
      keyword: query,
      radiusKm: radiusM / 1000,
      center: { lat: center.lat, lng: center.lng },
      searchedAt: new Date().toISOString(),
      // Null when the listing did not appear in the results at all — not
      // "ranked 21st", which would be a position Google never gave it.
      yourRank: you?.rank ?? null,
      results,
    };
  }

  /** Where searches are taken from: the tracked listing's coordinates. */
  private async center(projectId: string): Promise<{ lat: number; lng: number; placeId: string | null } | null> {
    const location = await this.prisma.localLocation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      select: { latitude: true, longitude: true, placeId: true },
    });
    if (location?.latitude != null && location.longitude != null) {
      return { lat: location.latitude, lng: location.longitude, placeId: location.placeId || null };
    }
    const snapshot = await this.snapshot(projectId);
    if (snapshot.listing?.latitude != null && snapshot.listing.longitude != null) {
      return { lat: snapshot.listing.latitude, lng: snapshot.listing.longitude, placeId: snapshot.placeId };
    }
    return null;
  }

  // ───────────────────────────────────────────────── transport

  private async places(
    path: string,
    apiKey: string,
    options: { method?: string; headers?: Record<string, string>; query?: Record<string, string>; body?: unknown } = {},
  ): Promise<any> {
    const url = new URL(`${PLACES_BASE}/${path}`);
    for (const [key, value] of Object.entries(options.query ?? {})) url.searchParams.set(key, value);

    let response: Response;
    try {
      response = await fetch(url.toString(), {
        method: options.method ?? 'GET',
        headers: {
          'X-Goog-Api-Key': apiKey,
          ...(options.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...options.headers,
        },
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      });
    } catch (error) {
      throw new BadGatewayException(
        `Could not reach Google Places: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      let message = `Google Places API returned HTTP ${response.status}`;
      try {
        const parsed = JSON.parse(text);
        if (parsed?.error?.message) message = `Google Places API error (${response.status}): ${parsed.error.message}`;
        message += describePlacesFailure(parsed);
      } catch {
        if (text) message += `: ${text.slice(0, 300)}`;
      }
      throw new BadGatewayException(message);
    }

    return response.json();
  }
}

/** "dairy_store" → "Dairy store". Places only names the primary type for display. */
function humaniseType(type: string): string {
  const words = type.replace(/_/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
