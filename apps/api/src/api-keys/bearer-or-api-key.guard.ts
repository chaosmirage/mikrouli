import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { IncomingHttpHeaders } from 'http';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ApiKeyAuthGuard } from './api-key-auth.guard';

type AuthMethod = 'jwt' | 'api-key' | null;
type GuardResult = boolean | Promise<boolean> | Observable<boolean>;

function chooseAuthMethod(headers: IncomingHttpHeaders): AuthMethod {
  if (headers.authorization?.startsWith('Bearer ')) return 'jwt';
  if (headers['x-api-key']) return 'api-key';
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
    const request = context.switchToHttp().getRequest<{ headers: IncomingHttpHeaders }>();
    const method = chooseAuthMethod(request.headers);
    if (!method) throw new UnauthorizedException();
    return this.runGuard(method, context);
  }
}
