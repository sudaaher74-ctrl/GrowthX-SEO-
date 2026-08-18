import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';
import { LocalSeoService } from './local-seo.service';

@Controller('api/projects/:projectId/local-seo')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
// Local SEO auditing is part of the core crawl capability.
@RequiresFeature(Feature.CRAWL)
export class LocalSeoController {
  constructor(private readonly localSeoService: LocalSeoService) {}

  @Get()
  async getLocalSeo(@Param('projectId') projectId: string) {
    return this.localSeoService.getLocalSeo(projectId);
  }
}
