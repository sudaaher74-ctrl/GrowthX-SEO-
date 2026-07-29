import { OrganizationsService } from './organizations.service';
import { Prisma } from '@prisma/client';
export declare class OrganizationsController {
    private organizationsService;
    constructor(organizationsService: OrganizationsService);
    createOrganization(req: any, body: Prisma.OrganizationCreateInput): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
    }>;
    getOrganizations(req: any): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        slug: string;
    }[]>;
}
