import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
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

async function saveOrThrowConflict(repo: Repository<User>, user: User): Promise<User> {
  try {
    return await repo.save(user);
  } catch (err: unknown) {
    throw isDuplicateEmailError(err) ? new ConflictException('Email already registered') : err;
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
    return saveOrThrowConflict(this.usersRepository, user);
  }
}
