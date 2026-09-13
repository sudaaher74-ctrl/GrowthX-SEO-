import { Body, Controller, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { DesignStudioPublishMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DesignStudioService } from './design-studio.service';

/**
 * Design Studio API.
 *
 * The POST routes are the pipeline the spec describes; the GET routes are what
 * the screen reads to render it. Everything is scoped by projectId in the path
 * so a suggestion can never be acted on from the wrong project.
 */
@Controller('api/projects/:projectId/design-studio')
@UseGuards(JwtAuthGuard)
export class DesignStudioController {
  constructor(private readonly designStudio: DesignStudioService) {}

  /** Summary cards, connection status and last snapshot date. */
  @Get('overview')
  async overview(@Param('projectId') projectId: string) {
    return this.designStudio.getOverview(projectId);
  }

  @Get('suggestions')
  async suggestions(
    @Param('projectId') projectId: string,
    @Query('status') status?: string,
    @Query('contentType') contentType?: string,
  ) {
    return this.designStudio.listSuggestions(projectId, { status, contentType });
  }

  @Get('published')
  async published(@Param('projectId') projectId: string) {
    return this.designStudio.listPublished(projectId);
  }

  @Get('history')
  async history(@Param('projectId') projectId: string) {
    return this.designStudio.history(projectId);
  }

  /** The stored HTML the preview renders. */
  @Get('snapshots/:snapshotId/html')
  async snapshotHtml(
    @Param('projectId') projectId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    return this.designStudio.getSnapshotHtml(projectId, snapshotId);
  }

  /** Capture a page snapshot and extract its editable slots. */
  @Post('analyze')
  async analyze(@Param('projectId') projectId: string, @Body() body: { pageUrl?: string }) {
    return this.designStudio.analyze(projectId, body?.pageUrl);
  }

  @Post('slots')
  async slots(@Param('projectId') projectId: string, @Body() body: { snapshotId: string }) {
    return this.designStudio.listSlots(projectId, body.snapshotId);
  }

  @Post('generate')
  async generate(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body()
    body: {
      snapshotId: string;
      slotId?: string;
      contentType?: string;
      variant?: string;
      targetKeyword?: string;
      lockedPhrases?: string[];
      seoIssue?: string;
      recommendedLocation?: string;
    },
  ) {
    return this.designStudio.generate(projectId, {
      ...body,
      organizationId: req.user?.organizationId ?? req.organizationId,
    });
  }

  /** Score a suggestion, optionally against edits made in the inspector. */
  @Post('preview')
  async preview(
    @Param('projectId') projectId: string,
    @Body() body: { suggestionId: string; heading?: string; body?: string },
  ) {
    return this.designStudio.preview(projectId, body.suggestionId, {
      heading: body.heading,
      body: body.body,
    });
  }

  @Post('approve')
  async approve(
    @Param('projectId') projectId: string,
    @Req() req: any,
    @Body()
    body: { suggestionId: string; publishMethod: DesignStudioPublishMethod; notes?: string },
  ) {
    return this.designStudio.approve(projectId, body.suggestionId, {
      publishMethod: body.publishMethod,
      notes: body.notes,
      userId: req.user?.id ?? req.user?.userId,
    });
  }

  @Post('publish')
  async publish(@Param('projectId') projectId: string, @Body() body: { suggestionId: string }) {
    return this.designStudio.publish(projectId, body.suggestionId);
  }

  @Post('verify')
  async verify(
    @Param('projectId') projectId: string,
    @Body() body: { publishedChangeId: string },
  ) {
    return this.designStudio.verify(projectId, body.publishedChangeId);
  }

  @Post('rollback')
  async rollback(
    @Param('projectId') projectId: string,
    @Body() body: { publishedChangeId: string; reason?: string },
  ) {
    return this.designStudio.rollback(projectId, body.publishedChangeId, body.reason);
  }
}
