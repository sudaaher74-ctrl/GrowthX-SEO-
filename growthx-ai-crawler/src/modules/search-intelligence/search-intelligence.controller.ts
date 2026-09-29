import { Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../../database/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ChangeImpactService } from './change-impact.service';
import { ChangeRiskService } from './change-risk.service';
import { DataForSeoService } from './dataforseo.service';
import { IndexStatusService } from './index-status.service';
import { KeywordDiagnosisService } from './keyword-diagnosis.service';
import { KeywordGapService } from './keyword-gap.service';
import { RankTrackingService } from './rank-tracking.service';
import { analyticsConnected, searchConsoleConnected } from './search-console-facts';
import {
  ChangeImpactQueryDto,
  ChangeRiskDto,
  DiagnoseKeywordDto,
  InspectUrlsDto,
  RefreshGapsDto,
  SearchMarketDto,
  SearchRankingsQueryDto,
  TrackKeywordsDto,
} from './search-intelligence.dto';
import { SearchRankingsService } from './search-rankings.service';
import { resolveMarket } from './search-market';

/**
 * What Google itself shows and records about a site: index status, live
 * results and rankings, competitor keywords, and search results around a
 * change. `JwtAuthGuard` scopes every route to a project the caller belongs to.
 */
@ApiTags('Search intelligence')
@ApiBearerAuth()
@Controller('api/projects/:projectId/search-intelligence')
@UseGuards(JwtAuthGuard)
export class SearchIntelligenceController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dataforseo: DataForSeoService,
    private readonly indexStatus: IndexStatusService,
    private readonly diagnosis: KeywordDiagnosisService,
    private readonly ranks: RankTrackingService,
    private readonly searchRankings: SearchRankingsService,
    private readonly gaps: KeywordGapService,
    private readonly impact: ChangeImpactService,
    private readonly risk: ChangeRiskService,
  ) {}

  @Get('status')
  @ApiOperation({ summary: 'Which Google data sources are connected, and the market results are checked in' })
  @ApiParam({ name: 'projectId' })
  async status(@Param('projectId') projectId: string) {
    return {
      // The customer's own connections: what this page runs on.
      searchConsoleConnected: await searchConsoleConnected(this.prisma, projectId),
      analyticsConnected: await analyticsConnected(this.prisma, projectId),
      // A platform-wide source of live Google results and competitor keywords.
      // It is an addition, not a requirement: the customer cannot connect it.
      googleResultsConnected: this.dataforseo.isConfigured(),
      market: await resolveMarket(this.prisma, projectId),
    };
  }

  @Put('market')
  @ApiOperation({ summary: 'Set the country and language Google results are checked in' })
  @ApiParam({ name: 'projectId' })
  async setMarket(@Param('projectId') projectId: string, @Body() body: SearchMarketDto) {
    await this.prisma.project.update({
      where: { id: projectId },
      data: {
        ...(body.country !== undefined ? { searchCountry: body.country?.trim() || null } : {}),
        ...(body.language ? { searchLanguage: body.language.trim().toLowerCase() } : {}),
      },
    });
    return resolveMarket(this.prisma, projectId);
  }

  // ── Index status (Search Console URL Inspection) ───────────────────────

  @Get('index-status')
  @ApiOperation({ summary: "Google's index status for every page checked, set against the site crawl" })
  @ApiParam({ name: 'projectId' })
  indexReport(@Param('projectId') projectId: string) {
    return this.indexStatus.report(projectId);
  }

  @Post('index-status/inspect')
  @ApiOperation({ summary: 'Ask Google about the next batch of pages (or the ones given)' })
  @ApiParam({ name: 'projectId' })
  inspect(@Param('projectId') projectId: string, @Body() body: InspectUrlsDto) {
    return this.indexStatus.inspect(projectId, { urls: body.urls, limit: body.limit });
  }

  // ── Keyword diagnosis ──────────────────────────────────────────────────

  @Post('diagnose')
  @ApiOperation({ summary: 'Why a page does or does not rank for a keyword, from live Google results' })
  @ApiParam({ name: 'projectId' })
  diagnose(@Param('projectId') projectId: string, @Body() body: DiagnoseKeywordDto) {
    return this.diagnosis.run(projectId, body);
  }

  @Get('diagnoses')
  @ApiOperation({ summary: 'Past keyword diagnoses, newest first' })
  @ApiParam({ name: 'projectId' })
  diagnoses(@Param('projectId') projectId: string) {
    return this.diagnosis.list(projectId);
  }

  @Get('diagnoses/:id')
  @ApiOperation({ summary: 'One stored keyword diagnosis' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id' })
  diagnosisById(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.diagnosis.get(projectId, id);
  }

  // ── Rankings from Search Console ───────────────────────────────────────

  @Get('search-rankings')
  @ApiOperation({ summary: "Where Google shows the site for each search, from the customer's own Search Console" })
  @ApiParam({ name: 'projectId' })
  searchRankingsReport(@Param('projectId') projectId: string, @Query() query: SearchRankingsQueryDto) {
    return this.searchRankings.report(projectId, { days: query.days, limit: query.limit });
  }

  // ── Rank tracking (live Google results) ────────────────────────────────

  @Get('rankings')
  @ApiOperation({ summary: 'Tracked keywords with positions, and where competitors overtook you' })
  @ApiParam({ name: 'projectId' })
  rankings(@Param('projectId') projectId: string) {
    return this.ranks.list(projectId);
  }

  @Post('rankings/keywords')
  @ApiOperation({ summary: 'Track keywords' })
  @ApiParam({ name: 'projectId' })
  track(@Param('projectId') projectId: string, @Body() body: TrackKeywordsDto) {
    return this.ranks.add(projectId, body.keywords, body.source ?? 'USER');
  }

  @Delete('rankings/keywords/:id')
  @ApiOperation({ summary: 'Stop tracking a keyword' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'id' })
  untrack(@Param('projectId') projectId: string, @Param('id') id: string) {
    return this.ranks.remove(projectId, id);
  }

  @Post('rankings/check')
  @ApiOperation({ summary: 'Check every tracked keyword in Google now' })
  @ApiParam({ name: 'projectId' })
  checkRankings(@Param('projectId') projectId: string) {
    return this.ranks.checkAll(projectId);
  }

  // ── Competitor keyword gaps ────────────────────────────────────────────

  @Get('keyword-gaps')
  @ApiOperation({ summary: 'Keywords competitors rank for that you do not (as last fetched)' })
  @ApiParam({ name: 'projectId' })
  keywordGaps(@Param('projectId') projectId: string) {
    return this.gaps.latest(projectId);
  }

  @Post('keyword-gaps/refresh')
  @ApiOperation({ summary: 'Fetch competitor keyword gaps from Google rankings' })
  @ApiParam({ name: 'projectId' })
  async refreshGaps(@Param('projectId') projectId: string, @Body() body: RefreshGapsDto) {
    const outcome = await this.gaps.refresh(projectId, { competitorDomain: body.competitorDomain, force: body.force });
    return { ...outcome, ...(await this.gaps.latest(projectId)) };
  }

  // ── Changes: impact after, risk before ─────────────────────────────────

  @Get('changes')
  @ApiOperation({ summary: 'Every recorded change with its search results before and after' })
  @ApiParam({ name: 'projectId' })
  changes(@Param('projectId') projectId: string) {
    return this.impact.changes(projectId);
  }

  @Get('change-impact')
  @ApiOperation({ summary: 'Search results for a page before and after a given date' })
  @ApiParam({ name: 'projectId' })
  async changeImpact(@Param('projectId') projectId: string, @Query() query: ChangeImpactQueryDto) {
    await this.impact.assertOwnUrl(projectId, query.url);
    return this.impact.forUrl(projectId, query.url, new Date(query.changedAt), query.days);
  }

  @Post('change-risk')
  @ApiOperation({ summary: 'What a delete, redirect, canonical, move or noindex would put at risk' })
  @ApiParam({ name: 'projectId' })
  changeRisk(@Param('projectId') projectId: string, @Body() body: ChangeRiskDto) {
    return this.risk.assess(projectId, body);
  }
}
