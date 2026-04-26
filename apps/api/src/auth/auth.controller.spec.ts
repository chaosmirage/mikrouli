import { UnauthorizedException } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';

const mockAuthService = {
  register: jest.fn(),
  validateCredentials: jest.fn(),
  issueTokens: jest.fn(),
  rotateRefresh: jest.fn(),
};

const mockUsersService = {
  findByEmail: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const authServiceProvider = { provide: AuthService, useValue: mockAuthService };
const usersServiceProvider = { provide: UsersService, useValue: mockUsersService };

const moduleMetadata: ModuleMetadata = {
  controllers: [AuthController],
  providers: [authServiceProvider, usersServiceProvider],
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    controller = moduleRef.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('POST /register returns id+email+createdAt without passwordHash', async () => {
    const createdAt = new Date('2024-01-01T00:00:00.000Z');
    const publicUser = { id: 'uuid-1', email: 'test@example.com', createdAt };
    mockAuthService.register.mockResolvedValue(publicUser);
    const result = await controller.register({ email: 'test@example.com', password: 'Password1' });
    expect(result).toEqual({
      id: 'uuid-1',
      email: 'test@example.com',
      createdAt: createdAt.toISOString(),
    });
    expect(result).not.toHaveProperty('passwordHash');
  });

  it('POST /login throws 401 on invalid credentials', async () => {
    mockAuthService.validateCredentials.mockResolvedValue(null);
    const loginCall = controller.login({ email: 'test@example.com', password: 'wrong' });
    await expect(loginCall).rejects.toThrow(UnauthorizedException);
  });
});
