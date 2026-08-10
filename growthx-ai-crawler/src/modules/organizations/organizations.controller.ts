import { Body, Controller, Delete, Get, Param, Patch, Post, Request, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Prisma, Role } from '@prisma/client';

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

  @Get(':id/members')
  async listMembers(@Param('id') id: string) {
    return this.organizationsService.listMembers(id);
  }

  @Post(':id/members')
  async addMember(@Request() req: any, @Param('id') id: string, @Body() body: { email: string; role?: Role }) {
    return this.organizationsService.addMember(id, req.user.userId, body.email, body.role ?? Role.MEMBER);
  }

  @Patch(':id/members/:memberId')
  async updateMemberRole(
    @Request() req: any,
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() body: { role: Role },
  ) {
    return this.organizationsService.updateMemberRole(id, req.user.userId, memberId, body.role);
  }

  @Delete(':id/members/:memberId')
  async removeMember(@Request() req: any, @Param('id') id: string, @Param('memberId') memberId: string) {
    await this.organizationsService.removeMember(id, req.user.userId, memberId);
    return { success: true };
  }
}

