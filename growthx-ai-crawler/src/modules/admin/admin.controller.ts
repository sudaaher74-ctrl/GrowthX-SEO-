import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Admin')
@ApiBearerAuth()
@Controller('api/admin')
@UseGuards(JwtAuthGuard)
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
