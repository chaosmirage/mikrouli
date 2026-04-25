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
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeysService, ApiKeySummary, CreatedApiKey } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

interface AuthenticatedRequest extends Request {
  user: { id: string };
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateApiKeyDto): Promise<CreatedApiKey> {
    return this.apiKeysService.createForUser(req.user.id, dto);
  }

  @Get()
  list(@Req() req: AuthenticatedRequest): Promise<ApiKeySummary[]> {
    return this.apiKeysService.listForUser(req.user.id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    return this.apiKeysService.revoke(req.user.id, id);
  }
}
