import { Controller, Get, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { LocalSeoService } from './local-seo.service';
import { GbpAnalyzerService } from './gbp-analyzer.service';
import { GbpAutofixService } from './gbp-autofix.service';

@Controller('api/projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Local SEO auditing is part of the core crawl capability.
@RequiresFeature(Feature.CRAWL)
export class LocalSeoController {
  constructor(
    private readonly localSeoService: LocalSeoService,
    private readonly gbpAnalyzer: GbpAnalyzerService,
    private readonly gbpAutofix: GbpAutofixService,
  ) {}

  @Get()
  async getLocalSeo(@Param('projectId') projectId: string) {
    return this.localSeoService.getLocalSeo(projectId);
  }

  @Post('search')
  async searchBusiness(@Body() body: { query: string }) {
    return this.localSeoService.searchBusiness(body.query);
  }

  @Post('connect')
  async connectBusiness(
    @Param('projectId') projectId: string,
    @Body() body: { businessName: string; address: string; rating: number; reviewCount: number }
  ) {
    return this.localSeoService.connectBusiness(projectId, body);
  }

  @Post('gbp/analyze')
  async analyzeGbp(@Param('projectId') projectId: string, @Req() req: any) {
    return this.gbpAnalyzer.analyzeProfile(projectId, req.user.organizationId);
  }

  @Post('gbp/fix/:proposalId/approve')
  async approveFix(@Param('projectId') projectId: string, @Param('proposalId') proposalId: string) {
    return this.gbpAutofix.approveAndPushFix(proposalId, projectId);
  }

  @Post('gbp/fix/:proposalId/reject')
  async rejectFix(@Param('projectId') projectId: string, @Param('proposalId') proposalId: string) {
    return this.gbpAutofix.rejectFix(proposalId, projectId);
  }

  @Get('gbp/proposals')
  async getProposals(@Param('projectId') projectId: string) {
    return this.localSeoService.getProposals(projectId);
  }
}
