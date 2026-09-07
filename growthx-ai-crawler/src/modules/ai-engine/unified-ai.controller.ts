import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UnifiedAiService } from './unified-ai.service';
import { GenerateIntelligenceDto } from './dto/generate-intelligence.dto';

@ApiTags('AI Intelligence Engine')
@ApiBearerAuth()
@Controller('api/ai')
@UseGuards(JwtAuthGuard)
export class UnifiedAiController {
  constructor(private readonly aiService: UnifiedAiService) {}

  @Post('market-research')
  @ApiOperation({ summary: '1. Generate in-depth Market Research & SWOT' })
  @ApiResponse({ status: 200, description: 'Market research successfully generated' })
  async generateMarketResearch(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateMarketResearch({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('competitor-analysis')
  @ApiOperation({ summary: '2. Generate Comprehensive Competitor Analysis' })
  @ApiResponse({ status: 200, description: 'Competitor analysis successfully generated' })
  async generateCompetitorAnalysis(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateCompetitorAnalysis({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('seo-analysis')
  @ApiOperation({ summary: '3. Generate Complete SEO Intelligence & Content Gap Analysis' })
  @ApiResponse({ status: 200, description: 'SEO analysis successfully generated' })
  async generateSEOAnalysis(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateSEOAnalysis({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('content-strategy')
  @ApiOperation({ summary: '4. Generate Omnichannel Content Strategy & Editorial Calendar' })
  @ApiResponse({ status: 200, description: 'Content strategy successfully generated' })
  async generateContentStrategy(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateContentStrategy({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('keyword-research')
  @ApiOperation({ summary: '5. Generate High-Intent Keyword Research & Clusters' })
  @ApiResponse({ status: 200, description: 'Keyword research successfully generated' })
  async generateKeywordResearch(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateKeywordResearch({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  @Post('business-insights')
  @ApiOperation({ summary: '6. Generate Strategic Business Intelligence & Positioning' })
  @ApiResponse({ status: 200, description: 'Business insights successfully generated' })
  async generateBusinessInsights(@Body() dto: GenerateIntelligenceDto, @Req() req: any) {
    return this.aiService.generateBusinessInsights({
      ...dto,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }


}
