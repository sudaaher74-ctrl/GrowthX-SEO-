import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { Prisma, Project } from '@prisma/client';

@Injectable()
export class ProjectsService {
  constructor(private prisma: PrismaService) {}

  async createProject(data: Prisma.ProjectCreateInput): Promise<Project> {
    return this.prisma.project.create({ data });
  }

  async getProjectsByOrganization(organizationId: string): Promise<Project[]> {
    return this.prisma.project.findMany({
      where: { organizationId },
    });
  }

  async getProjectById(id: string): Promise<Project | null> {
    return this.prisma.project.findUnique({
      where: { id },
    });
  }

  /**
   * Deletes a project and everything hung off it. Every project-owned table
   * cascades from the project row; the exception is a tracked competitor's
   * website, which is stored with a null projectId and a `competitor:<id>`
   * scope so it stays out of the customer's own analysis, and so would be
   * left behind as orphaned crawl data.
   */
  async deleteProject(id: string): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.website.deleteMany({ where: { scope: `competitor:${id}` } }),
      this.prisma.project.delete({ where: { id } }),
    ]);
  }
}
