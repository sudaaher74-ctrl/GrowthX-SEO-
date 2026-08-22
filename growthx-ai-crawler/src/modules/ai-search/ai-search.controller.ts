import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { UsageMetric } from '@prisma/client';
import { AiSearchService, AiSearchResponse } from './ai-search/ai-search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { EntitlementsService } from '../billing/entitlements.service';
import { Metered, OrgFrom } from '../billing/entitlements.decorator';
import { Feature } from '../billing/plans.catalog';

import { IsString } from 'class-validator';

export class AiSearchDto {
  @IsString()
  question: string;
}

@Controller('api/projects/:projectId/chat')
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
export class AiSearchController {
  constructor(
    private readonly aiSearchService: AiSearchService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post()
  @Metered(Feature.AI_RECOMMENDATIONS, UsageMetric.AI_ANALYSES)
  async askQuestion(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: AiSearchDto,
  ): Promise<AiSearchResponse> {
    // req.organizationId is set by EntitlementsGuard; it decides which models are reachable.
    const answer = await this.aiSearchService.askQuestion(projectId, body.question, req.organizationId);
    await this.entitlements.recordUsage(req.organizationId, UsageMetric.AI_ANALYSES);
    return answer;
  }
}
