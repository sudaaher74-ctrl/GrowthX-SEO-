import { geocodeAddress } from './geocoding.util';

describe('geocoding.util', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env = { ...originalEnv, ENABLE_TEST_GEOCODING: 'true' };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  it('returns null if both address and businessName are empty', async () => {
    const result = await geocodeAddress('', '');
    expect(result).toBeNull();
  });

  it('geocodes via Google Places Text Search when apiKey is provided and succeeds', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        places: [
          {
            id: 'place-123',
            formattedAddress: '123 MG Road, Pune, Maharashtra',
            location: { latitude: 18.5204, longitude: 73.8567 },
          },
        ],
      }),
    } as any);

    const result = await geocodeAddress('Pune, Maharashtra', 'MilquuFresh', 'google-key-123');
    expect(result).toEqual({
      lat: 18.5204,
      lng: 73.8567,
      formattedAddress: '123 MG Road, Pune, Maharashtra',
      placeId: 'place-123',
    });
  });

  it('falls back to Nominatim when Google Places fails or returns no location', async () => {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async (url: string) => {
      call++;
      if (typeof url === 'string' && url.includes('places.googleapis.com')) {
        return { ok: false, status: 500 } as any;
      }
      return {
        ok: true,
        json: async () => [
          {
            lat: '18.5204303',
            lon: '73.8567437',
            display_name: 'Pune, Maharashtra, India',
          },
        ],
      } as any;
    });

    const result = await geocodeAddress('Pune, Maharashtra', undefined, 'google-key-123');
    expect(result).toEqual({
      lat: 18.5204303,
      lng: 73.8567437,
      formattedAddress: 'Pune, Maharashtra, India',
    });
  });

  it('geocodes via Nominatim directly when no Google Places key is provided', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        {
          lat: '18.5072618',
          lon: '73.8056676',
          display_name: 'Kothrud, Pune, Maharashtra, India',
        },
      ],
    } as any);

    const result = await geocodeAddress('Kothrud, Pune');
    expect(result).toEqual({
      lat: 18.5072618,
      lng: 73.8056676,
      formattedAddress: 'Kothrud, Pune, Maharashtra, India',
    });
  });

  it('returns null if all geocoding services return empty results', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    } as any);

    const result = await geocodeAddress('Unknown Nonexistent Location 99999');
    expect(result).toBeNull();
  });
});
