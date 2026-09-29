import { BadRequestException, Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GrowthIntelligenceService } from './growth-intelligence.service';

function windowDays(value?: string): number {
  const n = parseInt(value ?? '28', 10);
  return [7, 28, 90].includes(n) ? n : 28;
}

/**
 * GrowthX Intelligence: the one place the crawl, Search Console, Analytics,
 * Business Profile, competitor and AI-visibility evidence is combined.
 * Read-only, so a viewer may use it; the project guard scopes it to the
 * caller's organization.
 */
@ApiTags('Intelligence')
@ApiBearerAuth()
@Controller('api/projects/:projectId/intelligence')
@UseGuards(JwtAuthGuard)
export class GrowthIntelligenceController {
  constructor(private readonly intelligence: GrowthIntelligenceService) {}

  @Get()
  @ApiOperation({ summary: 'Why is my website not growing? Problems, opportunities and risks with their evidence' })
  @ApiQuery({ name: 'days', required: false, example: 28 })
  report(@Req() req: any, @Param('projectId') projectId: string, @Query('days') days?: string, @Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.intelligence.report(req.organizationId, projectId, windowDays(days), Number.isFinite(parsed) ? Math.min(Math.max(parsed, 1), 50) : 15);
  }

  @Get('page')
  @ApiOperation({ summary: 'Why one page is (under)performing, from every connected source' })
  page(@Req() req: any, @Param('projectId') projectId: string, @Query('url') url?: string, @Query('days') days?: string) {
    if (!url) throw new BadRequestException('url is required');
    return this.intelligence.page(req.organizationId, projectId, url, windowDays(days));
  }
}
