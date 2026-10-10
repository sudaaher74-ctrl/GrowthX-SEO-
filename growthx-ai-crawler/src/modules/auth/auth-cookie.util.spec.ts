import { Response } from 'express';
import { setAuthCookies, clearAuthCookies, getCookieBaseOptions } from './auth-cookie.util';

describe('auth-cookie.util', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sets secure and sameSite=none in production', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.COOKIE_SAME_SITE;
    delete process.env.COOKIE_SECURE;

    const opts = getCookieBaseOptions();
    expect(opts.secure).toBe(true);
    expect(opts.sameSite).toBe('none');
  });

  it('respects COOKIE_DOMAIN if configured', () => {
    process.env.COOKIE_DOMAIN = '.growthx.ai';
    const opts = getCookieBaseOptions();
    expect(opts.domain).toBe('.growthx.ai');
  });

  it('sets access_token, refresh_token, csrf_token, and logged_in cookies', () => {
    const cookies: Record<string, { value: string; options: any }> = {};
    const mockRes = {
      clearCookie: jest.fn(),
      cookie: jest.fn((name: string, value: string, options: any) => {
        cookies[name] = { value, options };
      }),
    } as unknown as Response;

    setAuthCookies(mockRes, {
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
    });

    expect(mockRes.cookie).toHaveBeenCalledTimes(4);
    expect(cookies['access_token'].value).toBe('test-access-token');
    expect(cookies['access_token'].options.httpOnly).toBe(true);
    expect(cookies['access_token'].options.path).toBe('/');

    expect(cookies['refresh_token'].value).toBe('test-refresh-token');
    expect(cookies['refresh_token'].options.httpOnly).toBe(true);
    expect(cookies['refresh_token'].options.path).toBe('/auth');

    expect(cookies['csrf_token'].value).toBeDefined();
    expect(cookies['csrf_token'].options.httpOnly).toBe(false);

    expect(cookies['logged_in'].value).toBe('1');
    expect(cookies['logged_in'].options.httpOnly).toBe(false);
    expect(cookies['logged_in'].options.maxAge).toBe(cookies['refresh_token'].options.maxAge);
    expect(mockRes.clearCookie).toHaveBeenCalledWith('refresh_token', expect.objectContaining({ path: '/auth/refresh' }));
  });

  it('clears auth cookies on logout', () => {
    const cleared: Record<string, any>[] = [];
    const mockRes = {
      clearCookie: jest.fn((name: string, options: any) => {
        cleared.push({ name, ...options });
      }),
    } as unknown as Response;

    clearAuthCookies(mockRes);

    expect(mockRes.clearCookie).toHaveBeenCalledTimes(5);
    expect(cleared.some((c) => c.name === 'access_token' && c.path === '/')).toBe(true);
    expect(cleared.some((c) => c.name === 'refresh_token' && c.path === '/auth')).toBe(true);
    expect(cleared.some((c) => c.name === 'refresh_token' && c.path === '/auth/refresh')).toBe(true);
    expect(cleared.some((c) => c.name === 'csrf_token' && c.path === '/')).toBe(true);
    expect(cleared.some((c) => c.name === 'logged_in' && c.path === '/')).toBe(true);
  });
});
