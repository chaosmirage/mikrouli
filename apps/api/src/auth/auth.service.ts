import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { User } from '../users/user.entity';

const BCRYPT_SALT_ROUNDS = 10;
const REFRESH_TOKEN_TTL = '7d';
const REFRESH_TOKEN_TYPE = 'refresh';

export interface JwtPayload {
  sub: string;
  email: string;
  iat?: number;
  exp?: number;
  type?: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface PublicUser {
  id: string;
  email: string;
  createdAt: Date;
}

function buildAccessPayload(user: User): JwtPayload {
  return { sub: user.id, email: user.email };
}

function buildRefreshPayload(user: User): JwtPayload {
  return { sub: user.id, email: user.email, type: REFRESH_TOKEN_TYPE };
}

function decodeRefreshToken(jwtService: JwtService, token: string, secret: string): JwtPayload {
  try {
    return jwtService.verify<JwtPayload>(token, { secret });
  } catch {
    throw new UnauthorizedException();
  }
}

function assertRefreshType(payload: JwtPayload): void {
  if (payload.type !== REFRESH_TOKEN_TYPE) throw new UnauthorizedException();
}

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async register(dto: { email: string; password: string }): Promise<PublicUser> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);
    const user = await this.usersService.create({ email: dto.email, passwordHash });
    return { id: user.id, email: user.email, createdAt: user.createdAt };
  }

  async validateCredentials(email: string, password: string): Promise<User | null> {
    const user = await this.usersService.findByEmail(email);
    if (!user) return null;
    const match = await bcrypt.compare(password, user.passwordHash);
    return match ? user : null;
  }

  issueTokens(user: User): TokenPair {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshOptions = { secret: refreshSecret, expiresIn: REFRESH_TOKEN_TTL };
    const accessToken = this.jwtService.sign(buildAccessPayload(user));
    const refreshToken = this.jwtService.sign(buildRefreshPayload(user), refreshOptions);
    return { accessToken, refreshToken };
  }

  async rotateRefresh(token: string): Promise<TokenPair> {
    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const payload = decodeRefreshToken(this.jwtService, token, refreshSecret);
    assertRefreshType(payload);
    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return this.issueTokens(user);
  }
}
