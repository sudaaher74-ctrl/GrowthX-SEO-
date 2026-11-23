import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlatformAdminService } from './platform-admin.service';

/**
 * Restricts platform-operator endpoints to explicitly provisioned, verified
 * immutable user IDs via {@link PlatformAdminService}.
 *
 * Never trusts email claims, unverified signups, or hard-coded exceptions.
 */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
  constructor(private readonly platformAdmin: PlatformAdminService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    await this.platformAdmin.assertPlatformAdmin(request.user?.userId);
    return true;
  }
}
