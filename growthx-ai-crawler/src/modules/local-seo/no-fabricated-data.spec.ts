import { ServiceUnavailableException } from '@nestjs/common';
import { LocalSeoService } from './local-seo.service';
/**
 * Three paths used to invent data when their source was unconfigured, and all
 * three were live on the deployed instance.
 *
 * Fabricated data is worse than a missing feature because it cannot be told
 * apart from the real thing afterwards. These tests exist so a later refactor
 * cannot quietly restore any of them.
 */
describe('local SEO — no fabricated data', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('business search', () => {
    it('refuses rather than returning invented businesses when unconfigured', async () => {
      delete process.env.GOOGLE_PLACES_API_KEY;
      const service = new LocalSeoService({} as any);

      // It returned "GrowthX Corp., 123 Market St, San Francisco, rating 4.8"
      // — a business that does not exist, which an operator could attach to a
      // project as their own.
      await expect(service.searchBusiness('anything')).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(service.searchBusiness('anything')).rejects.toThrow(/GOOGLE_PLACES_API_KEY/);
    });
  });

  describe('citation counts', () => {
    it('never seeds a citation count with a random number', () => {
      const fs = jest.requireActual<typeof import('fs')>('fs');
      const source = fs.readFileSync(require.resolve('./local-seo.service.ts'), 'utf8');

      // `Math.floor(Math.random() * 50) + 10` was written to citationsCount and
      // displayed as a measured figure.
      expect(source).not.toMatch(/citationsCount:\s*Math\.random|citationsCount:\s*Math\.floor\(Math\.random/);
    });
  });
});
