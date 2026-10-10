import { Controller, Logger, Post, Delete, Body, UnauthorizedException, Get, UseGuards, Req, Res, UseFilters } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { ExchangeCodeDto, LoginDto, RefreshDto, RegisterDto } from './auth.dto';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { GoogleAuthExceptionFilter } from './google-auth.filter';
import { AllowWithoutOrganization } from './allow-without-organization.decorator';
import { UsersService } from '../users/users.service';
import { setAuthCookies, clearAuthCookies, setCsrfCookie } from './auth-cookie.util';

/**
 * Browser clients opt in with `X-Auth-Mode: cookie`: their session lives only in
 * HttpOnly cookies, so the tokens are not repeated in the JSON body where
 * page scripts could read and store them. Other clients (scripts, tests) keep
 * receiving tokens in the body and use the Bearer header.
 */
function sessionBody<T extends { access_token: string; refresh_token?: string; expires_in?: number }>(
  result: T,
  req?: Request,
): T | { success: true; expires_in?: number } {
  if (req?.headers?.['x-auth-mode'] === 'cookie') {
    return { success: true, expires_in: result.expires_in };
  }
  return result;
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

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
  async login(@Body() body: LoginDto, @Res({ passthrough: true }) res?: Response, @Req() req?: Request) {
    const user = await this.authService.validateUser(body.email, body.password);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const result = await this.authService.login(user);
    if (res) setAuthCookies(res, result);
    return sessionBody(result, req);
  }

  @Post('refresh')
  @Throttle({ burst: { limit: 5, ttl: 1_000 }, sustained: { limit: 30, ttl: 60_000 } })
  async refresh(
    @Body() body: RefreshDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res?: Response,
  ) {
    // Cookie-mode browsers never put the refresh token in a body; only
    // non-browser clients do.
    const token = (req.cookies?.refresh_token as string | undefined) || body?.refresh_token;
    if (!token) {
      throw new UnauthorizedException('A refresh token is required.');
    }
    const cookies = String(req.headers?.cookie || '').split(';').map(cookie => cookie.trim()).filter(cookie => cookie.startsWith('refresh_token=')).map(cookie => {
      try { return decodeURIComponent(cookie.slice('refresh_token='.length)); } catch { return ''; }
    }).filter(Boolean);
    const result = cookies.length > 1 ? await this.authService.refreshCookieCandidates(cookies) : await this.authService.refresh(token);
    if (res) setAuthCookies(res, result);
    return sessionBody(result, req);
  }

  /** Trades the one-time code from the Google redirect for the session tokens. */
  @Post('exchange')
  @Throttle({ burst: { limit: 3, ttl: 1_000 }, sustained: { limit: 10, ttl: 60_000 } })
  async exchange(@Body() body: ExchangeCodeDto, @Res({ passthrough: true }) res?: Response, @Req() req?: Request) {
    const result = await this.authService.exchangeLoginCode(body.code);
    if (res) setAuthCookies(res, result);
    return sessionBody(result, req);
  }

  /** Sign-ups from one address, capped so a script cannot mass-create accounts. */
  @Post('register')
  @Throttle({ burst: { limit: 2, ttl: 1_000 }, sustained: { limit: 5, ttl: 60_000 } })
  async register(@Body() body: RegisterDto, @Res({ passthrough: true }) res?: Response, @Req() req?: Request) {
    const result = await this.authService.register(body);
    if (res) setAuthCookies(res, result);
    return sessionBody(result, req);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @UseFilters(GoogleAuthExceptionFilter)
  async googleAuth(@Req() _req: any) {
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

  /**
   * Returns the current CSRF token so a frontend on a different domain, which
   * cannot read this API's cookies, can send it back as `X-CSRF-Token`. Other
   * origins are refused by CORS and cannot read the response.
   */
  @Get('csrf')
  csrf(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Refresh the cookie lifetime when the dashboard asks for a token. If an
    // old cookie has expired, issue a new token so long-lived sessions recover.
    const csrfToken =
      (req.cookies?.csrf_token as string | undefined) ?? setCsrfCookie(res);
    if (req.cookies?.csrf_token) {
      setCsrfCookie(res, csrfToken);
    }
    return { csrf_token: csrfToken };
  }

  /**
   * Ends this browser's session. Not behind the JWT guard on purpose: the access
   * cookie lives 15 minutes, and a user whose access cookie has lapsed must still
   * be able to sign out and have their refresh session revoked. Pass
   * `{ "all": true }` to end every session of the account.
   */
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Body() body: { all?: boolean } | undefined,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const refreshToken = req.cookies?.refresh_token as string | undefined;
    const userId = await this.authService.revokeSessionForToken(refreshToken, body?.all === true);
    if (userId) this.logger.log(`SECURITY_EVENT LOGOUT user=${userId} all=${body?.all === true}`);
    if (res) clearAuthCookies(res);
    return { success: true, message: 'Logged out successfully' };
  }

  /**
   * Deletes the user account, sole workspaces, and revokes OAuth grants.
   * Clears cookies upon deletion.
   */
  @Delete('account')
  @UseGuards(JwtAuthGuard)
  @AllowWithoutOrganization()
  async deleteAccount(@Req() req: any, @Res({ passthrough: true }) res?: Response) {
    const userId = req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Not authenticated');
    }
    await this.usersService.deleteAccount(userId);
    if (res) clearAuthCookies(res);
    return { success: true, message: 'Account deleted successfully' };
  }
}

