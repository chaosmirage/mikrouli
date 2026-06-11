import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { User } from './user.entity';

const POSTGRES_UNIQUE_VIOLATION = '23505';

interface CreateUserParams {
  email: string;
  passwordHash: string;
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
  decoy.createdAt = new Date();
  decoy.updatedAt = decoy.createdAt;
  decoy.passwordHash = '';
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

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
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
}
