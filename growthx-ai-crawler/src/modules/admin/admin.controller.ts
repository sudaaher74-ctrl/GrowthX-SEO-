import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard, PlatformAdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('queues')
  @ApiOperation({ summary: 'Get BullMQ queue statistics' })
  async getQueueStats() {
    return this.adminService.getQueueStats();
  }

  @Get('costs')
  @ApiOperation({ summary: 'Get API cost breakdown' })
  async getApiCosts() {
    return this.adminService.getApiCosts();
  }

  @Get('tenants')
  @ApiOperation({ summary: 'Get tenant workspaces directory' })
  async getTenants() {
    return this.adminService.getTenants();
  }

  @Get('system-health')
  @ApiOperation({ summary: 'Get infrastructure and service health' })
  async getSystemHealth() {
    return this.adminService.getSystemHealth();
  }

  @Get('users')
  @ApiOperation({ summary: 'Get platform users directory' })
  async getUsers() {
    return this.adminService.getUsers();
  }

  @Post('queues/pause')
  @ApiOperation({ summary: 'Pause all background worker queues' })
  async pauseQueues() {
    return this.adminService.pauseQueues();
  }

  @Post('queues/resume')
  @ApiOperation({ summary: 'Resume background worker queues' })
  async resumeQueues() {
    return this.adminService.resumeQueues();
  }

  @Post('queues/retry')
  @ApiOperation({ summary: 'Retry failed queue jobs' })
  async retryFailedJobs() {
    return this.adminService.retryFailedJobs();
  }
}

