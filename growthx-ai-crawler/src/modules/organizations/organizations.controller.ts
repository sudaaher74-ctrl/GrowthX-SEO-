import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Prisma } from '@prisma/client';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private organizationsService: OrganizationsService) {}

  @Post()
  async createOrganization(@Request() req: any, @Body() body: Prisma.OrganizationCreateInput) {
    return this.organizationsService.createOrganization(req.user.userId, body);
  }

  @Get()
  async getOrganizations(@Request() req: any) {
    return this.organizationsService.getOrganizationsForUser(req.user.userId);
  }
}

