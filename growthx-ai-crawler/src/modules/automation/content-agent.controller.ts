import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ContentPieceKind, } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { ContentAgentService, ContentRequest } from './content-agent.service';

// Every field needs a decorator: the global ValidationPipe runs with
// `whitelist: true`, which strips any property of a DTO that has none. An
// undecorated DTO therefore arrives as `{}` and the handler crashes on a field
// the caller did send.
export class ContentRequestDto implements ContentRequest {
  @IsEnum(ContentPieceKind)
  kind: ContentPieceKind;

  @IsString()
  @IsOptional()
  topic?: string;

  @IsString()
  @IsOptional()
  targetQuery?: string;

  @IsString()
  @IsOptional()
  pageUrl?: string;

  @IsString()
  @IsOptional()
  reviewText?: string;

  @IsNumber()
  @IsOptional()
  reviewRating?: number;

  @IsString()
  @IsOptional()
  reviewAuthor?: string;

  @IsString()
  @IsOptional()
  location?: string;
}

export class ReviewDecisionDto {
  @IsEnum(['APPROVE', 'REJECT'])
  decision: 'APPROVE' | 'REJECT';
}

/**
 * The content agent: briefs, Google Business Profile posts, FAQs, review
 * replies, local landing-page outlines and schema markup.
 *
 * Separate from the automation controller on purpose — that one is gated on
 * AUTO_FIX_DEPLOY because it opens pull requests against the customer's repo.
 * Drafting copy for a human to review is a much lower-privilege action and
 * should not require the deploy entitlement.
 */
@ApiTags('Content agent')
@ApiBearerAuth()
@Controller('api/projects/:projectId/content-agent')
@UseGuards(JwtAuthGuard)
export class ContentAgentController {
  constructor(
    private readonly contentAgent: ContentAgentService,) {}

  @Post('drafts')
  @ApiOperation({ summary: 'Draft one piece of content, grounded in this project’s own data' })
  @ApiParam({ name: 'projectId' })
  async draft(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: ContentRequestDto,
  ) {
    const piece = await this.contentAgent.generate(projectId, req.organizationId, body);
    return piece;
  }

  @Get('pending-review')
  // No allowance is spent reading or deciding on a draft — the draft route
  // already charged for it — but both stay behind the same feature, since a
  // plan that cannot draft has nothing to review.
  @ApiOperation({ summary: 'Drafts waiting on a human decision' })
  @ApiParam({ name: 'projectId' })
  pendingReview(@Param('projectId') projectId: string) {
    return this.contentAgent.pendingReview(projectId);
  }

  @Post('drafts/:pieceId/review')
  @ApiOperation({ summary: 'Approve or reject a draft. Nothing publishes without this.' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  review(@Param('pieceId') pieceId: string, @Body() body: ReviewDecisionDto) {
    return this.contentAgent.review(pieceId, body.decision);
  }
}
