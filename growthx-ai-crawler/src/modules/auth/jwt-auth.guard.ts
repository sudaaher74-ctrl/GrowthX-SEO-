import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

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
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const allowed = (await super.canActivate(context)) as boolean;
    if (!allowed) return false;

    const request = context.switchToHttp().getRequest();
    request.organizationId = request.user?.organizationId;

    return true;
  }
}
