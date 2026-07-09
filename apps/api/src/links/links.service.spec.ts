import {
  ConflictException,
  ForbiddenException,
  ModuleMetadata,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource, QueryFailedError } from 'typeorm';
import { LinksService } from './links.service';
import { SlugGeneratorService } from './slug-generator.service';
import { Link } from './entities/link.entity';
import { UsageService } from '../usage/usage.service';
import { MonthlyLinkLimitExceededError } from '../usage/usage.errors';

const TEST_USER_ID = 'user-uuid-test';
const TEST_SLUG = 'abc123';
const TEST_URL = 'https://example.com/long-path';
const POSTGRES_UNIQUE_CODE = '23505';

const mockManager = {
  find: jest.fn(),
  findOne: jest.fn(),
  findOneOrFail: jest.fn(),
  insert: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  update: jest.fn(),
};

const mockDataSource = {
  manager: mockManager,
  transaction: jest.fn(),
};

const mockSlugGenerator = { generate: jest.fn() };

const mockUsageService = {
  countLinksThisMonth: jest.fn().mockResolvedValue(0),
  getLinkLimit: jest.fn().mockResolvedValue(100),
};

const moduleMetadata: ModuleMetadata = {
  providers: [
    LinksService,
    { provide: DataSource, useValue: mockDataSource },
    { provide: SlugGeneratorService, useValue: mockSlugGenerator },
    { provide: UsageService, useValue: mockUsageService },
  ],
};

function makeLink(overrides: Partial<Link> = {}): Link {
  return {
    shortUrl: TEST_SLUG,
    originalUrl: TEST_URL,
    userId: TEST_USER_ID,
    createdAt: new Date(),
    expiresAt: null,
    user: undefined as never,
    ...overrides,
  };
}

function makeUniqueViolationError(): Error {
  const err = Object.assign(new Error('duplicate key'), { code: POSTGRES_UNIQUE_CODE });
  Object.setPrototypeOf(err, QueryFailedError.prototype);
  return err;
}

describe('LinksService', () => {
  let service: LinksService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockSlugGenerator.generate.mockReturnValue(TEST_SLUG);
    mockUsageService.countLinksThisMonth.mockResolvedValue(0);
    mockUsageService.getLinkLimit.mockResolvedValue(100);
    mockDataSource.transaction.mockImplementation((cb: (m: typeof mockManager) => Promise<Link>) =>
      cb(mockManager),
    );
    mockManager.findOneOrFail.mockResolvedValue(makeLink());
    const module: TestingModule = await Test.createTestingModule(moduleMetadata).compile();
    service = module.get<LinksService>(LinksService);
  });

  it('create() inserts link and writes outbox entry in one transaction', async () => {
    const link = await service.create(TEST_URL, TEST_USER_ID);
    expect(mockManager.insert).toHaveBeenCalledWith(
      Link,
      expect.objectContaining({ shortUrl: TEST_SLUG, originalUrl: TEST_URL }),
    );
    expect(mockManager.save).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ aggregateType: 'link_created' }),
    );
    expect(link.shortUrl).toBe(TEST_SLUG);
  });

  it('create() retries on slug collision', async () => {
    const tx = mockDataSource.transaction;
    tx.mockRejectedValueOnce(makeUniqueViolationError());
    tx.mockImplementation((cb: (m: typeof mockManager) => Promise<Link>) => cb(mockManager));
    const link = await service.create(TEST_URL, TEST_USER_ID);
    expect(tx).toHaveBeenCalledTimes(2);
    expect(link.shortUrl).toBe(TEST_SLUG);
  });

  it('create() throws ConflictException after max retries exhausted', async () => {
    mockDataSource.transaction.mockRejectedValue(makeUniqueViolationError());
    await expect(service.create(TEST_URL, TEST_USER_ID)).rejects.toThrow(ConflictException);
  });

  it('create() rethrows non-unique errors immediately', async () => {
    mockDataSource.transaction.mockRejectedValue(new Error('connection refused'));
    await expect(service.create(TEST_URL, TEST_USER_ID)).rejects.toThrow('connection refused');
  });

  it('listForUser() returns links ordered by createdAt DESC', async () => {
    const links = [makeLink()];
    mockDataSource.manager.find.mockResolvedValue(links);
    const result = await service.listForUser(TEST_USER_ID);
    expect(mockDataSource.manager.find).toHaveBeenCalledWith(
      Link,
      expect.objectContaining({ where: { userId: TEST_USER_ID } }),
    );
    expect(result).toBe(links);
  });

  it('delete() throws NotFoundException when slug does not exist', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(null);
    await expect(service.delete(TEST_SLUG, TEST_USER_ID)).rejects.toThrow(NotFoundException);
  });

  it('delete() throws ForbiddenException when userId does not match', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(makeLink({ userId: 'other-user' }));
    await expect(service.delete(TEST_SLUG, TEST_USER_ID)).rejects.toThrow(ForbiddenException);
  });

  it('delete() removes link when ownership is verified', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(makeLink());
    mockDataSource.manager.delete.mockResolvedValue({ affected: 1 });
    await service.delete(TEST_SLUG, TEST_USER_ID);
    expect(mockDataSource.manager.delete).toHaveBeenCalledWith(Link, { shortUrl: TEST_SLUG });
  });

  it('create() rejects with MonthlyLinkLimitExceededError when monthly limit is reached', async () => {
    mockUsageService.countLinksThisMonth.mockResolvedValue(100);
    mockUsageService.getLinkLimit.mockResolvedValue(100);
    await expect(service.create(TEST_URL, TEST_USER_ID)).rejects.toThrow(
      MonthlyLinkLimitExceededError,
    );
    expect(mockDataSource.transaction).not.toHaveBeenCalled();
  });

  const NEW_URL = 'https://example.com/new-destination';

  it('updateDestination() throws NotFoundException when slug does not exist', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(null);
    await expect(service.updateDestination(TEST_SLUG, TEST_USER_ID, NEW_URL)).rejects.toThrow(
      NotFoundException,
    );
    expect(mockDataSource.manager.update).not.toHaveBeenCalled();
  });

  it('updateDestination() throws ForbiddenException when caller is not the owner', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(makeLink({ userId: 'other-user' }));
    await expect(service.updateDestination(TEST_SLUG, TEST_USER_ID, NEW_URL)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockDataSource.manager.update).not.toHaveBeenCalled();
  });

  it('updateDestination() persists the new originalUrl scoped by slug and owner', async () => {
    mockDataSource.manager.findOne.mockResolvedValue(makeLink());
    mockDataSource.manager.update.mockResolvedValue({ affected: 1 });
    const result = await service.updateDestination(TEST_SLUG, TEST_USER_ID, NEW_URL);
    expect(mockDataSource.manager.update).toHaveBeenCalledWith(
      Link,
      { shortUrl: TEST_SLUG, userId: TEST_USER_ID },
      { originalUrl: NEW_URL },
    );
    expect(result.originalUrl).toBe(NEW_URL);
    expect(result.shortUrl).toBe(TEST_SLUG);
  });
});
