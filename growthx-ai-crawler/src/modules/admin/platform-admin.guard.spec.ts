import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PlatformAdminGuard } from './platform-admin.guard';

describe('PlatformAdminGuard deployment configuration', () => {
  const previous = process.env.PLATFORM_ADMIN_EMAILS;
  afterEach(() => {
    if (previous === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = previous;
  });
  const request = (email: string) => ({
    switchToHttp: () => ({ getRequest: () => ({ user: { email } }) }),
  }) as unknown as ExecutionContext;

  it('denies the former bootstrap identity when no operator allowlist is configured', () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(() => new PlatformAdminGuard().canActivate(request('milquufresh@gmail.com')))
      .toThrow(ForbiddenException);
  });

  it('permits a configured operator case-insensitively', () => {
    process.env.PLATFORM_ADMIN_EMAILS = ' operator@example.invalid ';
    expect(new PlatformAdminGuard().canActivate(request('OPERATOR@example.invalid'))).toBe(true);
  });

  it('denies an account outside the configured allowlist', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'operator@example.invalid';
    expect(() => new PlatformAdminGuard().canActivate(request('outsider@example.invalid')))
      .toThrow(ForbiddenException);
  });
});
