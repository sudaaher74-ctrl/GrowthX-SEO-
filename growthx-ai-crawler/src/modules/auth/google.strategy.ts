import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
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
      callbackURL: '/auth/google/callback',
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { name, emails } = profile;
    const email = emails[0].value;
    const firstName = name?.givenName;
    const lastName = name?.familyName;
    
    try {
      const user = await this.authService.validateGoogleUser({
        email,
        firstName,
        lastName,
      });
      done(null, user);
    } catch (err) {
      done(err, false);
    }
  }
}
