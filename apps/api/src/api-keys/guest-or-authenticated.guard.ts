import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { BearerOrApiKeyGuard } from './bearer-or-api-key.guard';
import { UsersService } from '../users/users.service';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { carriesApiCredential } from '../common/credential-presence';

// The env var name and its default value (mirrors the wish: default on).
const GUEST_FLAG_ENV_KEY = 'GUEST_SHORTEN_ENABLED';
const GUEST_FLAG_DEFAULT = 'true';

function isTruthyFlag(raw: string | undefined): boolean {
  return String(raw ?? GUEST_FLAG_DEFAULT).toLowerCase() === 'true';
}

// Extract the hostname from a URL string, ignoring port and protocol.
// Returns null for malformed input.
function hostnameOf(urlStr: string): string | null {
  try {
    return new URL(urlStr).hostname;
  } catch {
    return null;
  }
}

// Guest creation is a browser-only flow: the SPA on the landing page POSTs to
// /api/urls without credentials when GUEST_SHORTEN_ENABLED is on. Non-browser
// clients (curl, scripts, bots) must NOT use the guest path — they need an API
// key or JWT like any other REST/MCP client.
//
// Browsers always send the Origin header on cross-origin and same-origin fetch
// requests. We check that the Origin (or Referer fallback) hostname matches
// the server's own hostname (from PUBLIC_BASE_URL or the Host header).
// Hostnames are compared, NOT full origins with ports — nginx $host strips
// the port, so comparing full origins would always mismatch in dev.
// A curl request either omits Origin entirely or sends a value that does not
// match — in both cases the guest branch is refused.
function isBrowserRequest(req: Request, allowedHostnames: string[]): boolean {
  if (allowedHostnames.length === 0) return false;
  const origin = req.headers.origin;
  if (origin) {
    const hostname = hostnameOf(origin);
    return hostname !== null && allowedHostnames.includes(hostname);
  }
  // Fallback to Referer: browsers send it on same-origin navigations and fetch.
  const referer = req.headers.referer;
  if (referer) {
    const hostname = hostnameOf(referer);
    return hostname !== null && allowedHostnames.includes(hostname);
  }
  // No Origin and no Referer → not a browser request.
  return false;
}

// Single choke-point for Guest admission on LinksController.create.
//
// Three branches, in order:
//   1. Credential present -> delegate to BearerOrApiKeyGuard (the existing
//      registered-user path, unchanged).
//   2. No credential AND GUEST_SHORTEN_ENABLED=true (read per request via
//      ConfigService so the API never trusts a cached SPA hint) AND the request
//      originates from the SPA (Origin/Referer hostname matches the server) ->
//      resolve the Guest row, populate req.user, and admit.
//   3. No credential AND (flag off OR not a browser request) -> throw
//      UnauthorizedException, rendered by ProblemDetailsFilter as RFC 9457
//      application/problem+json.
//
// The flag is re-read on every Guest POST. A client that cached the SPA's
// flag-on value before the operator flipped the flag is still refused here.
// The Origin check ensures the guest path is usable only from the SPA —
// curl, scripts, and bots are directed to the API-key-authenticated path.
@Injectable()
export class GuestOrAuthenticatedGuard implements CanActivate {
  constructor(
    private readonly bearerOrApiKeyGuard: BearerOrApiKeyGuard,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();

    if (carriesApiCredential(request)) {
      return this.bearerOrApiKeyGuard.canActivate(context);
    }

    const flagRaw = this.configService.get<string>(GUEST_FLAG_ENV_KEY);
    if (!isTruthyFlag(flagRaw)) {
      throw new UnauthorizedException();
    }

    // Browser-only enforcement: the guest path is for the SPA, not for curl.
    // The request Origin/Referer hostname must match one of the allowed
    // hostnames derived from PUBLIC_BASE_URL and/or the Host header.
    const allowedHostnames = this.resolveAllowedHostnames(request);
    if (!isBrowserRequest(request, allowedHostnames)) {
      throw new UnauthorizedException();
    }

    const guestUserId = await this.usersService.getGuestUserId();
    (request as unknown as AuthenticatedRequest).user = {
      id: guestUserId,
      isGuest: true,
    };
    return true;
  }

  // Build the list of allowed hostnames from PUBLIC_BASE_URL and the request
  // Host header. Both are included so the guard works in production (where
  // PUBLIC_BASE_URL matches) and in local dev (where the Host header carries
  // the actual hostname the browser used).
  private resolveAllowedHostnames(req: Request): string[] {
    const hostnames: string[] = [];

    const publicBaseUrl = this.configService.get<string>('PUBLIC_BASE_URL');
    if (publicBaseUrl) {
      const h = hostnameOf(publicBaseUrl);
      if (h) hostnames.push(h);
    }

    const host = req.headers.host;
    if (host) {
      // Host header may include port (e.g. "localhost:8888"); extract hostname.
      const h = host.split(':')[0]!;
      if (h) hostnames.push(h);
    }

    // De-duplicate.
    return [...new Set(hostnames)];
  }
}
