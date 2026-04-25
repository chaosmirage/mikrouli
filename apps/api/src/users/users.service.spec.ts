import { ConflictException } from '@nestjs/common';
import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';

const DUPLICATE_EMAIL_ERROR = { code: '23505' };

const mockRepository = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

const moduleMetadata: ModuleMetadata = {
  providers: [UsersService, { provide: getRepositoryToken(User), useFactory: mockRepository }],
};

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = moduleRef.get<UsersService>(UsersService);
    repo = moduleRef.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('create throws ConflictException on duplicate email', async () => {
    const user = { email: 'test@example.com', passwordHash: 'hash' } as User;
    repo.create.mockReturnValue(user);
    repo.save.mockRejectedValue(DUPLICATE_EMAIL_ERROR);
    await expect(
      service.create({ email: 'test@example.com', passwordHash: 'hash' }),
    ).rejects.toThrow(ConflictException);
  });

  it('create propagates non-unique errors', async () => {
    const user = { email: 'test@example.com', passwordHash: 'hash' } as User;
    const dbError = new Error('connection lost');
    repo.create.mockReturnValue(user);
    repo.save.mockRejectedValue(dbError);
    await expect(
      service.create({ email: 'test@example.com', passwordHash: 'hash' }),
    ).rejects.toThrow('connection lost');
  });
});
