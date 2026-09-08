import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  MammouthSeoService,
  WebsiteAuditInput,
  CompetitorIntelligenceInput,
  KeywordStrategyInput,
  ContentOnPageInput,
  AevVisibilityInput,
} from './mammouth-seo.service';
import { MAMMOUTH_MODELS } from '../ai-search/multi-ai-router/mammouth-models.config';

export interface MammouthRuntimeConfig {
  defaultModel: string;
  features: {
    websiteAudit: boolean;
    competitorIntelligence: boolean;
    keywordStrategy: boolean;
    aevAnalysis: boolean;
    seoRecommendations: boolean;
  };
}

@ApiTags('Mammouth AI SEO Orchestration')
@ApiBearerAuth()
@Controller('api/ai/mammouth')
@UseGuards(JwtAuthGuard)
export class MammouthSeoController {
  private runtimeConfig: MammouthRuntimeConfig = {
    defaultModel: 'mammouth-recommended',
    features: {
      websiteAudit: true,
      competitorIntelligence: true,
      keywordStrategy: true,
      aevAnalysis: true,
      seoRecommendations: true,
    },
  };

  constructor(
    private readonly mammouthService: MammouthSeoService,
    private readonly config: ConfigService,
  ) {
    this.runtimeConfig.defaultModel =
      this.config.get<string>('MAMMOUTH_DEFAULT_MODEL') || 'mammouth-recommended';
  }

  @Get('config')
  @ApiOperation({ summary: 'Get Mammouth AI configuration and connection status' })
  @ApiResponse({ status: 200, description: 'Config returned without exposing secrets' })
  async getConfig() {
    const rawKey = this.config.get<string>('MAMMOUTH_API_KEY') || '';
    const isConfigured = Boolean(
      rawKey && !rawKey.startsWith('your_') && !rawKey.startsWith('add-') && !rawKey.includes('***')
    );
    const maskedKey = isConfigured ? '••••••••••••' : '';

    const availableModels = Object.values(MAMMOUTH_MODELS).map((m) => ({
      id: m.id,
      displayName: m.displayName,
      description: m.description,
      capabilities: m.capabilities,
      maxOutputTokens: m.maxOutputTokens,
    }));

    return {
      provider: 'Mammouth AI',
      isConfigured,
      connected: isConfigured,
      maskedKey,
      defaultModel: this.runtimeConfig.defaultModel,
      availableModels,
      features: this.runtimeConfig.features,
    };
  }

  @Post('config')
  @ApiOperation({ summary: 'Update default model or active SEO feature toggles' })
  async updateConfig(@Body() body: Partial<MammouthRuntimeConfig>) {
    if (body.defaultModel && MAMMOUTH_MODELS[body.defaultModel]) {
      this.runtimeConfig.defaultModel = body.defaultModel;
    }
    if (body.features) {
      this.runtimeConfig.features = {
        ...this.runtimeConfig.features,
        ...body.features,
      };
    }
    return {
      success: true,
      config: {
        provider: 'Mammouth AI',
        defaultModel: this.runtimeConfig.defaultModel,
        features: this.runtimeConfig.features,
      },
    };
  }

  @Post('test-connection')
  @ApiOperation({ summary: 'Test connectivity to Mammouth AI API' })
  async testConnection() {
    return this.mammouthService.testConnection();
  }

  @Post('website-audit')
  @ApiOperation({ summary: 'Analyze crawl telemetry & identify technical SEO problems' })
  async websiteAudit(@Body() dto: WebsiteAuditInput, @Req() req: any) {
    return this.mammouthService.analyzeWebsiteAudit({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('competitor-intelligence')
  @ApiOperation({ summary: 'Analyze competitor intelligence & identify ranking opportunities' })
  async competitorIntelligence(@Body() dto: CompetitorIntelligenceInput, @Req() req: any) {
    return this.mammouthService.analyzeCompetitorIntelligence({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('keyword-strategy')
  @ApiOperation({ summary: 'Cluster keywords, search intent, & detect cannibalization' })
  async keywordStrategy(@Body() dto: KeywordStrategyInput, @Req() req: any) {
    return this.mammouthService.generateKeywordStrategy({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('content-analysis')
  @ApiOperation({ summary: 'On-page title/meta optimization & semantic internal linking' })
  async contentAnalysis(@Body() dto: ContentOnPageInput, @Req() req: any) {
    return this.mammouthService.analyzeContentOnPage({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('aev-analysis')
  @ApiOperation({ summary: 'AEV / AI search visibility analysis & citation action plan' })
  async aevAnalysis(@Body() dto: AevVisibilityInput, @Req() req: any) {
    return this.mammouthService.analyzeAevVisibility({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }
}
