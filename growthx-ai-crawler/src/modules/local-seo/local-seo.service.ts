import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Turns a Google error body into the sentence that names the actual fix.
 *
 * Google's `error.message` for a 403 is "The caller does not have permission",
 * which is true of four unrelated misconfigurations and tells an operator
 * nothing about which one they have. The machine-readable cause is in
 * `error.details[].reason`, and `metadata.consumer` names the Cloud project
 * Google actually billed the call to — the detail that catches a key belonging
 * to a different project from the one the operator has been configuring.
 * Both were being discarded.
 *
 * The key itself is never included: this string reaches the browser.
 */
function describePlacesFailure(parsed: any): string {
  const info = (parsed?.error?.details ?? []).find(
    (detail: any) => typeof detail?.reason === 'string',
  );
  if (!info) return '';

  const remedy: Record<string, string> = {
    SERVICE_DISABLED:
      'Places API (New) is not enabled on that project — note it is a separate API from the legacy Places API.',
    API_KEY_SERVICE_BLOCKED:
      "The API key's restrictions exclude Places API (New). Add it under the key's API restrictions.",
    API_KEY_HTTP_REFERRER_BLOCKED:
      'The API key is restricted to browser referrers, but this call comes from the server. Use a key with no referrer restriction.',
    API_KEY_IP_ADDRESS_BLOCKED:
      "The API key is IP-restricted and this deployment's address is not on the list.",
    API_KEY_INVALID: 'The API key is not valid for this request.',
    BILLING_DISABLED: 'Billing is not enabled on that project, which Places requires.',
  };

  const consumer = info.metadata?.consumer;
  const project = typeof consumer === 'string' ? consumer.replace(/^projects\//, '') : null;

  return [
    ` [${info.reason}`,
    project ? ` on project ${project}` : '',
    '] ',
    remedy[info.reason] ?? 'See the Google Cloud console for this project.',
  ].join('');
}

@Injectable()
export class LocalSeoService {
  private readonly logger = new Logger(LocalSeoService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Returns the project's own local listing, or null when none is connected.
   *
   * This used to seed a placeholder business ("GrowthX Corp., 123 Market St,
   * San Francisco") with invented ratings and keyword rankings whenever a
   * project had no data. Every customer saw the same fictional storefront
   * presented as their own listing, and because the rows were persisted the
   * fiction outlived the request. The client renders an empty state instead.
   */
  async getLocalSeo(projectId: string) {
    // The project's primary location. Projects now hold many locations, so this
    // is "the first one" rather than "the only one"; callers that need them all
    // use listLocations.
    return this.prisma.localLocation.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { rankings: true },
    });
  }

  /** Every location on a project, oldest first. */
  async listLocations(projectId: string) {
    return this.prisma.localLocation.findMany({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
      include: { rankings: true },
    });
  }

  async getProposals(projectId: string) {
    return this.prisma.gbpFixProposal.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async searchBusiness(query: string) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      // This returned two invented businesses — "GrowthX Corp., 123 Market St,
      // San Francisco, rating 4.8, 142 reviews" — whenever the key was absent,
      // which it is on this deployment. An operator searching for their own
      // business got fabricated results indistinguishable from real ones, and
      // could attach one to a project. Saying the search is unavailable is the
      // only honest answer when there is nothing to search with.
      throw new ServiceUnavailableException(
        'Business search is unavailable: GOOGLE_PLACES_API_KEY is not configured. ' +
          'Set it to enable Google Places lookups; no results can be returned without it.',
      );
    }
    
    try {
      const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': apiKey,
          'X-Goog-FieldMask':
            'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.location',
        },
        body: JSON.stringify({
          textQuery: query,
          maxResultCount: 5,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let message = `Google Places API returned HTTP ${response.status}`;
        try {
          const parsed = JSON.parse(errorText);
          if (parsed?.error?.message) {
            message = `Google Places API error (${response.status}): ${parsed.error.message}`;
          }
          message += describePlacesFailure(parsed);
        } catch {
          if (errorText) message += `: ${errorText}`;
        }
        this.logger.error(message);
        throw new BadGatewayException(message);
      }

      const data = await response.json();
      return (data.places || []).map((place: any) => ({
        placeId: place.id,
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        rating: place.rating || 0,
        userRatingsTotal: place.userRatingCount || 0,
        // Carried through so connecting a listing gives the geo grid a real
        // centre instead of a default city.
        latitude: place.location?.latitude,
        longitude: place.location?.longitude,
      }));
    } catch (err) {
      if (err instanceof ServiceUnavailableException || err instanceof BadGatewayException) {
        throw err;
      }
      this.logger.error(`Failed to search Google Places: ${err}`);
      throw new BadGatewayException(
        `Failed to search Google Places: ${err instanceof Error ? err.message : String(err)}`
      );
    }
  }

  /**
   * Attaches a Google Places listing to a project as one of its locations.
   *
   * Keyed on (project, place): connecting the same listing twice updates it,
   * connecting a second listing adds a location rather than replacing the first.
   */
  async connectBusiness(
    projectId: string,
    placeData: {
      businessName: string;
      address: string;
      rating: number;
      reviewCount: number;
      placeId?: string;
      latitude?: number;
      longitude?: number;
    }
  ) {
    return this.prisma.localLocation.upsert({
      where: { projectId_placeId: { projectId, placeId: placeData.placeId ?? '' } },
      update: {
        businessName: placeData.businessName,
        address: placeData.address,
        rating: placeData.rating,
        reviewCount: placeData.reviewCount,
        latitude: placeData.latitude ?? undefined,
        longitude: placeData.longitude ?? undefined,
      },
      create: {
        projectId,
        placeId: placeData.placeId ?? '',
        businessName: placeData.businessName,
        address: placeData.address,
        rating: placeData.rating,
        reviewCount: placeData.reviewCount,
        latitude: placeData.latitude ?? null,
        longitude: placeData.longitude ?? null,
        // citationsCount is left at its column default of 0. It was previously
        // seeded with `Math.random() * 50 + 10` — a number with no relationship
        // to any citation, stored and then displayed as a measured figure.
        // Zero is honest until a citation source exists to populate it.
      },
    });
  }
}
