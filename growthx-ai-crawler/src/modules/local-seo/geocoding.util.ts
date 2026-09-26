import { Logger } from '@nestjs/common';

const logger = new Logger('GeocodingUtil');

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress?: string;
  placeId?: string;
}

/**
 * Resolves a real-world address or city name to physical geographic coordinates (latitude & longitude).
 *
 * 1. Tries Google Places (New) Text Search if GOOGLE_PLACES_API_KEY is configured.
 * 2. Falls back to OpenStreetMap Nominatim (free, open, global coverage, no API key required).
 */
export async function geocodeAddress(
  address: string,
  businessName?: string,
  apiKey?: string,
): Promise<GeocodeResult | null> {
  if (process.env.NODE_ENV === 'test' && !process.env.ENABLE_TEST_GEOCODING) {
    return null;
  }

  const cleanAddress = address?.trim();
  const cleanBusiness = businessName?.trim();
  if (!cleanAddress && !cleanBusiness) return null;

  const queries = [
    cleanBusiness && cleanAddress ? `${cleanBusiness}, ${cleanAddress}` : null,
    cleanAddress,
  ].filter((q): q is string => Boolean(q && q.length > 1));

  // 1. Try Google Places Text Search if API key is present
  if (apiKey) {
    for (const query of queries) {
      try {
        const response = await fetch(`https://places.googleapis.com/v1/places:searchText`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
          },
          body: JSON.stringify({
            textQuery: query,
            maxResultCount: 1,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          const place = data.places?.[0];
          if (
            typeof place?.location?.latitude === 'number' &&
            typeof place?.location?.longitude === 'number'
          ) {
            return {
              lat: place.location.latitude,
              lng: place.location.longitude,
              formattedAddress: place.formattedAddress,
              placeId: place.id,
            };
          }
        }
      } catch (err) {
        logger.debug(`Google Places geocode failed for "${query}": ${err}`);
      }
    }
  }

  // 2. OpenStreetMap Nominatim fallback (open, free, highly accurate, worldwide coverage)
  for (const query of queries) {
    try {
      const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`;
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'GrowthX-AI-SEO/1.0 (contact@growthx.ai)',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length > 0) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          if (!isNaN(lat) && !isNaN(lng)) {
            return {
              lat,
              lng,
              formattedAddress: data[0].display_name,
            };
          }
        }
      }
    } catch (err) {
      logger.debug(`Nominatim geocode failed for "${query}": ${err}`);
    }
  }

  return null;
}
