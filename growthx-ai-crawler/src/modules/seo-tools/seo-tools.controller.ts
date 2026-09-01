import { Controller, Post, Get, Body, Param, UseGuards, Req, Request } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SchemaGeneratorService } from './schema-generator.service';
import { MetaOptimizerService } from './meta-optimizer.service';
import { ImageOptimizerService } from './image-optimizer.service';
import { InternalLinkingService } from './internal-linking.service';
import { SeoCompetitorsService } from './seo-competitors.service';

@Controller('api/projects/:projectId/seo-tools')
@UseGuards(JwtAuthGuard)
export class SeoToolsController {
  constructor(
    private readonly schemaGenerator: SchemaGeneratorService,
    private readonly metaOptimizer: MetaOptimizerService,
    private readonly imageOptimizer: ImageOptimizerService,
    private readonly internalLinking: InternalLinkingService,
    private readonly seoCompetitors: SeoCompetitorsService,
  ) {}

  @Post('schema/generate')
  async generateSchema(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string; type: string },
  ) {
    return this.schemaGenerator.generateSchema(body.url, body.type, req.organizationId);
  }

  @Post('meta/analyze')
  async analyzeMeta(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string },
  ) {
    return this.metaOptimizer.analyzeAndOptimize(body.url, req.organizationId);
  }

  @Post('images/analyze')
  async analyzeImages(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string },
  ) {
    return this.imageOptimizer.analyzeAndOptimizeImages(body.url, req.organizationId);
  }

  @Post('internal-links/suggest')
  async suggestInternalLinks(
    @Request() req: any,
    @Param('projectId') projectId: string,
    @Body() body: { url: string },
  ) {
    return this.internalLinking.suggestInternalLinks(body.url, projectId, req.organizationId);
  }

  @Get('competitor-matrix')
  async getCompetitorMatrix(@Param('projectId') projectId: string) {
    return this.seoCompetitors.getSeoGapMatrix(projectId);
  }

  @Post('seo-insights')
  async generateSeoInsights(@Param('projectId') projectId: string, @Request() req: any) {
    return this.seoCompetitors.generateSeoGapInsights(projectId, req.user.organizationId);
  }
}
