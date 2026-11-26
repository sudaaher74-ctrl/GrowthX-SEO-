import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import { QueueActionDto, RetryQueueJobsDto, UpdateAdminTenantDto } from './admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('access')
  @ApiOperation({ summary: 'Verify operator access for the current signed-in user' })
  getAccess(@Req() req: any) {
    return {
      authorized: true,
      userId: req.user?.userId ?? null,
      email: req.user?.email ?? null,
    };
  }

  @Get('queues')
  @ApiOperation({ summary: 'Get BullMQ queue statistics across all worker queues' })
  async getQueueStats() {
    return this.adminService.getQueueStats();
  }

  @Get('queues/failed')
  @ApiOperation({ summary: 'Inspect recent failed BullMQ jobs' })
  @ApiQuery({ name: 'limit', required: false })
  async getFailedJobs(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getFailedJobs(Number.isFinite(parsed) ? parsed : 40);
  }

  @Get('costs')
  @ApiOperation({ summary: 'Get API cost breakdown' })
  async getApiCosts() {
    return this.adminService.getApiCosts();
  }

  @Get('ai-analytics')
  @ApiOperation({ summary: 'Get AI FinOps analytics: daily trends, task latency, org spend, and recent errors' })
  @ApiQuery({ name: 'days', required: false })
  async getAiAnalytics(@Query('days') days?: string) {
    const parsed = parseInt(days ?? '', 10);
    return this.adminService.getAiAnalytics(Number.isFinite(parsed) ? parsed : 14);
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get tenant workspaces directory' })
  async getTenants() {
    return this.adminService.getTenants();
  }

  @Get('tenants/:orgId')
  @ApiOperation({ summary: 'Get full operator details for one tenant organization' })
  @ApiParam({ name: 'orgId' })
  async getTenantDetail(@Param('orgId') orgId: string) {
    return this.adminService.getTenantDetail(orgId);
  }

  @Patch('tenants/:orgId')
  @ApiOperation({ summary: 'Update a tenant subscription tier, AI spend budget, or white-label status' })
  @ApiParam({ name: 'orgId' })
  async updateTenant(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @Body() body: UpdateAdminTenantDto,
  ) {
    return this.adminService.updateTenant(orgId, body, req.user?.userId);
  }

  @Get('system-health')
  @ApiOperation({ summary: 'Get live infrastructure and service health' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get platform-wide totals (tenants, users, projects, live sessions)' })
  async getStats() {
    return this.adminService.getStats();
  }

  @Get('ops-summary')
  @ApiOperation({ summary: 'Get operational summary: 24h crawls, MTD AI metrics, tier breakdown, and alerts' })
  async getOpsSummary() {
    return this.adminService.getOpsSummary();
  }

  @Get('user-models')
  @ApiOperation({ summary: 'Get AI model usage breakdown by user and organization' })
  async getUserModelBreakdown() {
    return this.adminService.getUserModelBreakdown();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get platform users directory' })
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Post('users/:userId/revoke-sessions')
  @ApiOperation({ summary: 'Force sign-out a user by revoking all active sessions' })
  @ApiParam({ name: 'userId' })
  async revokeUserSessions(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.revokeUserSessions(userId, req.user?.userId);
  }

  @Get('crawls')
  @ApiOperation({ summary: 'Get recent cross-tenant crawl and Google data sync runs' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentCrawls(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getRecentCrawls(Number.isFinite(parsed) ? parsed : 40);
  }

  @Get('audit-logs')
  @ApiOperation({ summary: 'Get platform-wide audit log entries' })
  @ApiQuery({ name: 'limit', required: false })
  async getAuditLogs(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getAuditLogs(Number.isFinite(parsed) ? parsed : 100);
  }

  @Get('webhooks')
  @ApiOperation({ summary: 'Get incoming webhook events and outgoing webhook delivery logs' })
  @ApiQuery({ name: 'limit', required: false })
  async getWebhooks(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getWebhooks(Number.isFinite(parsed) ? parsed : 40);
  }

  @Post('queues/pause')
  @ApiOperation({ summary: 'Pause all or a specific background worker queue' })
  async pauseQueues(@Body() body?: QueueActionDto) {
    return this.adminService.pauseQueues(body?.queue);
  }

  @Post('queues/resume')
  @ApiOperation({ summary: 'Resume all or a specific background worker queue' })
  async resumeQueues(@Body() body?: QueueActionDto) {
    return this.adminService.resumeQueues(body?.queue);
  }

  @Post('queues/retry')
  @ApiOperation({ summary: 'Retry failed queue jobs (all, one queue, or one job)' })
  async retryFailedJobs(@Body() body?: RetryQueueJobsDto) {
    return this.adminService.retryFailedJobs(body?.queue, body?.jobId);
  }

  @Post('queues/clean-failed')
  @ApiOperation({ summary: 'Clear failed jobs from all or one queue' })
  async cleanFailedJobs(@Body() body?: QueueActionDto) {
    return this.adminService.cleanFailedJobs(body?.queue);
  }
}
