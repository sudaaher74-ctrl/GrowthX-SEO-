import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  let service: AuthService;
  let users: { findByEmail: jest.Mock; createUser: jest.Mock };
  let jwt: { sign: jest.Mock };

  beforeEach(async () => {
    users = { findByEmail: jest.fn(), createUser: jest.fn() };
    jwt = { sign: jest.fn().mockReturnValue('signed.jwt.token') };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
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
      expect(result).toEqual({ access_token: 'signed.jwt.token' });
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

      await expect(service.register({ email: 'a@b.com', password: 'x' })).resolves.toEqual({
        access_token: 'signed.jwt.token',
      });
    });
  });
});
