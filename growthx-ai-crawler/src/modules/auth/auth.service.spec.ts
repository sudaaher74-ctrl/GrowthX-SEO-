import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';
import { OrganizationsService } from '../organizations/organizations.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: any;
  let jwt: { sign: jest.Mock; verify: jest.Mock };

  beforeEach(async () => {
    users = { findByEmail: jest.fn(), createUser: jest.fn(), findById: jest.fn() };
    jwt = {
      // Distinguishes the two tokens so a test can tell them apart; the real
      // difference is the `type` claim and the expiry, asserted below.
      sign: jest.fn((payload: any) => (payload?.type === 'refresh' ? 'signed.refresh.token' : 'signed.jwt.token')),
      verify: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        // AuthService creates a default organization on registration.
        { provide: OrganizationsService, useValue: { createOrganization: jest.fn().mockResolvedValue({ id: 'org_1' }) } },
        { provide: UsersService, useValue: users },
        { provide: JwtService, useValue: jwt },
      ],
    }).compile();
    service = module.get(AuthService);
  });

  describe('validateUser', () => {
    it('returns the user without the password hash on a correct password', async () => {
      const passwordHash = await bcrypt.hash('correct-horse', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@b.com', passwordHash });

      const result = await service.validateUser('a@b.com', 'correct-horse');

      expect(result).toMatchObject({ id: 'u1', email: 'a@b.com' });
      // The hash must never leave this method.
      expect(result).not.toHaveProperty('passwordHash');
    });

    it('returns null on a wrong password', async () => {
      const passwordHash = await bcrypt.hash('correct-horse', 10);
      users.findByEmail.mockResolvedValue({ id: 'u1', passwordHash });

      await expect(service.validateUser('a@b.com', 'wrong')).resolves.toBeNull();
    });

    it('returns null for an unknown email', async () => {
      users.findByEmail.mockResolvedValue(null);
      await expect(service.validateUser('nobody@b.com', 'x')).resolves.toBeNull();
    });
  });

  describe('login', () => {
    it('signs a token carrying the user id and email', async () => {
      const result = await service.login({ id: 'u1', email: 'a@b.com' });

      expect(jwt.sign).toHaveBeenCalledWith({ email: 'a@b.com', sub: 'u1' });
      expect(result).toEqual(
        expect.objectContaining({ access_token: 'signed.jwt.token', refresh_token: 'signed.refresh.token' }),
      );
    });
  });

  describe('register', () => {
    it('rejects an email that is already taken', async () => {
      users.findByEmail.mockResolvedValue({ id: 'existing' });
      await expect(service.register({ email: 'a@b.com', password: 'x' })).rejects.toThrow(BadRequestException);
      expect(users.createUser).not.toHaveBeenCalled();
    });

    it('stores a hash, never the plaintext password', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await service.register({ email: 'a@b.com', password: 'plaintext-secret' });

      const stored = users.createUser.mock.calls[0][0];
      expect(stored.passwordHash).toBeDefined();
      expect(stored.passwordHash).not.toBe('plaintext-secret');
      expect(stored).not.toHaveProperty('password');
      await expect(bcrypt.compare('plaintext-secret', stored.passwordHash)).resolves.toBe(true);
    });

    it('returns a token so the user is signed in immediately', async () => {
      users.findByEmail.mockResolvedValue(null);
      users.createUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      await expect(service.register({ email: 'a@b.com', password: 'x' })).resolves.toEqual(
        expect.objectContaining({ access_token: 'signed.jwt.token', refresh_token: 'signed.refresh.token' }),
      );
    });
  });

  describe('refresh tokens', () => {
    it('issues a refresh token alongside the access token', async () => {
      const result = await service.login({ id: 'u1', email: 'a@b.com' });

      expect(result.access_token).toBe('signed.jwt.token');
      expect(result.refresh_token).toBe('signed.refresh.token');
      // The refresh token carries a longer expiry than the access token.
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'refresh' }),
        expect.objectContaining({ expiresIn: expect.any(String) }),
      );
    });

    it('exchanges a valid refresh token for a new pair', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1', email: 'a@b.com', type: 'refresh' });
      users.findById.mockResolvedValue({ id: 'u1', email: 'a@b.com' });

      const result = await service.refresh('good.refresh.token');

      expect(result.access_token).toBeDefined();
      expect(users.findById).toHaveBeenCalledWith('u1');
    });

    // Otherwise a short access expiry would be pointless: the long-lived token
    // could simply be presented in its place.
    it('refuses an access token presented as a refresh token', async () => {
      jwt.verify.mockReturnValue({ sub: 'u1', email: 'a@b.com' });

      await expect(service.refresh('an.access.token')).rejects.toThrow(UnauthorizedException);
    });

    it('refuses an expired or tampered refresh token', async () => {
      jwt.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.refresh('bad.token')).rejects.toThrow(UnauthorizedException);
    });

    // A month-long token must not outlive the account it belongs to.
    it('refuses to refresh for a user that no longer exists', async () => {
      jwt.verify.mockReturnValue({ sub: 'gone', email: 'a@b.com', type: 'refresh' });
      users.findById.mockResolvedValue(null);

      await expect(service.refresh('good.refresh.token')).rejects.toThrow(UnauthorizedException);
    });
  });
});