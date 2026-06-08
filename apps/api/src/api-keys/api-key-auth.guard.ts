import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { ApiKeysService } from './api-keys.service';

function extractApiKeyHeader(request: Request): string | null {
  const header = request.headers['x-api-key'];
  if (typeof header !== 'string') return null;
  return header;
}

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = extractApiKeyHeader(request);
    if (!apiKey) throw new UnauthorizedException();
    const result = await this.apiKeysService.validate(apiKey);
    if (!result) throw new UnauthorizedException();
    (request as unknown as AuthenticatedRequest).user = { id: result.userId };
    return true;
  }
}
