import { PrismaService } from '../../database/prisma.service';
import { Prisma, Project } from '@prisma/client';
export declare class ProjectsService {
    private prisma;
    constructor(prisma: PrismaService);
    createProject(data: Prisma.ProjectCreateInput): Promise<Project>;
    getProjectsByOrganization(organizationId: string): Promise<Project[]>;
    getProjectById(id: string): Promise<Project | null>;
}
