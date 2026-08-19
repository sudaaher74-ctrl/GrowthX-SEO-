import { Controller, Post, Body, Param, UseGuards, Req } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { OrgFrom } from '../auth/org-from.decorator';
import { SchemaGeneratorService } from './schema-generator.service';
import { MetaOptimizerService } from './meta-optimizer.service';
import { Metered } from '../billing/metered.decorator';
import { Feature } from '../billing/plans.catalog';
import { UsageMetric } from '@prisma/client';

@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
@Controller('api/projects/:projectId/seo-tools')
export class SeoToolsController {
  constructor(
    private readonly schemaGenerator: SchemaGeneratorService,
    private readonly metaOptimizer: MetaOptimizerService,
  ) {}

  @Post('schema/generate')
  @Metered(Feature.SEO_TOOLS, UsageMetric.AI_ANALYSES)
  async generateSchema(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string; type: string },
  ) {
    return this.schemaGenerator.generateSchema(body.url, body.type, req.organizationId);
  }

  @Post('meta/analyze')
  @Metered(Feature.SEO_TOOLS, UsageMetric.AI_ANALYSES)
  async analyzeMeta(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string },
  ) {
    return this.metaOptimizer.analyzeAndOptimize(body.url, req.organizationId);
  }
}
