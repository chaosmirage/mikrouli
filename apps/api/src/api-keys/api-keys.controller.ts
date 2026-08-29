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
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import {
  AUTH_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';
import { ApiKeysService, ApiKeySummary, CreatedApiKey } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import type {
  CreateApiKeyResponse,
  ApiKeysListResponse,
  ApiKeySummarySchema,
} from '../types/openapi';

function toApiKeyCreatedResponse(key: CreatedApiKey): CreateApiKeyResponse {
  return {
    id: key.id,
    label: key.label,
    key: key.key,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt.toISOString(),
  };
}

function toApiKeySummarySchema(key: ApiKeySummary): ApiKeySummarySchema {
  return {
    id: key.id,
    label: key.label,
    keyPrefix: key.keyPrefix,
    createdAt: key.createdAt.toISOString(),
    lastUsedAt: key.lastUsedAt ? key.lastUsedAt.toISOString() : null,
    revokedAt: key.revokedAt ? key.revokedAt.toISOString() : null,
  };
}

@Controller('api-keys')
@UseGuards(JwtAuthGuard)
// Authenticated traffic runs under the generous data budget alone: the skip
// sheds the three public names, whose floors would otherwise bind through
// the min-rule. JWT auth remains the primary control on these routes.
@SkipThrottle({
  [DEFAULT_THROTTLE_NAME]: true,
  [AUTH_THROTTLE_NAME]: true,
  [REDIRECT_THROTTLE_NAME]: true,
})
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateApiKeyDto,
  ): Promise<CreateApiKeyResponse> {
    const key = await this.apiKeysService.createForUser(req.user.id, dto);
    return toApiKeyCreatedResponse(key);
  }

  @Get()
  async list(@Req() req: AuthenticatedRequest): Promise<ApiKeysListResponse> {
    const keys = await this.apiKeysService.listForUser(req.user.id);
    return { data: keys.map(toApiKeySummarySchema) };
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  revoke(@Req() req: AuthenticatedRequest, @Param('id') id: string): Promise<void> {
    return this.apiKeysService.revoke(req.user.id, id);
  }
}
