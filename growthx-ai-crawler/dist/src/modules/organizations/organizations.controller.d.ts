import { OrganizationsService } from './organizations.service';
import { Prisma, Role } from '@prisma/client';
export declare class OrganizationsController {
    private organizationsService;
    constructor(organizationsService: OrganizationsService);
    createOrganization(req: any, body: Prisma.OrganizationCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        slug: string;
    }>;
    getOrganizations(req: any): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        slug: string;
    }[]>;
    listMembers(id: string): Promise<{
        id: string;
        role: import(".prisma/client").$Enums.Role;
        joinedAt: Date;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    }[]>;
    addMember(req: any, id: string, body: {
        email: string;
        role?: Role;
    }): Promise<{
        id: string;
        role: import(".prisma/client").$Enums.Role;
        joinedAt: Date;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    }>;
    updateMemberRole(req: any, id: string, memberId: string, body: {
        role: Role;
    }): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        role: import(".prisma/client").$Enums.Role;
        userId: string;
    }>;
    removeMember(req: any, id: string, memberId: string): Promise<{
        success: boolean;
    }>;
}
