import { Controller, Post, Body, UnauthorizedException, Get, UseGuards, Req, Res } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from './jwt-auth.guard';
import { AllowWithoutOrganization } from './allow-without-organization.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body() body: any) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('refresh')
  async refresh(@Body() body: { refresh_token?: string }) {
    return this.authService.refresh(body?.refresh_token ?? '');
  }

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  async googleAuth(@Req() req: any) {
    // Initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const tokens = await this.authService.login(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?access_token=${tokens.access_token}&refresh_token=${tokens.refresh_token}`);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @AllowWithoutOrganization()
  async getMe(@Req() req: any) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    const { passwordHash: _passwordHash, ...safeUser } = user;
    return safeUser;
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @AllowWithoutOrganization()
  async logout() {
    return { success: true, message: 'Logged out successfully' };
  }
}

