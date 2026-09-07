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
    // Only registered when `googleSignInConfigured()` holds, so these are set.
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID') as string,
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET') as string,
      callbackURL: configService.get<string>('GOOGLE_CALLBACK_URL') || '/auth/google/callback',
      scope: ['email', 'profile'],
      proxy: true,
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
  ): Promise<any> {
    const { name, emails } = profile || {};
    const email = emails?.[0]?.value;

    if (!email) {
      throw new UnauthorizedException('No email address returned from Google account');
    }

    const firstName = name?.givenName;
    const lastName = name?.familyName;

    const user = await this.authService.validateGoogleUser({
      email,
      firstName,
      lastName,
    });

    return user;
  }
}

