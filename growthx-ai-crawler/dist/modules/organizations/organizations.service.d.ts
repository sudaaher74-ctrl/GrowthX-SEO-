import { PrismaService } from '../../database/prisma.service';
import { Prisma, Organization } from '@prisma/client';
export declare class OrganizationsService {
    private prisma;
    constructor(prisma: PrismaService);
    createOrganization(userId: string, data: Prisma.OrganizationCreateInput): Promise<Organization>;
    getOrganizationsForUser(userId: string): Promise<Organization[]>;
}
