import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiQuery } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { AdminCostEngineService } from './admin-cost-engine.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';
import {
  AiRouterProbeDto,
  DrainQueueDto,
  ForceFailCrawlDto,
  QueueActionDto,
  RetryQueueJobsDto,
  TriggerWebsiteCrawlDto,
  UpdateAdminCostRatesDto,
  UpdateAdminTenantDto,
  UpdateAdminWebsiteDto,
  UpdateAiRouterConfigDto,
} from './admin.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly costEngine: AdminCostEngineService,
  ) {}

  @Get('access')
  @ApiOperation({ summary: 'Verify operator access for the current signed-in user' })
  getAccess(@Req() req: any) {
    return {
      authorized: true,
      userId: req.user?.userId ?? null,
      email: req.user?.email ?? null,
    };
  }

  // ── Runtime & Infra
  @Get('system-health')
  @ApiOperation({ summary: 'Get live infrastructure and service health' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('system-runtime')
  @ApiOperation({ summary: 'Get Node process metrics, Postgres size/counts, Redis INFO, worker threads, and env flags' })
  async getSystemRuntime() {
    return this.adminService.getSystemRuntime();
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

  // ── Website Audit & Crawler Engine Control
  @Get('websites')
  @ApiOperation({ summary: 'List all websites across tenants with crawl parameters and latest run' })
  @ApiQuery({ name: 'limit', required: false })
  async getWebsites(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getWebsites(Number.isFinite(parsed) ? parsed : 100);
  }

  @Patch('websites/:websiteId')
  @ApiOperation({ summary: 'Override website verification status, crawl schedule, concurrency, depth, or rate limit' })
  @ApiParam({ name: 'websiteId' })
  async updateWebsite(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
    @Body() body: UpdateAdminWebsiteDto,
  ) {
    return this.adminService.updateWebsite(websiteId, body, req.user?.userId);
  }

  @Post('websites/:websiteId/crawl')
  @ApiOperation({ summary: 'Force-trigger a website crawl with custom operator concurrency/depth/page/render overrides' })
  @ApiParam({ name: 'websiteId' })
  async triggerWebsiteCrawl(
    @Req() req: any,
    @Param('websiteId') websiteId: string,
    @Body() body: TriggerWebsiteCrawlDto,
  ) {
    return this.adminService.triggerWebsiteCrawl(websiteId, body ?? {}, req.user?.userId);
  }

  @Get('crawls')
  @ApiOperation({ summary: 'Get recent cross-tenant crawl and Google data sync runs' })
  @ApiQuery({ name: 'limit', required: false })
  async getRecentCrawls(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getRecentCrawls(Number.isFinite(parsed) ? parsed : 40);
  }

  @Get('crawls/:jobId')
  @ApiOperation({ summary: 'Inspect deep technical diagnostics for one crawl job (frontier, HTTP codes, issues, errors)' })
  @ApiParam({ name: 'jobId' })
  async getCrawlDetail(@Param('jobId') jobId: string) {
    return this.adminService.getCrawlDetail(jobId);
  }

  @Post('crawls/:jobId/cancel')
  @ApiOperation({ summary: 'Cancel an active or pending crawl job and clear pending task counters' })
  @ApiParam({ name: 'jobId' })
  async cancelCrawl(@Req() req: any, @Param('jobId') jobId: string) {
    return this.adminService.cancelCrawl(jobId, req.user?.userId);
  }

  @Post('crawls/:jobId/force-fail')
  @ApiOperation({ summary: 'Force-close a stuck or orphaned crawl job as FAILED and release Redis tracking' })
  @ApiParam({ name: 'jobId' })
  async forceFailCrawl(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @Body() body?: ForceFailCrawlDto,
  ) {
    return this.adminService.forceFailCrawl(jobId, body?.reason, req.user?.userId);
  }

  // ── BullMQ Queue Engine
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

  @Get('queues/jobs')
  @ApiOperation({ summary: 'Inspect BullMQ jobs in any state with raw JSON payload and stacktrace' })
  @ApiQuery({ name: 'queue', required: true })
  @ApiQuery({ name: 'state', required: false })
  @ApiQuery({ name: 'limit', required: false })
  async getQueueJobs(
    @Query('queue') queue: string,
    @Query('state') state = 'failed',
    @Query('limit') limit?: string,
  ) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getQueueJobs(queue, state, Number.isFinite(parsed) ? parsed : 30);
  }

  @Delete('queues/:queue/jobs/:jobId')
  @ApiOperation({ summary: 'Remove a specific job from a BullMQ queue' })
  async removeQueueJob(@Param('queue') queue: string, @Param('jobId') jobId: string) {
    return this.adminService.removeQueueJob(queue, jobId);
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

  @Post('queues/drain')
  @ApiOperation({ summary: 'Drain waiting (and optionally delayed) jobs from a queue' })
  async drainQueue(@Body() body: DrainQueueDto) {
    return this.adminService.drainQueue(body.queue, body.delayed);
  }

  // ── AI Router Control, Probe & FinOps
  @Get('ai-router/config')
  @ApiOperation({ summary: 'Inspect live Multi-AI Router topology, provider circuit breakers, model overrides, and caches' })
  getAiRouterConfig() {
    return this.adminService.getAiRouterConfig();
  }

  @Patch('ai-router/config')
  @ApiOperation({ summary: 'Apply zero-restart runtime provider circuit breakers or model overrides' })
  updateAiRouterConfig(@Body() body: UpdateAiRouterConfigDto) {
    return this.adminService.updateAiRouterConfig(body);
  }

  @Post('ai-router/cache/clear')
  @ApiOperation({ summary: 'Flush in-memory AI response cache and org tier cache' })
  clearAiRouterCaches() {
    return this.adminService.clearAiRouterCaches();
  }

  @Post('ai-router/probe')
  @ApiOperation({ summary: 'Run a live diagnostic prompt through MultiAiRouterService and inspect latency/tokens/output' })
  async probeAiRouter(@Body() body: AiRouterProbeDto) {
    return this.adminService.probeAiRouter(body);
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

  @Get('user-models')
  @ApiOperation({ summary: 'Get AI model usage breakdown by user and organization' })
  async getUserModelBreakdown() {
    return this.adminService.getUserModelBreakdown();
  }

  // ── Tenants & Billing
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

  // ── Users & IAM + Automated FinOps Cost Engine
  @Get('users')
  @ApiOperation({ summary: 'Get platform users directory' })
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Get('users/intelligence')
  @ApiOperation({ summary: 'Get complete per-user status, token burn, crawl usage, and auto-calculated 5-bucket COGS' })
  @ApiQuery({ name: 'window', required: false, description: '24h | 7d | mtd | 30d | all' })
  async getUsersIntelligence(@Query('window') window?: string) {
    return this.costEngine.getUsersIntelligence(window);
  }

  @Get('users/:userId/360')
  @ApiOperation({ summary: 'Get deep 360° telemetry, daily cost trend, models, crawls, and wallet for one user' })
  @ApiParam({ name: 'userId' })
  @ApiQuery({ name: 'window', required: false, description: '24h | 7d | mtd | 30d | all' })
  async getUser360(@Param('userId') userId: string, @Query('window') window?: string) {
    return this.costEngine.getUser360(userId, window);
  }

  @Get('cost-rates')
  @ApiOperation({ summary: 'Read live unit-cost rate card (crawl, Chromium, Geo-Grid, APIs, MRR, USD/INR FX)' })
  getCostRates() {
    return this.costEngine.getRates();
  }

  @Patch('cost-rates')
  @ApiOperation({ summary: 'Update live unit-cost rate card & USD/INR exchange rate for automated COGS accounting' })
  async updateCostRates(@Req() req: any, @Body() body: UpdateAdminCostRatesDto) {
    return this.costEngine.updateRates(body, req.user?.userId);
  }

  @Post('users/:userId/verify-email')
  @ApiOperation({ summary: 'Manually mark a user email address as verified' })
  @ApiParam({ name: 'userId' })
  async verifyUserEmail(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.verifyUserEmail(userId, req.user?.userId);
  }

  @Post('users/:userId/revoke-sessions')
  @ApiOperation({ summary: 'Force sign-out a user by revoking all active sessions' })
  @ApiParam({ name: 'userId' })
  async revokeUserSessions(@Req() req: any, @Param('userId') userId: string) {
    return this.adminService.revokeUserSessions(userId, req.user?.userId);
  }

  // ── Pipelines, Audit Logs & Webhooks
  @Get('pipelines')
  @ApiOperation({ summary: 'Inspect cross-tenant Autopilot, AI Visibility, Backlink Discovery, Fix Engine, and Research runs' })
  @ApiQuery({ name: 'limit', required: false })
  async getPipelines(@Query('limit') limit?: string) {
    const parsed = parseInt(limit ?? '', 10);
    return this.adminService.getPipelines(Number.isFinite(parsed) ? parsed : 25);
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
}
