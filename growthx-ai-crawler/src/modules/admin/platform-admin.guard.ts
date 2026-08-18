import { CanActivate, ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';

/**
 * Restricts the platform-operator surface to a named allowlist.
 *
 * `/api/admin/*` reports queue depth, LLM spend, and a directory of every
 * organization on the platform with its owner's email. It was guarded by
 * `JwtAuthGuard` alone, which only proves the caller has *an* account — so any
 * customer could read the full tenant list.
 *
 * Roles in this product are per-organization (`OrganizationMember.role`), so
 * there is no in-schema notion of a platform operator to check against. The
 * allowlist is deployment configuration instead, and an unset list denies
 * everyone rather than allowing everyone: an operator who cannot reach their
 * own dashboard will say so, whereas a silently open one stays open.
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
    const email: string | undefined = request.user?.email?.toLowerCase();

    if (allowed.length === 0) {
      this.logger.warn(
        'Refused an /api/admin request: PLATFORM_ADMIN_EMAILS is not set, so no account can reach the operator dashboard.',
      );
      throw new ForbiddenException(
        'The platform admin area is not configured on this deployment (PLATFORM_ADMIN_EMAILS is unset).',
      );
    }

    if (!email || !allowed.includes(email)) {
      throw new ForbiddenException('This area is restricted to GrowthX platform operators.');
    }

    return true;
  }
}
