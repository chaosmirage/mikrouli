import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { LinkCacheService } from '../cache/link-cache.service';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link } from './entities/link.entity';
import { LinksService } from './links.service';
import type { CreateLinkResponse, LinksListResponse, PublicLinkSchema } from '../types/openapi';

function toPublicLinkSchema(link: Link): PublicLinkSchema {
  return {
    shortUrl: link.shortUrl,
    originalUrl: link.originalUrl,
    createdAt: link.createdAt.toISOString(),
    expiresAt: link.expiresAt ? link.expiresAt.toISOString() : null,
  };
}

@Controller('urls')
@UseGuards(BearerOrApiKeyGuard)
export class LinksController {
  constructor(
    private readonly linksService: LinksService,
    private readonly linkCache: LinkCacheService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateLinkDto,
  ): Promise<CreateLinkResponse> {
    const link = await this.linksService.create(dto.url, req.user.id, dto.expiresAt);
    await this.linkCache.set(link.shortUrl, link.originalUrl, link.expiresAt);
    return toPublicLinkSchema(link);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<LinksListResponse> {
    const links = await this.linksService.listForUser(req.user.id);
    return { data: links.map(toPublicLinkSchema) };
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    await this.linksService.delete(slug, req.user.id);
    await this.linkCache.del(slug);
  }
}
