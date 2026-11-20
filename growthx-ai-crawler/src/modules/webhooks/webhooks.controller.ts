import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import {
  WebhookChannel,
  WebhookDispatcherService,
  WebhookEventsMatrix,
} from './webhook-dispatcher.service';

export class UpdateWebhookConfigDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  slackUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  discordUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1024)
  restUrl?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(512)
  secretToken?: string | null;

  @IsOptional()
  @IsObject()
  events?: Partial<WebhookEventsMatrix>;
}

export class TestWebhookDto {
  @IsIn(['SLACK', 'DISCORD', 'REST'])
  channel: WebhookChannel;
}

@ApiTags('Project Webhooks & Alert Dispatcher')
@ApiBearerAuth()
@Controller('api/projects/:projectId/webhooks')
@UseGuards(JwtAuthGuard)
export class WebhooksController {
  constructor(private readonly webhooks: WebhookDispatcherService) {}

  @Get()
  @ApiOperation({ summary: 'Get persisted Slack/Discord/REST webhook config and real delivery logs' })
  @ApiParam({ name: 'projectId' })
  getConfig(@Req() req: any, @Param('projectId') projectId: string) {
    return this.webhooks.getConfig(projectId, req.user?.userId);
  }

  @Patch()
  @ApiOperation({ summary: 'Save Slack/Discord/REST webhook endpoints and subscribed alert events' })
  @ApiParam({ name: 'projectId' })
  saveConfig(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: UpdateWebhookConfigDto,
  ) {
    return this.webhooks.saveConfig(projectId, req.user?.userId, body);
  }

  @Post('test')
  @ApiOperation({ summary: 'Send a real SSRF-safe HTTP test webhook and record the measured response' })
  @ApiParam({ name: 'projectId' })
  testWebhook(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Body() body: TestWebhookDto,
  ) {
    return this.webhooks.sendTestWebhook(projectId, req.user?.userId, body.channel);
  }

  @Delete('logs')
  @ApiOperation({ summary: 'Clear webhook delivery history for this project' })
  @ApiParam({ name: 'projectId' })
  clearLogs(@Req() req: any, @Param('projectId') projectId: string) {
    return this.webhooks.clearLogs(projectId, req.user?.userId);
  }
}
