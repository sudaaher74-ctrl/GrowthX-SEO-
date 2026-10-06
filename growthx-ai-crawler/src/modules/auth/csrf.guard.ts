import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Request } from 'express';
import { allowedBrowserOrigins } from '../../config/allowed-origins';

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
 * CSRF protection for browser sessions carried in cookies.
 *
 * Two independent checks on every state-changing request that does not use an
 * explicit `Authorization: Bearer` header:
 *
 * 1. Origin: if the browser sent an `Origin` header it must be one we allow.
 *    Browsers always send it on cross-site POST/PUT/PATCH/DELETE, so a forged
 *    request from another site is refused even before any token is compared.
 * 2. Double-submit: when the request authenticates with the `access_token`
 *    cookie, `X-CSRF-Token` must match the `csrf_token` cookie.
 *
 * Safe methods (GET, HEAD, OPTIONS) and Bearer-header clients are exempt:
 * a header the browser does not attach by itself cannot be forged cross-site.
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

    // 3. Origin must be allowed whenever the browser states one
    const origin = (req.headers.origin as string | undefined)?.trim().replace(/\/+$/, '');
    if (origin && origin !== 'null' && !allowedBrowserOrigins().includes(origin)) {
      throw new ForbiddenException('Request origin is not allowed');
    }
    if (origin === 'null') {
      throw new ForbiddenException('Request origin is not allowed');
    }

    // 4. Unauthenticated auth endpoints
    const path = req.path || req.url;
    if (EXEMPT_PATHS.some((exempt) => path.startsWith(exempt))) {
      return true;
    }

    // 5. If request is not carrying an access_token cookie, let JWT guard handle 401
    const hasAccessCookie = Boolean(req.cookies?.access_token);
    if (!hasAccessCookie) {
      return true;
    }

    // 6. Enforce double-submit token match
    const headerToken = (req.headers['x-csrf-token'] as string | undefined)?.trim();
    const cookieToken = req.cookies?.csrf_token;

    if (!headerToken || !cookieToken || headerToken !== cookieToken) {
      throw new ForbiddenException('Invalid or missing CSRF token');
    }

    return true;
  }
}
