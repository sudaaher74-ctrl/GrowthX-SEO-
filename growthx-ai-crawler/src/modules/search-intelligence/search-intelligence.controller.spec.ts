import { GUARDS_METADATA } from '@nestjs/common/constants';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SearchIntelligenceController } from './search-intelligence.controller';
import { SearchRankingsQueryDto } from './search-intelligence.dto';

describe('SearchIntelligenceController', () => {
  function build(over: { searchConsole?: boolean; analytics?: boolean; live?: boolean } = {}) {
    const chosen: Record<string, boolean> = { search_console: over.searchConsole ?? false, analytics: over.analytics ?? false };
    const prisma = {
      integration: {
        findUnique: jest.fn(async ({ where }: any) => (chosen[where.projectId_provider.provider] ? { selectedResourceId: 'chosen' } : null)),
      },
      project: { findUnique: jest.fn(async () => ({ searchCountry: 'India', searchLanguage: 'en' })) },
    };
    const dataforseo = { isConfigured: jest.fn(() => over.live ?? false) };
    const searchRankings = { report: jest.fn().mockResolvedValue({ rows: [] }) };
    const controller = new SearchIntelligenceController(
      prisma as any,
      dataforseo as any,
      {} as any,
      {} as any,
      {} as any,
      searchRankings as any,
      {} as any,
      {} as any,
      {} as any,
    );
    return { controller, searchRankings };
  }

  describe('status', () => {
    it('reports the customer’s own connections separately from the platform’s live-results source', async () => {
      const both = await build({ searchConsole: true, analytics: true }).controller.status('p1');
      expect(both).toMatchObject({ searchConsoleConnected: true, analyticsConnected: true, googleResultsConnected: false });

      const searchConsoleOnly = await build({ searchConsole: true }).controller.status('p1');
      expect(searchConsoleOnly).toMatchObject({ searchConsoleConnected: true, analyticsConnected: false });

      const nothing = await build().controller.status('p1');
      expect(nothing).toMatchObject({ searchConsoleConnected: false, analyticsConnected: false, googleResultsConnected: false });
    });

    it('does not let live results stand in for a connection', async () => {
      // A platform with the paid source but a customer who has connected nothing.
      const status = await build({ live: true }).controller.status('p1');
      expect(status).toMatchObject({ googleResultsConnected: true, searchConsoleConnected: false, analyticsConnected: false });
    });

    it('still names the market results are checked in', async () => {
      const status = await build().controller.status('p1');
      expect(status.market).toEqual({ country: 'India', language: 'en', source: 'SET' });
    });
  });

  it('passes the window and the number of searches through to the rankings report', async () => {
    const { controller, searchRankings } = build();
    await controller.searchRankingsReport('p1', { days: 90, limit: 40 });
    expect(searchRankings.report).toHaveBeenCalledWith('p1', { days: 90, limit: 40 });
  });

  it('is behind the login guard', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, SearchIntelligenceController)).toContain(JwtAuthGuard);
  });
});

describe('SearchRankingsQueryDto', () => {
  const check = (query: unknown) => validate(plainToInstance(SearchRankingsQueryDto, query));

  it('takes the dashboard’s windows, as the strings a query string carries', async () => {
    for (const days of ['7', '28', '90', '365']) expect(await check({ days })).toHaveLength(0);
    expect(await check({})).toHaveLength(0);
    expect(plainToInstance(SearchRankingsQueryDto, { days: '90', limit: '40' })).toMatchObject({ days: 90, limit: 40 });
  });

  it.each([{ days: '6' }, { days: '366' }, { days: 'many' }, { days: '28.5' }, { limit: '0' }, { limit: '501' }])(
    'refuses %j',
    async (query) => {
      expect((await check(query)).length).toBeGreaterThan(0);
    },
  );
});
