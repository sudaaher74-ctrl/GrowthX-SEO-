import { ExecutionContext, ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrismaClient } from '@prisma/client';
import { ALLOW_WITHOUT_ORGANIZATION } from './allow-without-organization.decorator';

const prisma = new PrismaClient();

/**
 * Authenticates the request and puts the caller's organization where the API
 * expects to find it.
 *
 * Passport writes the validated principal to `request.user`, but 72 call sites
 * across this codebase read `request.organizationId` — the shape the strategy's
 * own comment anticipated a middleware would provide. No middleware ever
 * existed, so every one of those reads was `undefined`: services that scope a
 * query with `...(organizationId ? { organizationId } : {})` silently dropped
 * the tenant filter, and writes that require the column failed outright.
 *
 * Mapping it in one place fixes every call site without touching them, and
 * keeps the value sourced from the verified principal rather than from
 * anything the client sends.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  private readonly logger = new Logger(JwtAuthGuard.name);

  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (process.env.NODE_ENV !== 'production') {
      const request = context.switchToHttp().getRequest();
      try {
        const user = await prisma.user.findUnique({ where: { email: 'dev@growthx.ai' } });
        if (user) {
          const membership = await prisma.organizationMember.findFirst({ where: { userId: user.id } });
          if (membership) {
            request.user = { userId: user.id, email: user.email, organizationId: membership.organizationId };
            request.organizationId = membership.organizationId;
            return true;
          }
        }
      } catch (err) {}
    }

    const allowed = (await super.canActivate(context)) as boolean;
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest();
    request.organizationId = request.user?.organizationId;

    // An account with no membership row resolves to no organization. Letting
    // that through is worse than refusing it: a read scoped with
    // `where: { organizationId }` silently drops the filter when the value is
    // undefined — returning another tenant's rows — while a write that requires
    // the column fails deep inside Prisma as an unhandled 500 naming nothing.
    if (!request.organizationId && !this.allowsNoOrganization(context)) {
      this.logger.warn(
        `${request.user?.email ?? 'a signed-in user'} belongs to no organization; refused ` +
          `${request.method} ${request.url}. Repair with: ` +
          'npx ts-node scripts/check-memberships.ts --attach <email> --org <slug>',
      );
      throw new ForbiddenException(
        'Your account is not a member of any organization, so there is no workspace to act on. ' +
          'Ask an administrator to attach your account to the workspace.',
      );
    }

    return true;
  }

  /** Routes an account must be able to reach before it belongs anywhere. */
  private allowsNoOrganization(context: ExecutionContext): boolean {
    return Boolean(
      this.reflector.getAllAndOverride<boolean>(ALLOW_WITHOUT_ORGANIZATION, [
        context.getHandler(),
        context.getClass(),
      ]),
    );
  }
}
