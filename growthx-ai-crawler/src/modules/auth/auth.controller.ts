import { Controller, Post, Body, UnauthorizedException, Get, UseGuards, Req, Res, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ExchangeCodeDto, LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleAuthExceptionFilter } from './google-auth.filter';
import { AllowWithoutOrganization } from './allow-without-organization.decorator';
import { UsersService } from '../users/users.service';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  /**
   * Far tighter than the global limit, which allowed 120 password guesses a
   * minute from one address. Ten a minute is plenty for a person mistyping.
   */
  @Post('login')
  @Throttle({ burst: { limit: 3, ttl: 1_000 }, sustained: { limit: 10, ttl: 60_000 } })
  async login(@Body() body: LoginDto) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.authService.login(user);
  }

  @Post('refresh')
  @Throttle({ burst: { limit: 5, ttl: 1_000 }, sustained: { limit: 30, ttl: 60_000 } })
  async refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refresh_token);
  }

  /** Trades the one-time code from the Google redirect for the session tokens. */
  @Post('exchange')
  @Throttle({ burst: { limit: 3, ttl: 1_000 }, sustained: { limit: 10, ttl: 60_000 } })
  async exchange(@Body() body: ExchangeCodeDto) {
    return this.authService.exchangeLoginCode(body.code);
  }

  /** Sign-ups from one address, capped so a script cannot mass-create accounts. */
  @Post('register')
  @Throttle({ burst: { limit: 2, ttl: 1_000 }, sustained: { limit: 5, ttl: 60_000 } })
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleAuthExceptionFilter)
  async googleAuth(@Req() req: any) {
    // Initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleAuthExceptionFilter)
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    const rawFrontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const frontendUrl = rawFrontendUrl.replace(/\/+$/, '');
    try {
      if (!req.user) {
        throw new UnauthorizedException('No user information received from Google');
      }
      const code = await this.authService.createLoginCode(req.user.id);
      return res.redirect(`${frontendUrl}/auth/callback?code=${encodeURIComponent(code)}`);
    } catch (err: any) {
      const message = err?.message || 'Google authentication failed';
      return res.redirect(`${frontendUrl}/login?error=${encodeURIComponent(message)}`);
    }
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
  async logout(@Req() req: any) {
    const userId = req?.user?.userId || req?.user?.id;
    if (userId) await this.authService.revokeAllSessions(userId);
    return { success: true, message: 'Logged out successfully' };
  }
}

