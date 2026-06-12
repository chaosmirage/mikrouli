import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryFailedError, Repository } from 'typeorm';
import { User } from './user.entity';
import { ProviderAccount } from './provider-account.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

interface CreateUserParams {
  email: string;
  passwordHash: string | null;
}

export interface ProviderIdentityParams {
  provider: 'github';
  providerUserId: string;
  email: string;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function isDuplicateEmailError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as Record<string, unknown>)['code'] === POSTGRES_UNIQUE_VIOLATION
  );
}

// Fabricate an unpersisted result indistinguishable in shape from a persisted
// one — callers receive id/email/createdAt without any account being created
// a second time and without exposing the existing account's data.
function buildDecoyUser(email: string): User {
  const decoy = new User();
  decoy.id = randomUUID();
  decoy.email = email;
  decoy.passwordHash = '';
  decoy.createdAt = new Date();
  decoy.updatedAt = decoy.createdAt;
  return decoy;
}

async function saveOrDecoy(repo: Repository<User>, user: User, email: string): Promise<User> {
  try {
    return await repo.save(user);
  } catch (err: unknown) {
    if (isDuplicateEmailError(err)) return buildDecoyUser(email);
    throw err;
  }
}

// Resolve the three ordered branches inside a transaction:
//   1. provider_accounts row exists → return its user (returning user)
//   2. users row matches email       → insert provider link, return user (link)
//   3. neither matches              → insert user + link, return user (create)
// Any 23505 violation means a concurrent request won the race; re-run once.
async function resolveProviderIdentity(
  manager: EntityManager,
  params: ProviderIdentityParams,
): Promise<User> {
  const { provider, providerUserId, email } = params;

  // Branch 1: returning user — provider identity already linked
  const existing = await manager.findOne(ProviderAccount, {
    where: { provider, providerUserId },
    relations: ['user'],
  });
  if (existing) {
    return manager.findOneOrFail(User, { where: { id: existing.userId } });
  }

  // Branch 2: existing account matched by verified email — link the provider
  const userByEmail = await manager.findOneBy(User, { email });
  if (userByEmail) {
    await manager.save(ProviderAccount, { provider, providerUserId, userId: userByEmail.id });
    return userByEmail;
  }

  // Branch 3: first-time sign-up — create account with null passwordHash and link
  await manager.insert(User, { email, passwordHash: null });
  const inserted = await manager.findOneOrFail(User, { where: { email } });
  await manager.save(ProviderAccount, { provider, providerUserId, userId: inserted.id });
  return inserted;
}

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(ProviderAccount)
    private readonly providerAccountRepository: Repository<ProviderAccount>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ email });
  }

  findById(id: string): Promise<User | null> {
    return this.usersRepository.findOneBy({ id });
  }

  async create(params: CreateUserParams): Promise<User> {
    const user = this.usersRepository.create(params);
    return saveOrDecoy(this.usersRepository, user, params.email);
  }

  // Transactional find-or-create-or-link for OAuth sign-in.
  // Runs the three-branch resolution in a single transaction; on a 23505 unique
  // violation (lost race) the whole resolution is retried exactly once so the
  // second pass lands deterministically in branch 1 or 2.
  async findOrCreateFromProvider(params: ProviderIdentityParams): Promise<User> {
    try {
      return await this.dataSource.transaction((manager) =>
        resolveProviderIdentity(manager, params),
      );
    } catch (err: unknown) {
      if (!isUniqueViolation(err)) throw err;
      // Retry once: a concurrent first-time flow created the row between our
      // miss and our insert; the second pass hits branch 1 or 2 deterministically.
      return this.dataSource.transaction((manager) => resolveProviderIdentity(manager, params));
    }
  }
}
