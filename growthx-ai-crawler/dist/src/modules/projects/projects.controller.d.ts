import { ProjectsService } from './projects.service';
import { Prisma } from '@prisma/client';
export declare class ProjectsController {
    private projectsService;
    constructor(projectsService: ProjectsService);
    createProject(body: Prisma.ProjectCreateInput): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }>;
    getProjectsByOrganization(orgId: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    }[]>;
    getProjectById(id: string): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        name: string;
        organizationId: string;
        tier: string | null;
        retainerMonthlyMinor: number | null;
        retainerCurrency: string;
    } | null>;
}
