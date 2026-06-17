import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import {
  ExtractJwt,
  JwtFromRequestFunction,
  Strategy,
  StrategyOptionsWithoutRequest,
} from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { JwtPayload } from './auth.service';

const ACCESS_COOKIE_NAME = 'mikrouli_access';

export interface RequestUser {
  id: string;
  email: string;
  isGuest: boolean;
}

// Extracts the access token from the HttpOnly cookie set by the API on login/refresh.
// Returns null when the cookie is absent so the extractor chain continues to bearer.
function cookieExtractor(cookieName: string): JwtFromRequestFunction {
  return (req: Request): string | null => {
    const cookies = req.cookies as Record<string, string | undefined> | undefined;
    return cookies?.[cookieName] ?? null;
  };
}

function buildStrategyOptions(secret: string): StrategyOptionsWithoutRequest {
  return {
    // Cookie-first extractor chain: browser clients ride the HttpOnly cookie;
    // machine clients (API keys bypass this guard, but keep bearer for CLI/tests).
    jwtFromRequest: ExtractJwt.fromExtractors([
      cookieExtractor(ACCESS_COOKIE_NAME),
      ExtractJwt.fromAuthHeaderAsBearerToken(),
    ]),
    ignoreExpiration: false,
    secretOrKey: secret,
    // Prevents algorithm-confusion attacks: tokens signed with any algorithm
    // other than HS256 are rejected before the validate callback is reached.
    algorithms: ['HS256'],
  };
}

function isAccessToken(payload: JwtPayload): boolean {
  return payload.type !== 'refresh';
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(configService: ConfigService) {
    super(buildStrategyOptions(configService.getOrThrow<string>('JWT_SECRET')));
  }

  validate(payload: JwtPayload): RequestUser {
    if (!isAccessToken(payload)) throw new UnauthorizedException();
    return { id: payload.sub, email: payload.email, isGuest: false };
  }
}
