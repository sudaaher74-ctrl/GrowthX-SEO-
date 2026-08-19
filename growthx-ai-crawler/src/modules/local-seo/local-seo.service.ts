import { Injectable, Logger } from '@nestjs/common';
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

  async searchBusiness(query: string) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey) {
      this.logger.warn('GOOGLE_PLACES_API_KEY is not set. Returning mock search results.');
      return [
        { placeId: 'mock_1', name: 'GrowthX Corp.', address: '123 Market St, San Francisco', rating: 4.8, userRatingsTotal: 142 },
        { placeId: 'mock_2', name: 'GrowthX Agency', address: '456 Main St, New York', rating: 4.5, userRatingsTotal: 89 },
      ];
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
        throw new Error(`Google Places API error: ${errorText}`);
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
      this.logger.error(`Failed to search Google Places: ${err}`);
      throw err;
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
        citationsCount: Math.floor(Math.random() * 50) + 10, // Mocked citations count for now
      },
    });
  }
}
