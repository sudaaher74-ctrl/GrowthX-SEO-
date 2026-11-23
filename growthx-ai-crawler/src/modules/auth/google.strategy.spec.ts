import { UnauthorizedException } from '@nestjs/common';
import { GoogleStrategy } from './google.strategy';

describe('GoogleStrategy', () => {
  const makeStrategy = () => {
    const authService = { validateGoogleUser: jest.fn().mockResolvedValue({ id: 'u1', email: 'alice@example.com' }) };
    const configService = {
      get: jest.fn((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'test-client-id';
        if (key === 'GOOGLE_CLIENT_SECRET') return 'test-client-secret';
        if (key === 'GOOGLE_CALLBACK_URL') return 'https://api.example.com/auth/google/callback';
        return undefined;
      }),
    };
    const strategy = new GoogleStrategy(configService as any, authService as any);
    return { strategy, authService };
  };

  it('rejects Google profiles whose email is unverified', async () => {
    const { strategy, authService } = makeStrategy();
    await expect(
      strategy.validate('acc', 'ref', {
        id: 'google-sub-123',
        emails: [{ value: 'alice@example.com', verified: false }],
        _json: { sub: 'google-sub-123', email_verified: false },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.validateGoogleUser).not.toHaveBeenCalled();
  });

  it('rejects Google profiles missing a stable provider subject', async () => {
    const { strategy, authService } = makeStrategy();
    await expect(
      strategy.validate('acc', 'ref', {
        id: '',
        emails: [{ value: 'alice@example.com', verified: true }],
        _json: { email_verified: true },
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(authService.validateGoogleUser).not.toHaveBeenCalled();
  });

  it('passes verified email and stable googleSub to AuthService', async () => {
    const { strategy, authService } = makeStrategy();
    await strategy.validate('acc', 'ref', {
      id: 'google-sub-999',
      emails: [{ value: 'alice@example.com', verified: true }],
      name: { givenName: 'Alice', familyName: 'Smith' },
      _json: { sub: 'google-sub-999', email_verified: true },
    });

    expect(authService.validateGoogleUser).toHaveBeenCalledWith({
      email: 'alice@example.com',
      googleSub: 'google-sub-999',
      emailVerified: true,
      firstName: 'Alice',
      lastName: 'Smith',
    });
  });
});
