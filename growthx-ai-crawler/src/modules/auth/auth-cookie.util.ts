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

export function setCsrfCookie(
  res: Response,
  csrfToken = crypto.randomBytes(24).toString('hex'),
): string {
  res.cookie('csrf_token', csrfToken, {
    ...getCookieBaseOptions(),
    httpOnly: false,
    path: '/',
    maxAge: 15 * 60 * 1000,
  });
  return csrfToken;
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

  // 2. Refresh token — lifetime matches the server-side RefreshSession (default
  //    30 days), HttpOnly, restricted to the auth endpoints that consume it.
  if (tokens.refresh_token) {
    const parsedDays = parseInt(process.env.JWT_REFRESH_EXPIRES_IN || '30', 10);
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? parsedDays : 30;
    res.cookie('refresh_token', tokens.refresh_token, {
      ...base,
      httpOnly: true,
      path: '/auth',
      maxAge: days * 24 * 60 * 60 * 1000,
    });
  }

  // 3. CSRF token — random nonce, readable by JavaScript for Double-Submit header
  setCsrfCookie(res);

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

  // Cleared under both the current and the previous path so sessions created
  // before the path widened to /auth are also removed on logout.
  res.clearCookie('refresh_token', { ...base, httpOnly: true, path: '/auth' });
  res.clearCookie('refresh_token', { ...base, httpOnly: true, path: '/auth/refresh' });

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
