import { Controller, Get, Query, Res, Req, UseGuards, Param } from '@nestjs/common';
import { GoogleBusinessService } from './google-business.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('integrations/google-business')
export class GoogleBusinessController {
  constructor(private readonly googleBusinessService: GoogleBusinessService) {}

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    const url = this.googleBusinessService.getAuthUrl(projectId);
    return { url };
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    if (!code || !state) {
      return res.redirect(process.env.FRONTEND_URL + '/local?error=missing_code');
    }

    try {
      await this.googleBusinessService.handleCallback(code, state);
      return res.redirect(process.env.FRONTEND_URL + '/local?success=true');
    } catch (error) {
      return res.redirect(process.env.FRONTEND_URL + '/local?error=callback_failed');
    }
  }

  @Get('projects/:projectId/accounts')
  @UseGuards(JwtAuthGuard)
  async getAccounts(@Param('projectId') projectId: string) {
    const accounts = await this.googleBusinessService.getAccounts(projectId);
    return { accounts };
  }

  @Get('projects/:projectId/accounts/:accountId/locations')
  @UseGuards(JwtAuthGuard)
  async getLocations(@Param('projectId') projectId: string, @Param('accountId') accountId: string) {
    const locations = await this.googleBusinessService.getLocations(projectId, accountId);
    return { locations };
  }
}
