import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformAdminGuard } from './platform-admin.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
// Every route here reports across all tenants. `JwtAuthGuard` alone only
// established that the caller was signed in, so any self-registered account
// could read the workspace directory — other customers' names, owner emails
// and plans — along with platform queue depth and model spend.
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
}
