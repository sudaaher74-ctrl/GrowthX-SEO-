import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { ALLOW_WITHOUT_ORGANIZATION } from './allow-without-organization.decorator';

/**
 * The guard is what stands between a membership row and the rest of the API.
 * An account that resolves to no organization used to be let through, which
 * dropped the tenant filter on reads and failed writes as an opaque 500.
 */
describe('JwtAuthGuard — organization resolution', () => {
  const parentPrototype = Object.getPrototypeOf(JwtAuthGuard.prototype);

  beforeEach(() => {
    jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(true);
  });

  afterEach(() => jest.restoreAllMocks());

  function contextFor(user: unknown) {
    const request: any = { user, method: 'POST', url: '/api/projects/p1/content-intelligence/strategy/generate' };
    return {
      request,
      context: {
        switchToHttp: () => ({ getRequest: () => request }),
        getHandler: () => function handler() {},
        getClass: () => class Controller {},
      } as unknown as ExecutionContext,
    };
  }

  function guardWith(exempt: boolean) {
    const reflector = new Reflector();
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementation((key: any) => (key === ALLOW_WITHOUT_ORGANIZATION ? exempt : undefined) as any);
    return new JwtAuthGuard(reflector);
  }

  it('puts the resolved organization where the API reads it', async () => {
    const { context, request } = contextFor({ userId: 'u1', email: 'a@b.c', organizationId: 'org_1' });

    await expect(guardWith(false).canActivate(context)).resolves.toBe(true);
    expect(request.organizationId).toBe('org_1');
  });

  it('refuses a workspace-scoped route when the account belongs to no organization', async () => {
    const { context } = contextFor({ userId: 'u1', email: 'stranded@example.com' });

    await expect(guardWith(false).canActivate(context)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still lets that account reach the routes that create its first organization', async () => {
    const { context } = contextFor({ userId: 'u1', email: 'stranded@example.com' });

    await expect(guardWith(true).canActivate(context)).resolves.toBe(true);
  });

  it('does not mask a failed authentication as a membership problem', async () => {
    jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(false);
    const { context } = contextFor(undefined);

    await expect(guardWith(false).canActivate(context)).resolves.toBe(false);
  });

  /**
   * The guard used to short-circuit to `true` for every request whenever
   * NODE_ENV was not exactly 'production', signing the caller in as a
   * hard-coded account without a token. NODE_ENV is unset under `nest start`
   * and on any host that does not set it, so that branch was reachable in
   * places nobody thought of as development.
   */
  it.each(['development', 'test', 'staging', undefined])(
    'refuses an unauthenticated request with NODE_ENV=%s',
    async (env) => {
      const previous = process.env.NODE_ENV;
      if (env === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = env;

      try {
        jest.spyOn(parentPrototype, 'canActivate').mockResolvedValue(false);
        const { context, request } = contextFor(undefined);

        await expect(guardWith(false).canActivate(context)).resolves.toBe(false);
        expect(request.organizationId).toBeUndefined();
      } finally {
        if (previous === undefined) delete process.env.NODE_ENV;
        else process.env.NODE_ENV = previous;
      }
    },
  );
});
