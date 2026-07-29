import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Prisma } from '@prisma/client';

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private projectsService: ProjectsService) {}

  @Post()
  async createProject(@Body() body: Prisma.ProjectCreateInput) {
    return this.projectsService.createProject(body);
  }

  @Get('org/:orgId')
  async getProjectsByOrganization(@Param('orgId') orgId: string) {
    return this.projectsService.getProjectsByOrganization(orgId);
  }

  @Get(':id')
  async getProjectById(@Param('id') id: string) {
    return this.projectsService.getProjectById(id);
  }
}

