import { PrismaService } from '../../database/prisma.service';
import { OrgSource } from './entitlements.decorator';
/**
 * Works out which organization a request is acting on, and confirms the caller
 * is a member of it. Without this, plan gating would be trivially bypassed by
 * passing someone else's organization id.
 */
export declare class OrgContextService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    /**
     * Resolution order:
     *   1. the resource named by `@OrgFrom(...)`, traced back to its organization
     *   2. an explicit id in the route params, body, query, or `x-organization-id`
     *   3. the caller's organization, when they belong to exactly one
     */
    resolve(request: any, source?: OrgSource): Promise<string>;
    private explicitId;
    private soleOrganization;
    private fromResource;
    assertMembership(userId: string, organizationId: string): Promise<void>;
}
