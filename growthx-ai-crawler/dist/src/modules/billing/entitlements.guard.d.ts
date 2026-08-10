import { CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { EntitlementsService } from './entitlements.service';
import { OrgContextService } from './org-context.service';
/**
 * Enforces plan features and usage allowances. Run it after `JwtAuthGuard` so
 * `request.user` is populated.
 *
 * The resolved organization id is attached to the request as
 * `request.organizationId` so handlers can record usage without resolving twice.
 */
export declare class EntitlementsGuard implements CanActivate {
    private readonly reflector;
    private readonly entitlements;
    private readonly orgContext;
    constructor(reflector: Reflector, entitlements: EntitlementsService, orgContext: OrgContextService);
    canActivate(context: ExecutionContext): Promise<boolean>;
}
