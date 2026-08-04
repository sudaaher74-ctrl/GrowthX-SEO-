import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from './entitlements.service';
import {
  ORG_SOURCE_KEY,
  OrgSource,
  REQUIRED_FEATURES_KEY,
  REQUIRED_QUOTA_KEY,
  RequiredQuota,
} from './entitlements.decorator';
import { Feature } from './plans.catalog';
import { OrgContextService } from './org-context.service';

/**
 * Enforces plan features and usage allowances. Run it after `JwtAuthGuard` so
 * `request.user` is populated.
 *
 * The resolved organization id is attached to the request as
 * `request.organizationId` so handlers can record usage without resolving twice.
 */
@Injectable()
export class EntitlementsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly entitlements: EntitlementsService,
    private readonly orgContext: OrgContextService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const targets = [context.getHandler(), context.getClass()];

    const features = this.reflector.getAllAndOverride<Feature[]>(REQUIRED_FEATURES_KEY, targets);
    const quota = this.reflector.getAllAndOverride<RequiredQuota>(REQUIRED_QUOTA_KEY, targets);

    // Nothing to enforce on this route.
    if (!features?.length && !quota) return true;

    const source = this.reflector.getAllAndOverride<OrgSource>(ORG_SOURCE_KEY, targets);
    const request = context.switchToHttp().getRequest();

    const organizationId = await this.orgContext.resolve(request, source);
    request.organizationId = organizationId;

    for (const feature of features ?? []) {
      await this.entitlements.assertFeature(organizationId, feature);
    }

    if (quota) {
      await this.entitlements.assertQuota(organizationId, quota.metric, quota.amount);
    }

    return true;
  }
}
