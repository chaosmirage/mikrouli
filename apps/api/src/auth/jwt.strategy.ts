import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy, StrategyOptionsWithoutRequest } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { JwtPayload } from './auth.service';

export interface RequestUser {
  id: string;
  email: string;
}

function buildStrategyOptions(secret: string): StrategyOptionsWithoutRequest {
  return {
    jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
    ignoreExpiration: false,
    secretOrKey: secret,
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
    return { id: payload.sub, email: payload.email };
  }
}
