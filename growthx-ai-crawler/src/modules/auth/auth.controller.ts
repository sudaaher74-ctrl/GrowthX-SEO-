import { Controller, Post, Body, UnauthorizedException, Get, UseGuards, Req, Res } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthGuard } from './google-auth.guard';
import { AllowWithoutOrganization } from './allow-without-organization.decorator';
import { UsersService } from '../users/users.service';

/**
 * Both of these took `@Body() body: any`.
 *
 * The global `ValidationPipe` runs with `whitelist: true`, but it has nothing
 * to validate or strip against an untyped body, so every field arrived exactly
 * as sent: `POST /auth/register {}` reached `bcrypt.hash(undefined, 10)` and
 * came back a 500 naming nothing, and an address that is not an address, or a
 * one-character password, was accepted without comment.
 */
export class RegisterDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(320)
  email: string;

  @IsString()
  @MinLength(8, { message: 'Choose a password of at least 8 characters.' })
  @MaxLength(200)
  password: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  lastName?: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'A valid email address is required.' })
  @MaxLength(320)
  email: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password: string;
}

/** The code the Google redirect hands the browser, traded here for a session. */
export class OAuthExchangeDto {
  @IsString()
  @IsNotEmpty()
  code: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private usersService: UsersService,
  ) {}

  @Post('login')
  async login(@Body() body: LoginDto) {
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
  async register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  /**
   * Trades the one-time code from the Google redirect for a real session.
   *
   * A POST, so the code travels in a body rather than in a URL that browsers,
   * `Referer` headers and proxy logs all keep.
   */
  @Post('oauth/exchange')
  async exchangeOAuthCode(@Body() body: OAuthExchangeDto) {
    return this.authService.exchangeOAuthCode(body.code);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  async googleAuth(@Req() req: any) {
    // Initiates the Google OAuth flow
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  async googleAuthRedirect(@Req() req: any, @Res() res: any) {
    // A one-minute code, not the tokens themselves. The pair used to be put in
    // this URL's query string, which persists it in the browser's history, in
    // the `Referer` header the callback page sends to anything it loads, and in
    // the access log of every proxy in between — including a refresh token good
    // for thirty days.
    const code = this.authService.issueOAuthExchangeCode(req.user);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.redirect(`${frontendUrl}/auth/callback?code=${encodeURIComponent(code)}`);
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

