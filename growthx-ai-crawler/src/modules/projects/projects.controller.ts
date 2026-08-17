import { Controller, Post, Get, Body, Param, Request, UseGuards, BadRequestException, NotFoundException } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgContextService } from '../billing/org-context.service';
import { Prisma } from '@prisma/client';

/**
 * Every route here is scoped to an organization the caller belongs to.
 *
 * `JwtAuthGuard` alone only established that the caller was signed in, so these
 * routes served any organization's projects — and let a project be created
 * inside someone else's organization — to anyone who knew an id.
 */
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private orgContext: OrgContextService,
  ) {}

  @Post()
  async createProject(@Request() req: any, @Body() body: Prisma.ProjectCreateInput & { organizationId?: string }) {
    const organizationId = body?.organizationId;
    if (!organizationId) {
      throw new BadRequestException('organizationId is required.');
    }
    await this.orgContext.assertMembership(req.user.userId, organizationId);
    return this.projectsService.createProject(body);
  }

  @Get('org/:orgId')
  async getProjectsByOrganization(@Request() req: any, @Param('orgId') orgId: string) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    return this.projectsService.getProjectsByOrganization(orgId);
  }

  @Get(':id')
  async getProjectById(@Request() req: any, @Param('id') id: string) {
    const project = await this.projectsService.getProjectById(id);
    if (!project) throw new NotFoundException('Project not found');
    await this.orgContext.assertMembership(req.user.userId, project.organizationId);
    return project;
  }
}
