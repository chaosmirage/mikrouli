import { ModuleMetadata } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { ProviderAccount } from './provider-account.entity';

const DUPLICATE_EMAIL_ERROR = { code: '23505' };

// Existing user used across tests
const existingUser: User = {
  id: 'user-uuid-existing',
  email: 'existing@example.com',
  passwordHash: '$2b$10$somehash',
  monthlyLinkLimit: null,
  monthlyKeyLimit: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// Mock user repository
const mockUserRepository = () => ({
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// Mock provider-account repository
const mockProviderAccountRepository = () => ({
  findOneBy: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
});

// Build a mock EntityManager that records insertions
function buildMockManager(overrides: {
  providerAccountFindOne?: jest.Mock;
  userFindOne?: jest.Mock;
  userInsert?: jest.Mock;
  providerInsert?: jest.Mock;
  userFindOneOrFail?: jest.Mock;
  providerFindOneOrFail?: jest.Mock;
}): EntityManager {
  return {
    findOneBy: overrides.userFindOne ?? jest.fn().mockResolvedValue(null),
    findOne: overrides.providerAccountFindOne ?? jest.fn().mockResolvedValue(null),
    insert: overrides.userInsert ?? jest.fn().mockResolvedValue({}),
    save: overrides.providerInsert ?? jest.fn().mockResolvedValue({}),
    findOneOrFail: overrides.userFindOneOrFail ?? jest.fn().mockResolvedValue(existingUser),
    getRepository: jest.fn(),
  } as unknown as EntityManager;
}

// Mock DataSource whose transaction() immediately calls the callback with a manager
function buildMockDataSource(
  managerFactory: () => EntityManager,
  transactionImpl?: (fn: (em: EntityManager) => Promise<User>) => Promise<User>,
): object {
  return {
    transaction: transactionImpl
      ? transactionImpl
      : jest.fn((fn: (em: EntityManager) => Promise<User>) => fn(managerFactory())),
  };
}

const moduleMetadata = (datasource: object): ModuleMetadata => ({
  providers: [
    UsersService,
    { provide: getRepositoryToken(User), useFactory: mockUserRepository },
    { provide: getRepositoryToken(ProviderAccount), useFactory: mockProviderAccountRepository },
    { provide: getDataSourceToken(), useValue: datasource },
  ],
});

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const ds = buildMockDataSource(() => buildMockManager({}));
    const moduleRef: TestingModule = await Test.createTestingModule(moduleMetadata(ds)).compile();
    service = moduleRef.get<UsersService>(UsersService);
    repo = moduleRef.get(getRepositoryToken(User));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Existing credential-path tests (regression)

  it('create returns a user-shaped result on fresh email', async () => {
    const persisted: User = {
      id: 'uuid-fresh',
      email: 'new@example.com',
      passwordHash: 'hash',
      monthlyLinkLimit: null,
      monthlyKeyLimit: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };
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
    expect(result).toBeDefined();
    expect(result.email).toBe('dup@example.com');
    expect(typeof result.id).toBe('string');
    expect(result.id.length).toBeGreaterThan(0);
    expect(result.createdAt).toBeInstanceOf(Date);
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

  // Returning GitHub user: matched by existing provider_accounts row

  it('findOrCreateFromProvider returns existing user when provider identity is already linked', async () => {
    const existingProviderAccount: ProviderAccount = {
      id: 'pa-uuid-1',
      provider: 'github',
      providerUserId: 'github-id-123',
      userId: existingUser.id,
      user: existingUser,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    };

    const mockManager = buildMockManager({
      // provider hit → branch 1
      providerAccountFindOne: jest.fn().mockResolvedValue(existingProviderAccount),
      userFindOneOrFail: jest.fn().mockResolvedValue(existingUser),
    });
    const ds = buildMockDataSource(() => mockManager);
    const moduleRef = await Test.createTestingModule(moduleMetadata(ds)).compile();
    const svc = moduleRef.get<UsersService>(UsersService);

    const result = await svc.findOrCreateFromProvider({
      provider: 'github',
      providerUserId: 'github-id-123',
      email: existingUser.email,
    });

    expect(result.id).toBe(existingUser.id);
    // Branch 1: no new rows inserted
    expect(mockManager.insert).not.toHaveBeenCalled();
  });

  // Link to an existing account by verified email

  it('findOrCreateFromProvider links a provider account to an existing user when email matches', async () => {
    const mockSave = jest.fn().mockResolvedValue({});

    const mockManager = buildMockManager({
      // no provider hit → miss
      providerAccountFindOne: jest.fn().mockResolvedValue(null),
      // email hits an existing user → branch 2
      userFindOne: jest.fn().mockResolvedValue(existingUser),
      providerInsert: mockSave,
      userFindOneOrFail: jest.fn().mockResolvedValue(existingUser),
    });
    const ds = buildMockDataSource(() => mockManager);
    const moduleRef = await Test.createTestingModule(moduleMetadata(ds)).compile();
    const svc = moduleRef.get<UsersService>(UsersService);

    const result = await svc.findOrCreateFromProvider({
      provider: 'github',
      providerUserId: 'github-id-new',
      email: existingUser.email,
    });

    expect(result.id).toBe(existingUser.id);
    // Branch 2: saved a provider_accounts link but no new users row
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  // First-time sign-up creates a user plus a provider_accounts row

  it('findOrCreateFromProvider creates a new user with passwordHash null and links provider account', async () => {
    const newUser: User = {
      id: 'user-uuid-new',
      email: 'newgithub@example.com',
      passwordHash: null,
      monthlyLinkLimit: null,
      monthlyKeyLimit: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const mockUserInsert = jest.fn().mockResolvedValue({});
    const mockProviderSave = jest.fn().mockResolvedValue({});
    const mockFindOneOrFail = jest.fn().mockResolvedValue(newUser);

    const mockManager = buildMockManager({
      providerAccountFindOne: jest.fn().mockResolvedValue(null),
      userFindOne: jest.fn().mockResolvedValue(null),
      userInsert: mockUserInsert,
      providerInsert: mockProviderSave,
      userFindOneOrFail: mockFindOneOrFail,
    });
    const ds = buildMockDataSource(() => mockManager);
    const moduleRef = await Test.createTestingModule(moduleMetadata(ds)).compile();
    const svc = moduleRef.get<UsersService>(UsersService);

    const result = await svc.findOrCreateFromProvider({
      provider: 'github',
      providerUserId: 'github-id-brand-new',
      email: 'newgithub@example.com',
    });

    // New user has null passwordHash
    expect(result.passwordHash).toBeNull();
    // insert was called for both user and provider account
    expect(mockUserInsert).toHaveBeenCalledTimes(1);
    expect(mockProviderSave).toHaveBeenCalledTimes(1);
  });
});
