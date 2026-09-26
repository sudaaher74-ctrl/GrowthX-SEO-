import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BusinessCatalogService } from './business-catalog.service';
import { BusinessGapsService } from './business-gaps.service';
import { BusinessMarketingService } from './business-marketing.service';

export class GenerateMarketingSignalsDto {
  /** Regenerates one competitor's signals instead of the project's own. */
  @IsOptional()
  @IsString()
  competitorId?: string;
}

/**
 * Business (Products Intelligence) — sequenced after Website Audit and
 * Competitor Intelligence. Analyzes products the same way Competitor
 * Intelligence analyzes SEO/content: your own crawled catalog, the same
 * competitors' catalogs, and the gaps between them.
 *
 * `JwtAuthGuard` alone is every other `/api/projects/:projectId/...`
 * controller's project-scoping: it loads the project, checks the caller's
 * membership, and 404s rather than 403s a project the caller cannot see.
 */
@ApiTags('Business')
@ApiBearerAuth()
@Controller('api/projects/:projectId/business')
@UseGuards(JwtAuthGuard)
export class BusinessController {
  constructor(
    private readonly catalog: BusinessCatalogService,
    private readonly gaps: BusinessGapsService,
    private readonly marketing: BusinessMarketingService,
  ) {}

  @Get('catalog/mine')
  @ApiOperation({ summary: 'Catalog (You): products auto-extracted from the project\'s own crawl' })
  @ApiParam({ name: 'projectId' })
  getMyCatalog(@Param('projectId') projectId: string) {
    return this.catalog.getMyCatalog(projectId);
  }

  @Get('catalog/competitors')
  @ApiOperation({ summary: 'Catalog (Them): the same extraction against every competitor already tracked for this project' })
  @ApiParam({ name: 'projectId' })
  getCompetitorCatalogs(@Param('projectId') projectId: string) {
    return this.catalog.getCompetitorCatalogs(projectId);
  }

  @Post('catalog/competitors/:competitorId/crawl')
  @ApiOperation({ summary: 'Queue a crawl for one already-tracked competitor, to (re)build its product catalog' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'competitorId' })
  crawlCompetitor(@Req() req: any, @Param('projectId') projectId: string, @Param('competitorId') competitorId: string) {
    return this.catalog.crawlCompetitor(req.user?.organizationId || req.organizationId, projectId, competitorId);
  }

  @Get('gaps')
  @ApiOperation({ summary: 'Gaps: category coverage, price delta and stock-transparency gaps between your catalog and each competitor\'s' })
  @ApiParam({ name: 'projectId' })
  getGaps(@Param('projectId') projectId: string) {
    return this.gaps.getGaps(projectId);
  }

  @Get('marketing-signals')
  @ApiOperation({ summary: 'Marketing Signals: positioning/messaging claims already read off crawled page copy' })
  @ApiParam({ name: 'projectId' })
  getMarketingSignals(@Param('projectId') projectId: string) {
    return this.marketing.getSignals(projectId);
  }

  @Post('marketing-signals/generate')
  @ApiOperation({ summary: 'Read the site\'s (or one competitor\'s) already-crawled homepage copy and extract marketing signals' })
  @ApiParam({ name: 'projectId' })
  @ApiBody({ type: GenerateMarketingSignalsDto, required: false })
  generateMarketingSignals(@Req() req: any, @Param('projectId') projectId: string, @Body() body: GenerateMarketingSignalsDto) {
    const organizationId = req.user?.organizationId || req.organizationId;
    return body?.competitorId
      ? this.marketing.generateForCompetitor(organizationId, projectId, body.competitorId)
      : this.marketing.generateForOwnSite(organizationId, projectId);
  }
}
