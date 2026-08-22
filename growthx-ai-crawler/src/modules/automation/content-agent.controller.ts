import { Body, Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ContentPieceKind, UsageMetric } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EntitlementsGuard } from '../billing/entitlements.guard';
import { Metered, OrgFrom, RequiresFeature } from '../billing/entitlements.decorator';
import { EntitlementsService } from '../billing/entitlements.service';
import { Feature } from '../billing/plans.catalog';
import { ContentAgentService, ContentRequest } from './content-agent.service';

export class ContentRequestDto implements ContentRequest {
  kind: ContentPieceKind;
  topic?: string;
  targetQuery?: string;
  pageUrl?: string;
  reviewText?: string;
  reviewRating?: number;
  reviewAuthor?: string;
  location?: string;
}

import { IsEnum } from 'class-validator';

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
@UseGuards(JwtAuthGuard, EntitlementsGuard)
@OrgFrom('project', 'projectId')
export class ContentAgentController {
  constructor(
    private readonly contentAgent: ContentAgentService,
    private readonly entitlements: EntitlementsService,
  ) {}

  @Post('drafts')
  @Metered(Feature.AI_RECOMMENDATIONS, UsageMetric.AI_ANALYSES)
  @ApiOperation({ summary: 'Draft one piece of content, grounded in this project’s own data' })
  @ApiParam({ name: 'projectId' })
  async draft(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: ContentRequestDto,
  ) {
    const piece = await this.contentAgent.generate(projectId, req.organizationId, body);
    await this.entitlements.recordUsage(req.organizationId, UsageMetric.AI_ANALYSES);
    return piece;
  }

  @Get('pending-review')
  // No allowance is spent reading or deciding on a draft — the draft route
  // already charged for it — but both stay behind the same feature, since a
  // plan that cannot draft has nothing to review.
  @RequiresFeature(Feature.AI_RECOMMENDATIONS)
  @ApiOperation({ summary: 'Drafts waiting on a human decision' })
  @ApiParam({ name: 'projectId' })
  pendingReview(@Param('projectId') projectId: string) {
    return this.contentAgent.pendingReview(projectId);
  }

  @Post('drafts/:pieceId/review')
  @RequiresFeature(Feature.AI_RECOMMENDATIONS)
  @ApiOperation({ summary: 'Approve or reject a draft. Nothing publishes without this.' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  review(@Param('pieceId') pieceId: string, @Body() body: ReviewDecisionDto) {
    return this.contentAgent.review(pieceId, body.decision);
  }
}
