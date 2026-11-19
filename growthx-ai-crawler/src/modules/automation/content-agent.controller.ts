import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ContentPieceKind } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { IsEnum, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { ContentAgentService, ContentRequest } from './content-agent.service';

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

export class UpdateDraftDto {
  @IsOptional()
  @IsString()
  @MaxLength(300)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  metaDescription?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100000)
  body?: string;
}

export class PublishDraftToCmsDto {
  @IsEnum(['WORDPRESS', 'SHOPIFY', 'WEBFLOW'])
  platform: 'WORDPRESS' | 'SHOPIFY' | 'WEBFLOW';

  @IsOptional()
  @IsEnum(['draft', 'publish'])
  publishMode?: 'draft' | 'publish';
}

/**
 * The content agent & Content Studio: briefs, articles, Google Business Profile
 * posts, FAQs, review replies, local landing-page outlines, and schema markup.
 */
@ApiTags('Content agent')
@ApiBearerAuth()
@Controller('api/projects/:projectId/content-agent')
@UseGuards(JwtAuthGuard)
export class ContentAgentController {
  constructor(private readonly contentAgent: ContentAgentService) {}

  @Get('drafts')
  @ApiOperation({ summary: 'List all Content Studio drafts for this project' })
  @ApiParam({ name: 'projectId' })
  listDrafts(@Param('projectId') projectId: string) {
    return this.contentAgent.listDrafts(projectId);
  }

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

  @Patch('drafts/:pieceId')
  @ApiOperation({ summary: 'Edit a Content Studio draft title, meta description, or body' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  updateDraft(
    @Param('projectId') projectId: string,
    @Param('pieceId') pieceId: string,
    @Body() body: UpdateDraftDto,
  ) {
    return this.contentAgent.updateDraft(projectId, pieceId, body);
  }

  @Post('drafts/:pieceId/publish-cms')
  @ApiOperation({ summary: 'Publish a Content Studio draft directly to WordPress, Shopify, or Webflow' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  publishDraftToCms(
    @Param('projectId') projectId: string,
    @Param('pieceId') pieceId: string,
    @Body() body: PublishDraftToCmsDto,
  ) {
    return this.contentAgent.publishDraftToCms(projectId, pieceId, body);
  }

  @Get('pending-review')
  @ApiOperation({ summary: 'Drafts waiting on a human decision' })
  @ApiParam({ name: 'projectId' })
  pendingReview(@Param('projectId') projectId: string) {
    return this.contentAgent.pendingReview(projectId);
  }

  @Post('drafts/:pieceId/review')
  @ApiOperation({ summary: 'Approve or reject a draft. Nothing publishes without this.' })
  @ApiParam({ name: 'projectId' })
  @ApiParam({ name: 'pieceId' })
  review(
    @Param('projectId') projectId: string,
    @Param('pieceId') pieceId: string,
    @Body() body: ReviewDecisionDto,
  ) {
    return this.contentAgent.review(projectId, pieceId, body.decision);
  }
}
