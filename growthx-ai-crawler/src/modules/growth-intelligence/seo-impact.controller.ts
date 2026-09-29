import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { IsIn, IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SeoImpactService } from './seo-impact.service';

export class PlanChangeDto {
  /** The page the change is on; omit for a site-wide change. */
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  url?: string;

  @IsString()
  @MaxLength(100)
  findingType!: string;

  @IsString()
  @MaxLength(500)
  action!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @IsOptional()
  @IsInt()
  @IsIn([7, 28, 90])
  windowDays?: number;
}

export class MarkImplementedDto {
  @IsOptional()
  @IsString()
  implementedAt?: string;
}

/**
 * SEO Impact: what changed after each action. Writes (plan, mark implemented)
 * are refused for viewers by the project guard; reads are open to them.
 */
@ApiTags('SEO Impact')
@ApiBearerAuth()
@Controller('api/projects/:projectId/seo-impact')
@UseGuards(JwtAuthGuard)
export class SeoImpactController {
  constructor(private readonly impact: SeoImpactService) {}

  @Get()
  @ApiOperation({ summary: 'Planned and implemented changes, and whether each can be compared yet' })
  list(@Req() req: any, @Param('projectId') projectId: string) {
    return this.impact.list(req.organizationId, projectId);
  }

  @Post()
  @ApiOperation({ summary: 'Plan a change: record the figures as they stand now' })
  plan(@Req() req: any, @Param('projectId') projectId: string, @Body() body: PlanChangeDto) {
    return this.impact.plan(req.organizationId, projectId, req.user?.userId, body);
  }

  @Post(':id/implemented')
  @ApiOperation({ summary: 'Mark a planned change as live' })
  implemented(@Req() req: any, @Param('projectId') projectId: string, @Param('id') id: string, @Body() body: MarkImplementedDto) {
    return this.impact.markImplemented(req.organizationId, projectId, id, body?.implementedAt);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Before vs after for one change, with what improved, what did not, and what else changed' })
  measure(@Req() req: any, @Param('projectId') projectId: string, @Param('id') id: string) {
    return this.impact.measure(req.organizationId, projectId, id);
  }
}
