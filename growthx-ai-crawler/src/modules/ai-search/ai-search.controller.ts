import { Controller, Post, Body, Param, UseGuards } from '@nestjs/common';
import { AiSearchService, AiSearchResponse } from './ai-search/ai-search.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

export class AiSearchDto {
  question: string;
}

@Controller('api/projects/:projectId/chat')
@UseGuards(JwtAuthGuard)
export class AiSearchController {
  constructor(private readonly aiSearchService: AiSearchService) {}

  @Post()
  async askQuestion(
    @Param('projectId') projectId: string,
    @Body() body: AiSearchDto,
  ): Promise<AiSearchResponse> {
    return this.aiSearchService.askQuestion(projectId, body.question);
  }
}

