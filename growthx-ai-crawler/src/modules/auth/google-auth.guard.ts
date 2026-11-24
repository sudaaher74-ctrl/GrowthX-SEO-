import {
  ExecutionContext,
  Injectable,
  Optional,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { googleSignInConfigured } from './google.strategy';
import { OAuthTransactionService } from '../security/oauth-transaction.service';

export const GOOGLE_SIGNIN_NONCE_COOKIE = 'oauth_google_signin_nonce';
const GOOGLE_SIGNIN_PROVIDER = 'google_signin';
const GOOGLE_SIGNIN_PURPOSE = 'signin';
const GOOGLE_SIGNIN_TTL_MS = 10 * 60 * 1000;

function oauthCookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = process.env.COOKIE_SECURE ? process.env.COOKIE_SECURE === 'true' : isProduction;
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    path: '/auth/google',
  };
}

/**
 * Guards the two Google sign-in routes and enforces expiring, single-use,
 * browser-bound OAuth state + PKCE (S256) transactions:
 *
 * - Initiation (`GET /auth/google`): creates a server-side `OAuthTransaction`,
 *   binds it to an `HttpOnly; SameSite=Lax` browser nonce cookie, and sends
 *   `state` + `code_challenge` (S256) to Google.
 * - Callback (`GET /auth/google/callback`): validates and atomically consumes
 *   the transaction matching both `query.state` and the browser nonce cookie
 *   BEFORE Passport exchanges `code` with Google, forwarding `code_verifier`.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  constructor(@Optional() private readonly oauthTransactions?: OAuthTransactionService) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (!googleSignInConfigured()) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this deployment. Set GOOGLE_CLIENT_ID and ' +
          'GOOGLE_CLIENT_SECRET to enable it, or sign in with email and password.',
      );
    }

    const req = context.switchToHttp().getRequest();
    const res = context.switchToHttp().getResponse();
    const urlPath = String(req?.url || '').split('?')[0];
    const isCallback =
      urlPath.endsWith('/callback') || Boolean(req?.query?.code) || Boolean(req?.query?.error);

    if (this.oauthTransactions) {
      if (isCallback) {
        if (req?.query?.error) {
          res?.clearCookie?.(GOOGLE_SIGNIN_NONCE_COOKIE, oauthCookieOptions());
          throw new UnauthorizedException('Google sign-in was cancelled or denied.');
        }

        const state = typeof req?.query?.state === 'string' ? req.query.state : undefined;
        const browserNonce =
          typeof req?.cookies?.[GOOGLE_SIGNIN_NONCE_COOKIE] === 'string'
            ? req.cookies[GOOGLE_SIGNIN_NONCE_COOKIE]
            : undefined;

        res?.clearCookie?.(GOOGLE_SIGNIN_NONCE_COOKIE, oauthCookieOptions());

        const consumed = await this.oauthTransactions.consumeTransaction({
          state,
          browserNonce,
          provider: GOOGLE_SIGNIN_PROVIDER,
          expectedPurpose: GOOGLE_SIGNIN_PURPOSE,
        });

        req._googleOAuthOptions = {
          ...(consumed.pkceVerifier ? { code_verifier: consumed.pkceVerifier } : {}),
        };
      } else {
        const tx = await this.oauthTransactions.createTransaction({
          provider: GOOGLE_SIGNIN_PROVIDER,
          purpose: GOOGLE_SIGNIN_PURPOSE,
          usePkce: true,
          ttlMs: GOOGLE_SIGNIN_TTL_MS,
        });

        res?.cookie?.(GOOGLE_SIGNIN_NONCE_COOKIE, tx.browserNonce, {
          ...oauthCookieOptions(),
          maxAge: GOOGLE_SIGNIN_TTL_MS,
        });

        req._googleOAuthOptions = {
          state: tx.state,
          ...(tx.codeChallenge
            ? {
                code_challenge: tx.codeChallenge,
                code_challenge_method: tx.codeChallengeMethod,
              }
            : {}),
        };
      }
    }

    return (await super.canActivate(context)) as boolean;
  }

  getAuthenticateOptions(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    return req?._googleOAuthOptions ?? {};
  }
}
