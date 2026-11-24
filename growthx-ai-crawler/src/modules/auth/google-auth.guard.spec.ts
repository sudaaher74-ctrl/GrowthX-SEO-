import { ExecutionContext, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { GOOGLE_SIGNIN_NONCE_COOKIE, GoogleAuthGuard } from './google-auth.guard';
import { googleSignInConfigured } from './google.strategy';
import { OAuthTransactionService } from '../security/oauth-transaction.service';

describe('Google sign-in configuration', () => {
  const saved = {
    id: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
  };

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = saved.id;
    process.env.GOOGLE_CLIENT_SECRET = saved.secret;
  });

  describe('googleSignInConfigured', () => {
    it('is false when neither credential is set', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      expect(googleSignInConfigured()).toBe(false);
    });

    it('is false when only one credential is set', () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      delete process.env.GOOGLE_CLIENT_SECRET;
      expect(googleSignInConfigured()).toBe(false);
    });

    // `.env.example` ships both of these blank, which is the case that used to
    // take the whole API down at boot.
    it('is false when the credentials are present but empty', () => {
      process.env.GOOGLE_CLIENT_ID = '';
      process.env.GOOGLE_CLIENT_SECRET = '   ';
      expect(googleSignInConfigured()).toBe(false);
    });

    it('is true once both credentials are set', () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      process.env.GOOGLE_CLIENT_SECRET = 'secret';
      expect(googleSignInConfigured()).toBe(true);
    });
  });

  describe('GoogleAuthGuard', () => {
    /** Enough of an ExecutionContext for passport to read a request from. */
    const httpContext = () =>
      ({
        switchToHttp: () => ({
          getRequest: () => ({ query: {}, headers: {}, url: '/auth/google' }),
          getResponse: () => ({}),
        }),
        getHandler: () => undefined,
        getClass: () => undefined,
        getType: () => 'http',
      }) as unknown as ExecutionContext;

    const context = httpContext();

    it('reports an unconfigured deployment rather than failing as a server error', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      await expect(new GoogleAuthGuard().canActivate(context)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('names both variables and the alternative sign-in', async () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      try {
        await new GoogleAuthGuard().canActivate(context);
        fail('expected the guard to reject an unconfigured deployment');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).toContain('GOOGLE_CLIENT_ID');
        expect(message).toContain('GOOGLE_CLIENT_SECRET');
        expect(message).toContain('email and password');
      }
    });

    it('defers to passport once Google is configured', async () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      process.env.GOOGLE_CLIENT_SECRET = 'secret';

      // Getting as far as passport's own strategy lookup is the assertion: the
      // guard did not short-circuit. Passport then fails on the unregistered
      // test strategy, which is not a ServiceUnavailableException.
      await expect(new GoogleAuthGuard().canActivate(context)).rejects.not.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('binds Google sign-in to an HttpOnly browser cookie and rejects mismatched or replayed callbacks before code exchange', async () => {
      process.env.GOOGLE_CLIENT_ID = 'id';
      process.env.GOOGLE_CLIENT_SECRET = 'secret';

      const rows: any[] = [];
      const matches = (row: any, where: any) =>
        Object.entries(where).every(([k, cond]: [string, any]) => {
          if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
            if ('gt' in cond) return row[k] > cond.gt;
          }
          return (row[k] ?? null) === cond;
        });
      const oauthTx = new OAuthTransactionService({
        oAuthTransaction: {
          create: jest.fn(async ({ data }: any) => {
            const row = { consumedAt: null, ...data };
            rows.push(row);
            return row;
          }),
          updateMany: jest.fn(async ({ where, data }: any) => {
            const hits = rows.filter((r) => matches(r, where));
            hits.forEach((r) => Object.assign(r, data));
            return { count: hits.length };
          }),
          findUnique: jest.fn(async ({ where }: any) => rows.find((r) => matches(r, where)) ?? null),
          deleteMany: jest.fn(async () => ({ count: 0 })),
        },
      } as any);

      const guard = new GoogleAuthGuard(oauthTx);
      const initReq: any = { url: '/auth/google', query: {}, headers: {}, cookies: {} };
      const initRes: any = { cookie: jest.fn(), clearCookie: jest.fn() };
      const initCtx = {
        switchToHttp: () => ({ getRequest: () => initReq, getResponse: () => initRes }),
        getHandler: () => undefined,
        getClass: () => undefined,
        getType: () => 'http',
      } as unknown as ExecutionContext;

      await expect(guard.canActivate(initCtx)).rejects.not.toBeInstanceOf(UnauthorizedException);
      expect(initRes.cookie).toHaveBeenCalledWith(
        GOOGLE_SIGNIN_NONCE_COOKIE,
        expect.any(String),
        expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
      );
      const issuedState = initReq._googleOAuthOptions.state;
      const issuedNonce = initRes.cookie.mock.calls[0][1];
      expect(initReq._googleOAuthOptions.code_challenge_method).toBe('S256');

      // Mismatched browser cookie must be rejected BEFORE passport exchanges the code.
      const badCbReq: any = {
        url: '/auth/google/callback?code=abc&state=' + issuedState,
        query: { code: 'abc', state: issuedState },
        headers: {},
        cookies: { [GOOGLE_SIGNIN_NONCE_COOKIE]: 'attacker-browser-nonce' },
      };
      const badCbRes: any = { clearCookie: jest.fn() };
      await expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => badCbReq, getResponse: () => badCbRes }),
          getHandler: () => undefined,
          getClass: () => undefined,
          getType: () => 'http',
        } as unknown as ExecutionContext),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      // Matching browser cookie consumes transaction once and forwards PKCE verifier.
      const goodCbReq: any = {
        url: '/auth/google/callback?code=abc&state=' + issuedState,
        query: { code: 'abc', state: issuedState },
        headers: {},
        cookies: { [GOOGLE_SIGNIN_NONCE_COOKIE]: issuedNonce },
      };
      const goodCbRes: any = { clearCookie: jest.fn() };
      // Proceeds past state verification into Passport (which fails only because strategy isn't registered in unit test).
      await expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => goodCbReq, getResponse: () => goodCbRes }),
          getHandler: () => undefined,
          getClass: () => undefined,
          getType: () => 'http',
        } as unknown as ExecutionContext),
      ).rejects.not.toBeInstanceOf(UnauthorizedException);
      expect(goodCbReq._googleOAuthOptions.code_verifier).toBeTruthy();

      // Replaying the same state + cookie must fail.
      await expect(
        guard.canActivate({
          switchToHttp: () => ({ getRequest: () => goodCbReq, getResponse: () => goodCbRes }),
          getHandler: () => undefined,
          getClass: () => undefined,
          getType: () => 'http',
        } as unknown as ExecutionContext),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
