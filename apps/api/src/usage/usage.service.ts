import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, And, MoreThanOrEqual, LessThan } from 'typeorm';
import { Link } from '../links/entities/link.entity';
import { ApiKey } from '../api-keys/api-key.entity';
import { User } from '../users/user.entity';
import { GLOBAL_LINK_LIMIT, GLOBAL_KEY_LIMIT, RETENTION_MS } from '../common/constants';
import type { UsageSummaryResponse } from '../types/openapi';

function getMonthBounds(): { monthStart: Date; nextMonthStart: Date } {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { monthStart, nextMonthStart };
}

type UserWithLimits = Pick<User, 'monthlyLinkLimit' | 'monthlyKeyLimit'>;

@Injectable()
export class UsageService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
  ) {}

  resolveLinkLimit(user: UserWithLimits): number {
    return user.monthlyLinkLimit ?? GLOBAL_LINK_LIMIT;
  }

  resolveKeyLimit(user: UserWithLimits): number {
    return user.monthlyKeyLimit ?? GLOBAL_KEY_LIMIT;
  }

  async countLinksThisMonth(userId: string): Promise<number> {
    const { monthStart, nextMonthStart } = getMonthBounds();
    return this.dataSource.manager.count(Link, {
      where: {
        userId,
        createdAt: And(MoreThanOrEqual(monthStart), LessThan(nextMonthStart)),
      },
    });
  }

  async countKeysThisMonth(userId: string): Promise<number> {
    const { monthStart, nextMonthStart } = getMonthBounds();
    return this.dataSource.getRepository(ApiKey).count({
      where: {
        userId,
        createdAt: And(MoreThanOrEqual(monthStart), LessThan(nextMonthStart)),
      },
    });
  }

  async getLinkLimit(userId: string): Promise<number> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return this.resolveLinkLimit(user);
  }

  async getKeyLimit(userId: string): Promise<number> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    return this.resolveKeyLimit(user);
  }

  async getSummary(userId: string): Promise<UsageSummaryResponse> {
    const user = await this.userRepo.findOneOrFail({ where: { id: userId } });
    const linkLimit = this.resolveLinkLimit(user);
    const keyLimit = this.resolveKeyLimit(user);

    const [linksCreated, keysCreated] = await Promise.all([
      this.countLinksThisMonth(userId),
      this.countKeysThisMonth(userId),
    ]);

    const linksRemaining = Math.max(0, linkLimit - linksCreated);
    const keysRemaining = Math.max(0, keyLimit - keysCreated);

    const now = new Date();
    const resetDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    ).toISOString();

    return {
      linksCreated,
      linkLimit,
      linksRemaining,
      keysCreated,
      keyLimit,
      keysRemaining,
      resetDate,
      retentionMs: RETENTION_MS,
    };
  }
}
