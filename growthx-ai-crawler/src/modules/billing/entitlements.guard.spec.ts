import { Reflector } from '@nestjs/core';
import { ExecutionContext, InternalServerErrorException } from '@nestjs/common';
import { EntitlementsGuard } from './entitlements.guard';
import { Feature } from './plans.catalog';
import { NO_ENTITLEMENT_KEY, REQUIRED_FEATURES_KEY, REQUIRED_QUOTA_KEY } from './entitlements.decorator';

function contextFor(): ExecutionContext {
  const request: any = { user: { userId: 'u1' }, headers: {}, params: {} };
  return {
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('EntitlementsGuard', () => {
  let reflector: Reflector;
  let entitlements: any;
  let orgContext: any;
  let guard: EntitlementsGuard;

  beforeEach(() => {
    reflector = new Reflector();
    entitlements = { assertFeature: jest.fn(), assertQuota: jest.fn() };
    orgContext = { resolve: jest.fn().mockResolvedValue('org_1') };
    guard = new EntitlementsGuard(reflector, entitlements, orgContext);
  });

  function declare(values: Record<string, unknown>) {
    jest.spyOn(reflector, 'getAllAndOverride').mockImplementation((key: any) => values[key] as any);
  }

  // The bug this replaces: a controller with the guard but no decorators was
  // waved through, which read as protected while charging nobody.
  it('refuses a guarded route that declares no plan requirement', async () => {
    declare({});

    await expect(guard.canActivate(contextFor())).rejects.toThrow(InternalServerErrorException);
    expect(entitlements.assertFeature).not.toHaveBeenCalled();
  });

  it('allows a route explicitly marked as needing no gate', async () => {
    declare({ [NO_ENTITLEMENT_KEY]: 'billing must stay reachable to upgrade' });

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
  });

  it('enforces a declared feature', async () => {
    declare({ [REQUIRED_FEATURES_KEY]: [Feature.MARKET_STRATEGY] });

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(entitlements.assertFeature).toHaveBeenCalledWith('org_1', Feature.MARKET_STRATEGY);
  });

  it('enforces a declared quota', async () => {
    declare({ [REQUIRED_QUOTA_KEY]: { metric: 'AI_ANALYSES', amount: 1 } });

    await expect(guard.canActivate(contextFor())).resolves.toBe(true);
    expect(entitlements.assertQuota).toHaveBeenCalledWith('org_1', 'AI_ANALYSES', 1);
  });
});
