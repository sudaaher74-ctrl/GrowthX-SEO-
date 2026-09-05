import { ExecutionContext, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { googleSignInConfigured } from './google.strategy';

/**
 * Guards the two Google sign-in routes.
 *
 * `AuthGuard('google')` resolves the strategy by name at request time, so on a
 * deployment that never registered it the caller gets "Unknown authentication
 * strategy" as a 500. A deployment without Google credentials is a
 * configuration choice rather than a server fault, so it answers 503 and names
 * the variables to set — and the working alternative.
 */
@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {
  canActivate(context: ExecutionContext) {
    if (!googleSignInConfigured()) {
      throw new ServiceUnavailableException(
        'Google sign-in is not configured on this deployment. Set GOOGLE_CLIENT_ID and ' +
          'GOOGLE_CLIENT_SECRET to enable it, or sign in with email and password.',
      );
    }
    return super.canActivate(context);
  }
}
