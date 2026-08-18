import { Body, Controller, Get, NotFoundException, Param, Post, Req, UseGuards } from '@nestjs/common';
import { IsNotEmpty, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';
import { ProjectsService } from './projects.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OrgContextService } from '../billing/org-context.service';

/**
 * The body used to accept `Prisma.ProjectCreateInput` directly, which meant the
 * request chose both the owning organization and the shape of the write. The
 * global ValidationPipe runs with `whitelist: true`, but a Prisma type carries
 * no class-validator metadata, so nothing was stripped and nothing was checked.
 */
export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  name: string;

  @IsUUID()
  organizationId: string;

  /** Agency-facing retainer label. Free text, matching the Project model. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  tier?: string;
}

@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(
    private projectsService: ProjectsService,
    private readonly orgContext: OrgContextService,
  ) {}

  @Post()
  async createProject(@Req() req: any, @Body() body: CreateProjectDto) {
    // Without this the caller could create a project inside any organization
    // id they cared to type, including one they have never been a member of.
    await this.orgContext.assertMembership(req.user.userId, body.organizationId);

    return this.projectsService.createProject({
      name: body.name,
      tier: body.tier,
      organization: { connect: { id: body.organizationId } },
    });
  }

  @Get('org/:orgId')
  async getProjectsByOrganization(@Req() req: any, @Param('orgId') orgId: string) {
    await this.orgContext.assertMembership(req.user.userId, orgId);
    return this.projectsService.getProjectsByOrganization(orgId);
  }

  @Get(':id')
  async getProjectById(@Req() req: any, @Param('id') id: string) {
    const project = await this.projectsService.getProjectById(id);
    if (!project) throw new NotFoundException('Project not found');

    await this.orgContext.assertMembership(req.user.userId, project.organizationId);
    return project;
  }
}
