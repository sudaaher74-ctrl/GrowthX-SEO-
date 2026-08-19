import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { FacebookService } from './facebook.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Response } from 'express';

@Controller('integrations/facebook')
export class FacebookController {
  constructor(private readonly facebookService: FacebookService) {}

  @Get('auth')
  @UseGuards(JwtAuthGuard)
  getAuthUrl(@Query('projectId') projectId: string) {
    if (!projectId) {
      throw new Error('projectId is required');
    }
    const url = this.facebookService.getAuthUrl(projectId);
    return { url };
  }

  @Get('callback')
  async handleCallback(@Query('code') code: string, @Query('state') state: string, @Res() res: Response) {
    if (!code || !state) {
      return res.redirect(process.env.FRONTEND_URL + '/content?error=missing_code');
    }

    try {
      await this.facebookService.handleCallback(code, state);
      return res.redirect(process.env.FRONTEND_URL + '/content?success=true');
    } catch (error) {
      return res.redirect(process.env.FRONTEND_URL + '/content?error=callback_failed');
    }
  }
}
