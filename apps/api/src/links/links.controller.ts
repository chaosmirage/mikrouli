import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { RedisService } from '../redis/redis.service';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link } from './entities/link.entity';
import { LinksService } from './links.service';

const CACHE_TTL_CAP_SECONDS = 86_400;

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

interface PublicLink {
  shortUrl: string;
  originalUrl: string;
  createdAt: Date;
  expiresAt: Date | null;
}

function toPublicLink(link: Link): PublicLink {
  return { shortUrl: link.shortUrl, originalUrl: link.originalUrl, createdAt: link.createdAt, expiresAt: link.expiresAt };
}

function ttlSecondsUntil(expiresAt: Date | null): number | undefined {
  if (expiresAt === null) return CACHE_TTL_CAP_SECONDS;
  const diffMs = expiresAt.getTime() - Date.now();
  if (diffMs <= 0) return undefined;
  return Math.min(Math.floor(diffMs / 1000), CACHE_TTL_CAP_SECONDS);
}

@Controller('urls')
@UseGuards(BearerOrApiKeyGuard)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly redisService: RedisService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLinkDto): Promise<PublicLink> {
    const link = await this.linksService.create(dto.url, req.user.id, dto.expiresAt);
    await this.redisService.set(`link:${link.shortUrl}`, link.originalUrl, ttlSecondsUntil(link.expiresAt));
    return toPublicLink(link);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<PublicLink[]> {
    const links = await this.linksService.listForUser(req.user.id);
    return links.map(toPublicLink);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.linksService.delete(slug, req.user.id);
    await this.redisService.del(`link:${slug}`);
  }
}
