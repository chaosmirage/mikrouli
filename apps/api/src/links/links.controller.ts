import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { BearerOrApiKeyGuard } from '../api-keys/bearer-or-api-key.guard';
import { CreateLinkDto } from './dto/create-link.dto';
import { Link } from './entities/link.entity';
import { LinksService } from './links.service';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('links')
@UseGuards(BearerOrApiKeyGuard)
export class LinksController {
  constructor(private readonly linksService: LinksService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateLinkDto): Promise<Link> {
    return this.linksService.create(dto.originalUrl, req.user.id, dto.expiresAt);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest): Promise<Link[]> {
    return this.linksService.listForUser(req.user.id);
  }

  @Delete(':slug')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Req() req: AuthenticatedRequest, @Param('slug') slug: string): Promise<void> {
    return this.linksService.delete(slug, req.user.id);
  }
}
