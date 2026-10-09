import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

import { PrismaService } from '../../database/prisma.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { validateUser: jest.Mock; login: jest.Mock; register: jest.Mock; revokeAllSessions: jest.Mock };
  let users: { findById: jest.Mock };

  beforeEach(async () => {
    auth = {
      validateUser: jest.fn(),
      login: jest.fn().mockResolvedValue({ access_token: 'token' }),
      register: jest.fn().mockResolvedValue({ access_token: 'token' }),
      revokeAllSessions: jest.fn().mockResolvedValue(undefined),
    };

    users = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UsersService, useValue: users },
        { provide: PrismaService, useValue: {} },
      ],
    }).compile();
    controller = module.get(AuthController);
  });

  it('returns the current CSRF token and refreshes its cookie lifetime', () => {
    const res = { cookie: jest.fn() } as any;
    const token = 'a'.repeat(48);
    expect(controller.csrf({ cookies: { csrf_token: token } } as any, res)).toEqual({
      csrf_token: token,
    });
    expect(res.cookie).toHaveBeenCalledWith(
      'csrf_token',
      token,
      expect.objectContaining({ httpOnly: false, path: '/', maxAge: 15 * 60 * 1000 }),
    );
  });

  it('issues a CSRF token when the cookie has expired', () => {
    const res = { cookie: jest.fn() } as any;
    const result = controller.csrf({ cookies: {} } as any, res);
    expect(result.csrf_token).toMatch(/^[a-f0-9]{48}$/);
    expect(res.cookie).toHaveBeenCalledWith(
      'csrf_token',
      result.csrf_token,
      expect.objectContaining({ httpOnly: false, path: '/', maxAge: 15 * 60 * 1000 }),
    );
  });

  it('issues a token for valid credentials', async () => {
    auth.validateUser.mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    await expect(controller.login({ email: 'a@b.com', password: 'x' })).resolves.toEqual({
      access_token: 'token',
    });
  });

  it('rejects invalid credentials with 401', async () => {
    auth.validateUser.mockResolvedValue(null);
    await expect(controller.login({ email: 'a@b.com', password: 'bad' })).rejects.toThrow(
      UnauthorizedException,
    );
    expect(auth.login).not.toHaveBeenCalled();
  });

  it('delegates registration to the service', async () => {
    const body = { email: 'a@b.com', password: 'x' };
    await controller.register(body);
    expect(auth.register).toHaveBeenCalledWith(body);
  });

  it('returns current user profile on getMe', async () => {
    users.findById.mockResolvedValue({
      id: 'u1',
      email: 'a@b.com',
      passwordHash: 'secret',
      firstName: 'Jane',
      lastName: 'Doe',
    });

    const result = await controller.getMe({ user: { userId: 'u1' } });
    expect(result).toEqual({
      id: 'u1',
      email: 'a@b.com',
      firstName: 'Jane',
      lastName: 'Doe',
    });
    expect((result as any).passwordHash).toBeUndefined();
  });

  it('returns success on logout and revokes only the presented session by default', async () => {
    (auth as any).revokeSessionForToken = jest.fn().mockResolvedValue('u1');
    const result = await controller.logout({ cookies: { refresh_token: 'rt' } } as any, undefined);
    expect((auth as any).revokeSessionForToken).toHaveBeenCalledWith('rt', false);
    expect(result).toEqual({ success: true, message: 'Logged out successfully' });
  });

  it('logs out successfully even with no cookies at all', async () => {
    (auth as any).revokeSessionForToken = jest.fn().mockResolvedValue(null);
    const result = await controller.logout({ cookies: {} } as any, undefined);
    expect(result.success).toBe(true);
  });

  it('can end every session on request', async () => {
    (auth as any).revokeSessionForToken = jest.fn().mockResolvedValue('u1');
    await controller.logout({ cookies: { refresh_token: 'rt' } } as any, { all: true });
    expect((auth as any).revokeSessionForToken).toHaveBeenCalledWith('rt', true);
  });

  it('does not repeat tokens in the body for cookie-mode browsers', async () => {
    (auth as any).login = jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 900 });
    (auth as any).validateUser = jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const body = await controller.login(
      { email: 'a@b.com', password: 'pw' } as any,
      undefined,
      { headers: { 'x-auth-mode': 'cookie' } } as any,
    );
    expect(body).toEqual({ success: true, expires_in: 900 });
  });

  it('still returns tokens to non-browser clients', async () => {
    (auth as any).login = jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r', expires_in: 900 });
    (auth as any).validateUser = jest.fn().mockResolvedValue({ id: 'u1', email: 'a@b.com' });
    const body: any = await controller.login({ email: 'a@b.com', password: 'pw' } as any, undefined, { headers: {} } as any);
    expect(body.access_token).toBe('a');
  });
});
