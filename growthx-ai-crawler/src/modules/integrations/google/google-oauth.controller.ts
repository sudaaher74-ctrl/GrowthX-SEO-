import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { Roles } from '../../auth/roles.decorator';
import { getCookieBaseOptions } from '../../auth/auth-cookie.util';
import { Role } from '@prisma/client';
import { GOOGLE_INTEGRATION_NONCE_COOKIE, GoogleOAuthService } from './google-oauth.service';
import { isGoogleProvider } from './google-provider';

const GOOGLE_INT_COOKIE_PATH = '/api/integrations/google/callback';
const GOOGLE_INT_TTL_MS = 15 * 60 * 1000;

function integrationNonceCookieOptions() {
  const base = getCookieBaseOptions();
  return {
    ...base,
    httpOnly: true,
    path: GOOGLE_INT_COOKIE_PATH,
  };
}

/**
 * Starting and finishing a Google connection.
 *
 * The callback is deliberately outside the project-scoped, guarded controller
 * below: Google redirects a browser to it, and a browser redirect carries no
 * Authorization header. The signed state is what authenticates it instead —
 * see oauth-state.ts.
 */
@ApiTags('Integrations')
@Controller('api/integrations/google')
export class GoogleOAuthCallbackController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  @Get('callback')
  @ApiOperation({ summary: 'OAuth callback for every Google data connector' })
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const appUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const back = (path: string) => res.redirect(`${appUrl}${path}`);

    const browserNonce =
      typeof req?.cookies?.[GOOGLE_INTEGRATION_NONCE_COOKIE] === 'string'
        ? req.cookies[GOOGLE_INTEGRATION_NONCE_COOKIE]
        : undefined;
    res.clearCookie(GOOGLE_INTEGRATION_NONCE_COOKIE, integrationNonceCookieOptions());

    // The customer pressed Cancel on Google's consent screen. Not an error to
    // report — take them back to where they started.
    if (error) return back(`/integrations?google=cancelled`);
    if (!code || !state || !browserNonce) return back(`/integrations?google=invalid`);

    try {
      const result = await this.oauth.completeAuthorization({ code, state, browserNonce });
      const destination = result.returnTo || '/integrations';
      // A connection with no property chosen yet is not finished, so the
      // customer is sent straight to choosing one rather than to a card that
      // says "Connected" and returns nothing.
      const next = result.missingScopes.length > 0 ? 'scopes' : 'select';
      return back(`${destination}?google=${next}&provider=${result.integration.provider}`);
    } catch (_err: any) {
      // The reason is not put in the URL: it can contain detail about why a
      // state failed to verify, which is a hint to whoever forged it.
      return back(`/integrations?google=failed`);
    }
  }
}

@ApiTags('Integrations')
@ApiBearerAuth()
@Controller('api/projects/:projectId/integrations/google')
@UseGuards(JwtAuthGuard)
export class GoogleOAuthController {
  constructor(private readonly oauth: GoogleOAuthService) {}

  /** Every Google provider and where this project stands with each. */
  @Get()
  @ApiOperation({ summary: 'Google connection status for the project' })
  status(@Param('projectId') projectId: string) {
    return this.oauth.statusFor(projectId);
  }

  /**
   * The URL to send the customer to. Returned rather than redirected so the
   * client can open it however suits — the caller is an authenticated fetch,
   * not a navigation.
   */
  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':provider/authorize')
  @ApiOperation({ summary: 'Begin connecting a Google service' })
  async authorize(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('provider') provider: string,
    @Query('returnTo') returnTo?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    if (!isGoogleProvider(provider)) throw new BadRequestException(`Unknown Google service "${provider}".`);

    const safeReturnTo =
      returnTo && returnTo.startsWith('/') && !returnTo.startsWith('//') ? returnTo : undefined;

    const { authorizationUrl, browserNonce } = await this.oauth.startAuthorization({
      provider,
      projectId,
      organizationId: req.organizationId,
      userId: req.user?.userId,
      returnTo: safeReturnTo,
    });

    res?.cookie(GOOGLE_INTEGRATION_NONCE_COOKIE, browserNonce, {
      ...integrationNonceCookieOptions(),
      maxAge: GOOGLE_INT_TTL_MS,
    });

    return { authorizationUrl };
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Post(':provider/select')
  @ApiOperation({ summary: 'Choose the property or location to read' })
  select(
    @Param('projectId') projectId: string,
    @Param('provider') provider: string,
    @Query('resourceId') resourceId: string,
    @Query('resourceName') resourceName: string,
  ) {
    if (!isGoogleProvider(provider)) throw new BadRequestException(`Unknown Google service "${provider}".`);
    if (!resourceId) throw new BadRequestException('A property or location must be chosen.');

    return this.oauth.selectResource(projectId, provider, { id: resourceId, name: resourceName || resourceId });
  }

  @Roles(Role.OWNER, Role.ADMIN)
  @Delete(':provider')
  @ApiOperation({ summary: 'Disconnect and revoke a Google service' })
  disconnect(@Req() req: any, @Param('projectId') projectId: string, @Param('provider') provider: string) {
    if (!isGoogleProvider(provider)) throw new BadRequestException(`Unknown Google service "${provider}".`);
    return this.oauth.disconnect(projectId, provider, req.user?.userId);
  }
}
