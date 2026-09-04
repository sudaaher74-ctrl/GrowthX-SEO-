import { Injectable, Logger, ServiceUnavailableException, BadGatewayException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

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
    return this.prisma.localLocation.findUnique({
      where: { projectId },
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
          'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
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

  async connectBusiness(
    projectId: string,
    placeData: { businessName: string; address: string; rating: number; reviewCount: number }
  ) {
    return this.prisma.localLocation.upsert({
      where: { projectId },
      update: {
        businessName: placeData.businessName,
        address: placeData.address,
        rating: placeData.rating,
        reviewCount: placeData.reviewCount,
      },
      create: {
        projectId,
        businessName: placeData.businessName,
        address: placeData.address,
        rating: placeData.rating,
        reviewCount: placeData.reviewCount,
        // citationsCount is left at its column default of 0. It was previously
        // seeded with `Math.random() * 50 + 10` — a number with no relationship
        // to any citation, stored and then displayed as a measured figure.
        // Zero is honest until a citation source exists to populate it.
      },
    });
  }
}
