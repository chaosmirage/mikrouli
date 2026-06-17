import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { Link } from './entities/link.entity';
import { Outbox } from '../outbox/entities/outbox.entity';
import { SlugGeneratorService } from './slug-generator.service';
import { RETENTION_MS } from '../common/constants';
import { UsageService } from '../usage/usage.service';
import { MonthlyLinkLimitExceededError } from '../usage/usage.errors';

const MAX_SLUG_RETRIES = 5;
const POSTGRES_UNIQUE_VIOLATION = '23505';

interface LinkFields {
  shortUrl: string;
  originalUrl: string;
  userId: string;
  expiresAt: Date;
}

function resolveExpiry(explicit?: Date): Date {
  if (explicit !== undefined) return explicit;
  return new Date(Date.now() + RETENTION_MS);
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error as QueryFailedError & { code?: string }).code === POSTGRES_UNIQUE_VIOLATION
  );
}

function buildOutbox(slug: string, originalUrl: string): Partial<Outbox> {
  return { aggregateType: 'link_created', payload: { slug, originalUrl } };
}

async function tryOnce(attempt: () => Promise<Link>): Promise<Link | null> {
  try {
    return await attempt();
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    return null;
  }
}

async function retryOnSlugConflict(attempt: () => Promise<Link>): Promise<Link> {
  for (let i = 0; i < MAX_SLUG_RETRIES; i++) {
    const link = await tryOnce(attempt);
    if (link) return link;
  }
  throw new ConflictException('failed to generate unique slug after retries');
}

@Injectable()
export class LinksService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly slugGenerator: SlugGeneratorService,
    private readonly usageService: UsageService,
  ) {}

  private async insertLinkWithOutbox(manager: EntityManager, fields: LinkFields): Promise<Link> {
    await manager.insert(Link, fields);
    await manager.save(Outbox, buildOutbox(fields.shortUrl, fields.originalUrl));
    return manager.findOneOrFail(Link, { where: { shortUrl: fields.shortUrl } });
  }

  private tryCreate(originalUrl: string, userId: string, expiresAt: Date): Promise<Link> {
    const shortUrl = this.slugGenerator.generate();
    return this.dataSource.transaction((manager) =>
      this.insertLinkWithOutbox(manager, { shortUrl, originalUrl, userId, expiresAt }),
    );
  }

  async create(originalUrl: string, userId: string, explicitExpiry?: Date): Promise<Link> {
    const [count, limit] = await Promise.all([
      this.usageService.countLinksThisMonth(userId),
      this.usageService.getLinkLimit(userId),
    ]);
    if (count >= limit) throw new MonthlyLinkLimitExceededError();

    const expiresAt = resolveExpiry(explicitExpiry);
    const attempt = () => this.tryCreate(originalUrl, userId, expiresAt);
    return retryOnSlugConflict(attempt);
  }

  // Guest variant: reuses the slug-insert-outbox chain verbatim but skips the
  // per-user quota check. Quota is meaningless on the shared Guest row (one
  // visitor could exhaust it for everyone); the global ThrottlerGuard is the
  // only per-IP abuse bound on Guest.
  async createGuest(
    originalUrl: string,
    guestUserId: string,
    explicitExpiry?: Date,
  ): Promise<Link> {
    const expiresAt = resolveExpiry(explicitExpiry);
    const attempt = () => this.tryCreate(originalUrl, guestUserId, expiresAt);
    return retryOnSlugConflict(attempt);
  }

  listForUser(userId: string): Promise<Link[]> {
    return this.dataSource.manager.find(Link, { where: { userId }, order: { createdAt: 'DESC' } });
  }

  findBySlug(slug: string): Promise<Link | null> {
    return this.dataSource.manager.findOne(Link, { where: { shortUrl: slug } });
  }

  async delete(slug: string, userId: string): Promise<void> {
    const link = await this.dataSource.manager.findOne(Link, { where: { shortUrl: slug } });
    if (!link) throw new NotFoundException(`Link ${slug} not found`);
    if (link.userId !== userId) throw new ForbiddenException();
    await this.dataSource.manager.delete(Link, { shortUrl: slug });
  }
}
