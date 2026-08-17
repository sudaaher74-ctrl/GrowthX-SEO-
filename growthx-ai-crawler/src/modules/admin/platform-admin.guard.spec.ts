import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

function contextFor(email?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => (email ? { user: { email } } : {}) }),
  } as unknown as ExecutionContext;
}

describe('PlatformAdminGuard', () => {
  const guard = new PlatformAdminGuard();
  const original = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (original === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = original;
  });

  it('admits nobody when the allowlist is unset', () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(() => guard.canActivate(contextFor('anyone@example.com'))).toThrow(ForbiddenException);
  });

  it('admits nobody when the allowlist is empty or only separators', () => {
    process.env.PLATFORM_ADMIN_EMAILS = ' , , ';
    expect(() => guard.canActivate(contextFor('anyone@example.com'))).toThrow(ForbiddenException);
  });

  it('refuses a signed-in account that is not an operator', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@growthx.ai';
    // This is the exact case that leaked: a self-registered customer account.
    expect(() => guard.canActivate(contextFor('growthx-qa-123@example.com'))).toThrow(ForbiddenException);
  });

  it('refuses a caller with no identity at all', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@growthx.ai';
    expect(() => guard.canActivate(contextFor())).toThrow(ForbiddenException);
  });

  it('admits a listed operator', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'ops@growthx.ai,second@growthx.ai';
    expect(guard.canActivate(contextFor('second@growthx.ai'))).toBe(true);
  });

  it('matches operators case-insensitively and ignores surrounding spaces', () => {
    process.env.PLATFORM_ADMIN_EMAILS = '  Ops@GrowthX.ai  ';
    expect(guard.canActivate(contextFor('ops@growthx.AI'))).toBe(true);
  });
});
