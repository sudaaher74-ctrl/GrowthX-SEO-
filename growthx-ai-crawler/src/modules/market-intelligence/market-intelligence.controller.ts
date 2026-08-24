import { Controller, Get, Post, Param, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketIntelligenceService } from './market-intelligence.service';

@ApiTags('Market Intelligence')
@ApiBearerAuth()
@Controller('api/projects/:projectId/market')
@UseGuards(JwtAuthGuard)
// Generating a market report spends model tokens; gate it like strategy.
export class MarketIntelligenceController {
  constructor(private readonly marketService: MarketIntelligenceService) {}

  @Get()
  @ApiOperation({ summary: 'Get Market Intelligence data (sentiment & topics) for project' })
  @ApiParam({ name: 'projectId' })
  getMarketIntelligence(@Param('projectId') projectId: string) {
    return this.marketService.getMarketIntelligence(projectId);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate or refresh Market Intelligence data for project' })
  @ApiParam({ name: 'projectId' })
  generateMarketIntelligence(@Param('projectId') projectId: string) {
    return this.marketService.generateMarketIntelligence(projectId);
  }
}
