import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';

/**
 * Restricts a route to the people who operate the platform.
 *
 * The admin routes report across every tenant — the workspace directory with
 * owner emails and plans, queue depth, and model spend. They were protected by
 * `JwtAuthGuard` alone, which only asks "is this someone", not "is this us", so
 * any self-registered account could read the full customer list.
 *
 * There is no platform-admin flag on `User` (its only roles are per
 * organization, which is the wrong scope for a cross-tenant view), so the
 * operator list is configuration: `PLATFORM_ADMIN_EMAILS`, comma separated.
 *
 * It fails closed. An unset or empty list admits nobody, because the failure
 * that matters here is admitting everyone — which is exactly what happened.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  private readonly logger = new Logger(PlatformAdminGuard.name);

  private allowlist(): string[] {
    return (process.env.PLATFORM_ADMIN_EMAILS ?? '')
      .split(',')
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
  }

  canActivate(context: ExecutionContext): boolean {
    const allowed = this.allowlist();
    const request = context.switchToHttp().getRequest();
    const email = String(request?.user?.email ?? '').toLowerCase();

    if (allowed.length === 0) {
      this.logger.error(
        'PLATFORM_ADMIN_EMAILS is not set, so the admin routes admit nobody. ' +
          'Set it to the comma-separated emails of the platform operators.',
      );
      throw new ForbiddenException('Platform administration is not configured.');
    }

    if (!email || !allowed.includes(email)) {
      this.logger.warn(`Refused admin access for ${email || 'an unidentified caller'}.`);
      throw new ForbiddenException('This endpoint is restricted to platform administrators.');
    }

    return true;
  }
}
