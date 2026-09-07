import { BadGatewayException, ServiceUnavailableException } from '@nestjs/common';
import { GeoGridService } from './geo-grid.service';

/**
 * The geo grid used to invent every number it displayed: ranks came from
 * `1 + distancePenalty + quadrantBias`, competitor names from a template pool,
 * and their ratings and review counts were hardcoded (4.8, 4.6, 4.4 / 184 + r*12).
 *
 * That is the same failure already fixed in business search, review sync and
 * citation counts. These tests exist so a later refactor cannot restore it, and
 * so the stored history stays worth having — a rank history built from a
 * simulation is worse than no history, because it cannot be told apart later.
 */
describe('GeoGridService', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  function build(options: { location?: any; places?: any[][]; createdRun?: any } = {}) {
    const create = jest.fn().mockResolvedValue(
      options.createdRun ?? { id: 'run-1', ranAt: new Date('2026-09-07T00:00:00Z'), source: 'GOOGLE_PLACES' },
    );
    const prisma = {
      localLocation: {
        findFirst: jest.fn().mockResolvedValue(
          'location' in options
            ? options.location
            : { id: 'loc-1', businessName: 'Bright Smile Dental', latitude: 19.076, longitude: 72.8777 },
        ),
      },
      project: { findUnique: jest.fn().mockResolvedValue({ name: 'Bright Smile' }) },
      geoGridRun: { create, findMany: jest.fn(), findUnique: jest.fn() },
    };
    const router = { generate: jest.fn().mockRejectedValue(new Error('no model configured')) };
    const service = new GeoGridService(prisma as any, router as any);
    return { service, prisma, router, create };
  }

  function stubPlaces(pages: any[][]) {
    let call = 0;
    global.fetch = jest.fn().mockImplementation(async () => {
      const places = pages[Math.min(call++, pages.length - 1)];
      return { ok: true, json: async () => ({ places }) } as any;
    });
  }

  const place = (name: string, id = name) => ({
    id,
    displayName: { text: name },
    rating: 4.5,
    userRatingCount: 100,
  });

  describe('refusing rather than inventing', () => {
    it('refuses to scan when no Places key is configured', async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;
      const { service } = build();

      await expect(service.runGeoGridScan('p1', 'o1', { keyword: 'dentist' })).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
      await expect(service.runGeoGridScan('p1', 'o1', { keyword: 'dentist' })).rejects.toThrow(
        /GOOGLE_PLACES_API_KEY/,
      );
    });

    it('refuses rather than defaulting to a city when coordinates are missing', async () => {
      // It previously fell back to central Mumbai, silently measuring a grid
      // around a place the business has nothing to do with.
      process.env.GOOGLE_PLACES_API_KEY = 'key';
      const { service } = build({ location: { id: 'loc-1', businessName: 'Bright Smile Dental' } });

      await expect(service.runGeoGridScan('p1', 'o1', { keyword: 'dentist' })).rejects.toThrow(
        /latitude and longitude/,
      );
    });

    it('surfaces a Places failure instead of falling back to a computed rank', async () => {
      process.env.GOOGLE_PLACES_API_KEY = 'key';
      const { service } = build();
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => JSON.stringify({ error: { message: 'quota exceeded' } }),
      } as any);

      await expect(service.runGeoGridScan('p1', 'o1', { keyword: 'dentist' })).rejects.toBeInstanceOf(
        BadGatewayException,
      );
    });

    it('contains no simulated ranking or competitor data', () => {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const source = require('fs').readFileSync(require.resolve('./geo-grid.service.ts'), 'utf8');

      expect(source).not.toMatch(/quadrantBias/);
      expect(source).not.toMatch(/distancePenalty/);
      expect(source).not.toMatch(/competitorPool/);
      expect(source).not.toMatch(/Math\.random/);
    });
  });

  describe('measuring', () => {
    beforeEach(() => {
      process.env.GOOGLE_PLACES_API_KEY = 'key';
    });

    it('ranks the business by its position in the real result set', async () => {
      const { service } = build();
      stubPlaces([[place('Apex Dental'), place('Bright Smile Dental'), place('Metro Dental')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      expect(result.nodes).toHaveLength(9);
      expect(result.nodes.every((n) => n.rank === 2)).toBe(true);
      expect(result.metrics.averageGridRank).toBe(2);
      expect(result.source).toBe('GOOGLE_PLACES');
    });

    it('records absence as null, not as a numeric last place', async () => {
      // A heat map that renders "absent" and "ranked 21st" identically tells the
      // operator something untrue.
      const { service } = build();
      stubPlaces([[place('Apex Dental'), place('Metro Dental')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      expect(result.nodes.every((n) => n.rank === null)).toBe(true);
      expect(result.nodes.every((n) => n.businessFound === false)).toBe(true);
      expect(result.metrics.unrankedCount).toBe(9);
      expect(result.metrics.foundCount).toBe(0);
    });

    it('averages only the points where the business appeared', async () => {
      const { service } = build();
      let call = 0;
      global.fetch = jest.fn().mockImplementation(async () => {
        // Found first at rank 1, then absent everywhere else.
        const places = call++ === 0 ? [place('Bright Smile Dental')] : [place('Apex Dental')];
        return { ok: true, json: async () => ({ places }) } as any;
      });

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      expect(result.metrics.foundCount).toBe(1);
      expect(result.metrics.averageGridRank).toBe(1);
      expect(result.metrics.unrankedCount).toBe(8);
    });

    it('reports no average at all when the business ranks nowhere', async () => {
      const { service } = build();
      stubPlaces([[place('Apex Dental')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });
      expect(result.metrics.averageGridRank).toBeNull();
    });

    it('matches a listing whose Google name carries an extra suffix', async () => {
      const { service } = build();
      stubPlaces([[place('Bright Smile Dental Clinic')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });
      expect(result.nodes[0].rank).toBe(1);
    });

    it('does not match an unrelated business', async () => {
      const { service } = build();
      stubPlaces([[place('Dental Bright Ltd')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });
      expect(result.nodes[0].rank).toBeNull();
    });

    it('supports the four documented grid sizes', async () => {
      for (const gridSize of [3, 5, 7, 9] as const) {
        const { service } = build();
        stubPlaces([[place('Bright Smile Dental')]]);
        const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize });
        expect(result.nodes).toHaveLength(gridSize * gridSize);
      }
    });

    it('biases each lookup to its own coordinate rather than one city-wide query', async () => {
      const { service } = build();
      stubPlaces([[place('Bright Smile Dental')]]);

      await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      const bodies = (global.fetch as jest.Mock).mock.calls.map((c) => JSON.parse(c[1].body));
      const centres = new Set(
        bodies.map((b) => `${b.locationBias.circle.center.latitude},${b.locationBias.circle.center.longitude}`),
      );
      expect(centres.size).toBe(9);
    });
  });

  describe('persistence', () => {
    beforeEach(() => {
      process.env.GOOGLE_PLACES_API_KEY = 'key';
    });

    it('stores the run so the next scan has something to compare against', async () => {
      const { service, create } = build();
      stubPlaces([[place('Apex Dental'), place('Bright Smile Dental')]]);

      const result = await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      expect(result.runId).toBe('run-1');
      const data = create.mock.calls[0][0].data;
      expect(data).toMatchObject({
        projectId: 'p1',
        locationId: 'loc-1',
        keyword: 'dentist',
        gridSize: 3,
        pointCount: 9,
        foundCount: 9,
        averageRank: 2,
      });
      expect(data.points.create).toHaveLength(9);
    });

    it('stores the businesses seen at each coordinate, flagging which one is the client', async () => {
      const { service, create } = build();
      stubPlaces([[place('Apex Dental'), place('Bright Smile Dental')]]);

      await service.runGeoGridScan('p1', 'o1', { keyword: 'dentist', gridSize: 3 });

      const competitors = create.mock.calls[0][0].data.points.create[0].competitors.create;
      expect(competitors).toEqual([
        expect.objectContaining({ rank: 1, name: 'Apex Dental', isClient: false }),
        expect.objectContaining({ rank: 2, name: 'Bright Smile Dental', isClient: true }),
      ]);
    });
  });
});
