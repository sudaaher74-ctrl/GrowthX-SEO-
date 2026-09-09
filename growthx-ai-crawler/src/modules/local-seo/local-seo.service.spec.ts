import { BadGatewayException } from '@nestjs/common';
import { LocalSeoService } from './local-seo.service';

/**
 * A Places 403 says "The caller does not have permission" whichever of several
 * unrelated misconfigurations caused it. The operator reading that message is
 * the one who has to fix it, so what reaches them has to name the cause and the
 * project it applies to.
 */
describe('LocalSeoService — Places failures name their cause', () => {
  const service = () => new LocalSeoService({} as any);

  function respondWith(body: unknown, status = 403) {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status,
      text: async () => JSON.stringify(body),
    }) as any;
  }

  const originalKey = process.env.GOOGLE_PLACES_API_KEY;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GOOGLE_PLACES_API_KEY;
    else process.env.GOOGLE_PLACES_API_KEY = originalKey;
    global.fetch = originalFetch;
  });

  it('names the disabled service and the project Google billed', async () => {
    respondWith({
      error: {
        code: 403,
        message: 'The caller does not have permission',
        status: 'PERMISSION_DENIED',
        details: [
          {
            reason: 'SERVICE_DISABLED',
            metadata: { service: 'places.googleapis.com', consumer: 'projects/333951092120' },
          },
        ],
      },
    });

    // The project number is the point: a key belonging to a different project
    // from the one being configured is invisible without it.
    await expect(service().searchBusiness('a business')).rejects.toThrow(/SERVICE_DISABLED/);
    await expect(service().searchBusiness('a business')).rejects.toThrow(/333951092120/);
    await expect(service().searchBusiness('a business')).rejects.toThrow(/Places API \(New\)/);
  });

  it('distinguishes a key restriction from a disabled API', async () => {
    respondWith({
      error: {
        message: 'The caller does not have permission',
        details: [{ reason: 'API_KEY_SERVICE_BLOCKED', metadata: { consumer: 'projects/1' } }],
      },
    });

    await expect(service().searchBusiness('a business')).rejects.toThrow(/API restrictions/);
  });

  it('still reports a failure carrying no machine-readable reason', async () => {
    respondWith({ error: { message: 'Something broke' } });

    const error = await service()
      .searchBusiness('a business')
      .catch((err) => err);

    expect(error).toBeInstanceOf(BadGatewayException);
    expect(error.message).toContain('Something broke');
  });

  it('never puts the API key in a message that reaches the browser', async () => {
    process.env.GOOGLE_PLACES_API_KEY = 'super-secret-key-value';
    respondWith({
      error: {
        message: 'The caller does not have permission',
        details: [{ reason: 'API_KEY_INVALID', metadata: { consumer: 'projects/1' } }],
      },
    });

    const error = await service()
      .searchBusiness('a business')
      .catch((err) => err);

    expect(error.message).not.toContain('super-secret-key-value');
  });
});
