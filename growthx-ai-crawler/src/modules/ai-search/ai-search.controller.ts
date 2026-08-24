import { Controller, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { AiSearchService, AiSearchResponse } from './ai-search/ai-search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { IsString } from 'class-validator';

export class AiSearchDto {
  @IsString()
  question: string;
}

@Controller('api/projects/:projectId/chat')
@UseGuards(JwtAuthGuard)
export class AiSearchController {
  constructor(
    private readonly aiSearchService: AiSearchService,) {}

  @Post()
  async askQuestion(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: AiSearchDto,
  ): Promise<AiSearchResponse> {
    // req.organizationId is set by ; it decides which models are reachable.
    const answer = await this.aiSearchService.askQuestion(projectId, body.question, req.organizationId);
    return answer;
  }
}
