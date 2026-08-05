import { ProjectsService } from './projects.service';
import { Prisma } from '@prisma/client';
export declare class ProjectsController {
    private projectsService;
    constructor(projectsService: ProjectsService);
    createProject(body: Prisma.ProjectCreateInput): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }>;
    getProjectsByOrganization(orgId: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }[]>;
    getProjectById(id: string): Promise<{
        name: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    } | null>;
}
