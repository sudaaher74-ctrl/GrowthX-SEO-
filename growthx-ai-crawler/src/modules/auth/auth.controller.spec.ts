import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let auth: { validateUser: jest.Mock; login: jest.Mock; register: jest.Mock };

  beforeEach(async () => {
    auth = {
      validateUser: jest.fn(),
      login: jest.fn().mockResolvedValue({ access_token: 'token' }),
      register: jest.fn().mockResolvedValue({ access_token: 'token' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: auth }],
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
});
