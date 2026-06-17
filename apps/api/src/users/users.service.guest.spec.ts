import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken, getDataSourceToken } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { User } from './user.entity';
import { ProviderAccount } from './provider-account.entity';
import { GUEST_SENTINEL_EMAIL } from '../common/constants';

const GUEST_USER_ID = 'guest-uuid-fixed';

function makeGuestUser(): User {
  return {
    id: GUEST_USER_ID,
    email: GUEST_SENTINEL_EMAIL,
    passwordHash: null,
    monthlyLinkLimit: null,
    monthlyKeyLimit: null,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };
}

describe('UsersService.getGuestUserId', () => {
  let service: UsersService;
  let userRepo: { findOneBy: jest.Mock };

  beforeEach(async () => {
    userRepo = { findOneBy: jest.fn() };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: userRepo },
        {
          provide: getRepositoryToken(ProviderAccount),
          useValue: { findOneBy: jest.fn() },
        },
        { provide: getDataSourceToken(), useValue: { transaction: jest.fn() } },
      ],
    }).compile();
    service = module.get<UsersService>(UsersService);
  });

  it('resolves the Guest row by sentinel email', async () => {
    userRepo.findOneBy.mockResolvedValue(makeGuestUser());
    const id = await service.getGuestUserId();
    expect(id).toBe(GUEST_USER_ID);
    expect(userRepo.findOneBy).toHaveBeenCalledWith({
      email: GUEST_SENTINEL_EMAIL,
    });
  });

  it('caches the uuid across calls so only the first call hits the repository', async () => {
    userRepo.findOneBy.mockResolvedValue(makeGuestUser());
    await service.getGuestUserId();
    await service.getGuestUserId();
    await service.getGuestUserId();
    expect(userRepo.findOneBy).toHaveBeenCalledTimes(1);
  });

  it('throws NotFoundException when the Guest row is missing', async () => {
    userRepo.findOneBy.mockResolvedValue(null);
    await expect(service.getGuestUserId()).rejects.toThrow(NotFoundException);
  });
});
