import { BadRequestException, Controller, Delete, Get, Param, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { GoogleOAuthService } from './google-oauth.service';
import { isGoogleProvider } from './google-provider';

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
    @Res() res: Response,
  ) {
    const appUrl = (process.env.APP_BASE_URL || '').replace(/\/$/, '');
    const back = (path: string) => res.redirect(`${appUrl}${path}`);

    // The customer pressed Cancel on Google's consent screen. Not an error to
    // report — take them back to where they started.
    if (error) return back(`/integrations?google=cancelled`);
    if (!code || !state) return back(`/integrations?google=invalid`);

    try {
      const result = await this.oauth.completeAuthorization({ code, state });
      const destination = result.returnTo || '/integrations';
      // A connection with no property chosen yet is not finished, so the
      // customer is sent straight to choosing one rather than to a card that
      // says "Connected" and returns nothing.
      const next = result.missingScopes.length > 0 ? 'scopes' : 'select';
      return back(`${destination}?google=${next}&provider=${result.integration.provider}`);
    } catch (err: any) {
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
  @Post(':provider/authorize')
  @ApiOperation({ summary: 'Begin connecting a Google service' })
  authorize(
    @Req() req: any,
    @Param('projectId') projectId: string,
    @Param('provider') provider: string,
    @Query('returnTo') returnTo?: string,
  ) {
    if (!isGoogleProvider(provider)) throw new BadRequestException(`Unknown Google service "${provider}".`);

    return {
      authorizationUrl: this.oauth.authorizationUrl({
        provider,
        projectId,
        organizationId: req.organizationId,
        // Only a path, never an absolute URL: an attacker-supplied returnTo
        // would otherwise make this an open redirect off the back of a
        // trusted domain.
        returnTo: returnTo?.startsWith('/') ? returnTo : undefined,
      }),
    };
  }

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

  @Delete(':provider')
  @ApiOperation({ summary: 'Disconnect and revoke a Google service' })
  disconnect(@Req() req: any, @Param('projectId') projectId: string, @Param('provider') provider: string) {
    if (!isGoogleProvider(provider)) throw new BadRequestException(`Unknown Google service "${provider}".`);
    return this.oauth.disconnect(projectId, provider, req.user?.id);
  }
}
