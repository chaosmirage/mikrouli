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

  it('create returns a user-shaped result on fresh email', async () => {
    const persisted = {
      id: 'uuid-fresh',
      email: 'new@example.com',
      passwordHash: 'hash',
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    } as User;
    repo.create.mockReturnValue(persisted);
    repo.save.mockResolvedValue(persisted);
    const result = await service.create({ email: 'new@example.com', passwordHash: 'hash' });
    expect(result.id).toBe('uuid-fresh');
    expect(result.email).toBe('new@example.com');
    expect(result.createdAt).toBeInstanceOf(Date);
  });

  it('create resolves with the same shape on duplicate email without persisting again', async () => {
    const partial = { email: 'dup@example.com', passwordHash: 'hash' } as User;
    repo.create.mockReturnValue(partial);
    repo.save.mockRejectedValue(DUPLICATE_EMAIL_ERROR);
    const result = await service.create({ email: 'dup@example.com', passwordHash: 'hash' });
    // Must resolve (not reject)
    expect(result).toBeDefined();
    // Must carry the submitted email
    expect(result.email).toBe('dup@example.com');
    // Must have an id (a new one, not the existing user's)
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    // Must have a createdAt date
    expect(result.createdAt).toBeInstanceOf(Date);
    // save was called exactly once (no retry / second persist)
    expect(repo.save).toHaveBeenCalledTimes(1);
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
