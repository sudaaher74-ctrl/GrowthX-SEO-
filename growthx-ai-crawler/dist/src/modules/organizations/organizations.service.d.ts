import { PrismaService } from '../../database/prisma.service';
import { Prisma, Organization, Role } from '@prisma/client';
export declare class OrganizationsService {
    private prisma;
    constructor(prisma: PrismaService);
    createOrganization(userId: string, data: Prisma.OrganizationCreateInput): Promise<Organization>;
    getOrganizationsForUser(userId: string): Promise<Organization[]>;
    listMembers(organizationId: string): Promise<{
        id: string;
        role: import(".prisma/client").$Enums.Role;
        joinedAt: Date;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    }[]>;
    /**
     * Attaches an already-registered user to the org by email.
     *
     * There is no outbound email in this system yet, so this cannot invite
     * someone who hasn't signed up — it can only be honest about that rather
     * than pretending to send an invite that never arrives.
     */
    addMember(organizationId: string, requesterId: string, email: string, role: Role): Promise<{
        id: string;
        role: import(".prisma/client").$Enums.Role;
        joinedAt: Date;
        userId: string;
        email: string;
        firstName: string | null;
        lastName: string | null;
    }>;
    updateMemberRole(organizationId: string, requesterId: string, memberId: string, role: Role): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        role: import(".prisma/client").$Enums.Role;
        userId: string;
    }>;
    removeMember(organizationId: string, requesterId: string, memberId: string): Promise<void>;
    private requireMember;
    private assertManager;
    private assertNotLastOwner;
}
