import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { CsrfGuard } from './csrf.guard';

describe('CsrfGuard', () => {
  let guard: CsrfGuard;

  beforeEach(() => {
    guard = new CsrfGuard();
  });

  function createMockContext(req: any): ExecutionContext {
    return {
      switchToHttp: () => ({
        getRequest: () => req,
      }),
    } as unknown as ExecutionContext;
  }

  it('allows safe HTTP methods (GET, HEAD, OPTIONS) without check', () => {
    const ctx = createMockContext({
      method: 'GET',
      headers: {},
      cookies: { access_token: 'valid' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows mutating requests with Authorization: Bearer header', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/projects',
      headers: { authorization: 'Bearer some-token' },
      cookies: {},
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows exempt paths such as /auth/login and /auth/exchange', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/auth/login',
      headers: {},
      cookies: {},
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('allows requests without access_token cookie (delegates to auth guard)', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/projects',
      headers: {},
      cookies: {},
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('rejects cookie-authenticated requests with missing CSRF token', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/projects',
      headers: {},
      cookies: { access_token: 'valid-jwt', csrf_token: 'secret-nonce' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('rejects cookie-authenticated requests with mismatched CSRF token', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/projects',
      headers: { 'x-csrf-token': 'wrong-nonce' },
      cookies: { access_token: 'valid-jwt', csrf_token: 'secret-nonce' },
    });
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('accepts cookie-authenticated requests with matching CSRF token', () => {
    const ctx = createMockContext({
      method: 'POST',
      path: '/api/projects',
      headers: { 'x-csrf-token': 'secret-nonce' },
      cookies: { access_token: 'valid-jwt', csrf_token: 'secret-nonce' },
    });
    expect(guard.canActivate(ctx)).toBe(true);
  });

  describe('Origin check', () => {
    const post = (origin?: string) =>
      createMockContext({
        method: 'POST',
        path: '/api/projects',
        headers: origin === undefined ? {} : { origin },
        cookies: {},
      });

    it('rejects a state-changing request from an origin that is not allowed', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      expect(() => guard.canActivate(post('https://evil.example'))).toThrow(ForbiddenException);
    });

    it('rejects the opaque "null" origin', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      expect(() => guard.canActivate(post('null'))).toThrow(ForbiddenException);
    });

    it('accepts an allowed origin', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      expect(guard.canActivate(post('https://app.example.com'))).toBe(true);
    });

    it('rejects a forged origin even on the login route', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com';
      const ctx = createMockContext({ method: 'POST', path: '/auth/login', headers: { origin: 'https://evil.example' }, cookies: {} });
      expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
    });

    afterEach(() => {
      delete process.env.CORS_ALLOWED_ORIGINS;
    });
  });
});
