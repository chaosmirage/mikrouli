import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { IncomingHttpHeaders } from 'http';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

const ACCESS_COOKIE_NAME = 'mikrouli_access';

type AuthMethod = 'jwt' | 'api-key' | null;
type GuardResult = boolean | Promise<boolean> | Observable<boolean>;

function hasCookieToken(req: Request): boolean {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return Boolean(cookies?.[ACCESS_COOKIE_NAME]);
}

function chooseAuthMethod(headers: IncomingHttpHeaders, req: Request): AuthMethod {
  if (headers.authorization?.startsWith('Bearer ')) return 'jwt';
  if (headers['x-api-key']) return 'api-key';
  if (hasCookieToken(req)) return 'jwt';
  return null;
}

function resolveGuardResult(result: GuardResult): Promise<boolean> {
  if (typeof result === 'boolean') return Promise.resolve(result);
  if (isObservable(result)) return firstValueFrom(result);
  return result;
}

@Injectable()
export class BearerOrApiKeyGuard implements CanActivate {
  constructor(
    private readonly jwtGuard: JwtAuthGuard,
    private readonly apiKeyGuard: ApiKeyAuthGuard,
  ) {}

  private runGuard(method: AuthMethod, context: ExecutionContext): Promise<boolean> {
    const guard = method === 'jwt' ? this.jwtGuard : this.apiKeyGuard;
    return resolveGuardResult(guard.canActivate(context));
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const method = chooseAuthMethod(request.headers, request);
    if (!method) throw new UnauthorizedException();
    return this.runGuard(method, context);
  }
}
