import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-google-oauth20';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';

/**
 * Whether this deployment can run the Google sign-in flow.
 *
 * Passport's OAuth2 strategy throws from its own constructor on an empty
 * clientID, so registering this strategy unconditionally took the whole API
 * down at boot — all 48 modules, every route — on any deployment that had not
 * configured Google. `.env.example` ships these blank and the rest of the
 * product treats Google as an optional integration, so an operator following
 * the example file got a dead API and a passport stack trace explaining
 * nothing. Email and password sign-in never needed Google to begin with.
 */
export function googleSignInConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim(),
  );
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const rawClientId = configService.get<string>('GOOGLE_CLIENT_ID') || '';
    const rawClientSecret = configService.get<string>('GOOGLE_CLIENT_SECRET') || '';
    const clientID = rawClientId.trim().replace(/^["']|["']$/g, '');
    const clientSecret = rawClientSecret.trim().replace(/^["']|["']$/g, '');

    // In production, default callbackURL to canonical HTTPS URL to guarantee
    // the redirect_uri sent during token exchange exactly matches authorization.
    const defaultCallback =
      process.env.NODE_ENV === 'production'
        ? 'https://growthx-crawler-api.onrender.com/auth/google/callback'
        : '/auth/google/callback';

    const callbackURL =
      (configService.get<string>('GOOGLE_CALLBACK_URL') || defaultCallback)
        .trim()
        .replace(/^["']|["']$/g, '');

    // Only registered when `googleSignInConfigured()` holds, so these are set.
    super({
      clientID,
      clientSecret,
      callbackURL,
      scope: ['email', 'profile'],
      proxy: true,
    });
  }

  /** Forward PKCE S256 challenge parameters attached by GoogleAuthGuard. */
  authorizationParams(options: Record<string, any>): Record<string, string> {
    const params: Record<string, string> = {};
    if (options?.code_challenge) params.code_challenge = String(options.code_challenge);
    if (options?.code_challenge_method) params.code_challenge_method = String(options.code_challenge_method);
    return params;
  }

  /** Forward PKCE code_verifier attached by GoogleAuthGuard after browser-bound state verification. */
  tokenParams(options: Record<string, any>): Record<string, string> {
    const params: Record<string, string> = {};
    if (options?.code_verifier) params.code_verifier = String(options.code_verifier);
    return params;
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const { name, emails } = profile || {};
    const primaryEmail = emails?.[0];
    const email = typeof primaryEmail?.value === 'string' ? primaryEmail.value.trim() : '';
    const googleSub = String(profile?.id || profile?._json?.sub || '').trim();
    const emailVerified =
      primaryEmail?.verified === true ||
      primaryEmail?.verified === 'true' ||
      profile?._json?.email_verified === true ||
      profile?._json?.email_verified === 'true';

    if (!googleSub) {
      throw new UnauthorizedException('Google account did not provide a stable subject identifier');
    }

    if (!email) {
      throw new UnauthorizedException('No email address returned from Google account');
    }

    if (!emailVerified) {
      throw new UnauthorizedException('Google account email must be verified before signing in');
    }

    const firstName = name?.givenName;
    const lastName = name?.familyName;

    const user = await this.authService.validateGoogleUser({
      email,
      googleSub,
      emailVerified: true,
      firstName,
      lastName,
    });

    return user;
  }
}

