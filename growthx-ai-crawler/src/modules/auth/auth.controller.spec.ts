import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { validateUser: jest.Mock; login: jest.Mock; register: jest.Mock };
  let users: { findById: jest.Mock };

  beforeEach(async () => {
    auth = {
      validateUser: jest.fn(),
      login: jest.fn().mockResolvedValue({ access_token: 'token' }),
      register: jest.fn().mockResolvedValue({ access_token: 'token' }),
    };

    users = {
      findById: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: auth },
        { provide: UsersService, useValue: users },
      ],
    }).compile();
    controller = module.get(AuthController);
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

  it('returns success on logout', async () => {
    const result = await controller.logout();
    expect(result).toEqual({ success: true, message: 'Logged out successfully' });
  });
});
