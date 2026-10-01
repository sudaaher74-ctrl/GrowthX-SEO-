import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Routes that do not operate on an existing authenticated session. */
const EXEMPT_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/exchange',
  '/auth/google',
  '/api/docs',
];

/**
 * Double-Submit Cookie CSRF protection.
 *
 * When a request relies on the browser-managed `access_token` cookie for
 * authentication (rather than an explicit `Authorization: Bearer` header),
 * this guard ensures the caller also provided matching `X-CSRF-Token` header
 * matching the `csrf_token` cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) and non-cookie clients (Bearer header)
 * are exempt.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();

    // 1. Safe HTTP methods do not mutate state
    if (SAFE_METHODS.has(req.method.toUpperCase())) {
      return true;
    }

    // 2. Explicit Bearer header clients are immune to cross-site request forgery
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
      return true;
    }

    // 3. Unauthenticated auth endpoints
    const path = req.path || req.url;
    if (EXEMPT_PATHS.some((exempt) => path.startsWith(exempt))) {
      return true;
    }

    // 4. If request is not carrying an access_token cookie, let JWT guard handle 401
    const hasAccessCookie = Boolean(req.cookies?.access_token);
    if (!hasAccessCookie) {
      return true;
    }

    // 5. Enforce double-submit token match
    const headerToken = (req.headers['x-csrf-token'] as string | undefined)?.trim();
    const cookieToken = req.cookies?.csrf_token;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
