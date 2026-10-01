import { Response, CookieOptions } from 'express';
import * as crypto from 'crypto';

/**
 * Cookie configuration for auth tokens.
 *
 * In cross-origin deployments (e.g. Vercel dashboard at app.growthx.ai and
 * Render API at api.growthx.ai), cookies must have SameSite=None and Secure=true.
 * When a shared parent domain exists, COOKIE_DOMAIN can be set (e.g. .growthx.ai).
 */
export function getCookieBaseOptions(): CookieOptions {
  const isProduction = process.env.NODE_ENV === 'production';
  const domain = process.env.COOKIE_DOMAIN || undefined;

  // Cross-origin cookies require SameSite=None and Secure=true.
  // In development, localhost is treated as a secure context by modern browsers,
  // but allow override via COOKIE_SAME_SITE / COOKIE_SECURE if running bare HTTP.
  const sameSiteConfig = process.env.COOKIE_SAME_SITE as 'none' | 'lax' | 'strict' | undefined;
  const sameSite = sameSiteConfig || (isProduction ? 'none' : 'lax');
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : (isProduction || sameSite === 'none');

  return {
    secure,
    sameSite,
    ...(domain ? { domain } : {}),
  };
}

export interface AuthTokens {
  access_token: string;
  refresh_token?: string;
}

/**
 * Sets access_token, refresh_token, csrf_token, and logged_in cookies.
 */
export function setAuthCookies(res: Response, tokens: AuthTokens): void {
  const base = getCookieBaseOptions();

  // 1. Access token — short-lived (15 min), HttpOnly
  res.cookie('access_token', tokens.access_token, {
    ...base,
    httpOnly: true,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  // 2. Refresh token — long-lived (7 days), HttpOnly, restricted to /auth/refresh
  if (tokens.refresh_token) {
    res.cookie('refresh_token', tokens.refresh_token, {
      ...base,
      httpOnly: true,
      path: '/auth/refresh',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  // 3. CSRF token — random nonce, readable by JavaScript for Double-Submit header
  const csrfToken = crypto.randomBytes(24).toString('hex');
  res.cookie('csrf_token', csrfToken, {
    ...base,
    httpOnly: false,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });

  // 4. Logged-in flag — readable by JavaScript to detect auth state without JWT decode
  res.cookie('logged_in', '1', {
    ...base,
    httpOnly: false,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/**
 * Clears all auth-related cookies on logout or session expiration.
 */
export function clearAuthCookies(res: Response): void {
  const base = getCookieBaseOptions();

  res.clearCookie('access_token', {
    ...base,
    httpOnly: true,
    path: '/',
  });

  res.clearCookie('refresh_token', {
    ...base,
    httpOnly: true,
    path: '/auth/refresh',
  });

  res.clearCookie('csrf_token', {
    ...base,
    httpOnly: false,
    path: '/',
  });

  res.clearCookie('logged_in', {
    ...base,
    httpOnly: false,
    path: '/',
  });
}
