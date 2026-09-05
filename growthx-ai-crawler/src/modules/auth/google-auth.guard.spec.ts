import { ExecutionContext, ServiceUnavailableException } from '@nestjs/common';
import { GoogleAuthGuard } from './google-auth.guard';
import { googleSignInConfigured } from './google.strategy';

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

    it('reports an unconfigured deployment rather than failing as a server error', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      expect(() => new GoogleAuthGuard().canActivate(context)).toThrow(
        ServiceUnavailableException,
      );
    });

    it('names both variables and the alternative sign-in', () => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;

      try {
        new GoogleAuthGuard().canActivate(context);
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
      await expect(
        Promise.resolve(new GoogleAuthGuard().canActivate(context)),
      ).rejects.not.toBeInstanceOf(ServiceUnavailableException);
    });
  });
});
