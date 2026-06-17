import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Req,
  Res,
  ServiceUnavailableException,
  UnauthorizedException,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService, buildClearCookieValue, PublicUser } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestUser } from './jwt.strategy';
import { AUTH_THROTTLE_NAME } from '../app.module';
import type { RegisterResponse, MeResponse } from '../types/openapi';
import { GithubOauthGuard } from './github.strategy';
import { GithubOauthRedirectFilter } from './github-oauth.errors';
import type { GithubIdentity } from './github-oauth.errors';

const ACCESS_COOKIE_NAME = 'mikrouli_access';
const REFRESH_COOKIE_NAME = 'mikrouli_refresh';
const ACCESS_COOKIE_PATH = '/api';
const REFRESH_COOKIE_PATH = '/api/auth';

interface AuthenticatedRequest extends Request {
  user: RequestUser;
}

interface GithubCallbackRequest extends Request {
  user: GithubIdentity;
}

function toRegisterResponse(user: PublicUser): RegisterResponse {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

function toUserProfileResponse(user: PublicUser): MeResponse {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

function applySessionCookies(res: Response, cookies: [string, string]): void {
  // Express setHeader with an array sets multiple Set-Cookie headers.
  res.setHeader('Set-Cookie', cookies);
}

function applyClearCookies(res: Response): void {
  res.setHeader('Set-Cookie', [
    buildClearCookieValue(ACCESS_COOKIE_NAME, ACCESS_COOKIE_PATH),
    buildClearCookieValue(REFRESH_COOKIE_NAME, REFRESH_COOKIE_PATH),
  ]);
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(201)
  @Throttle({ [AUTH_THROTTLE_NAME]: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    const user = await this.authService.register(dto);
    return toRegisterResponse(user);
  }

  @Post('login')
  @HttpCode(200)
  @Throttle({ [AUTH_THROTTLE_NAME]: { limit: 10, ttl: 60_000 } })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    if (!user) throw new UnauthorizedException();
    const { cookies } = await this.authService.issueTokens(user);
    applySessionCookies(res, cookies);
    return toUserProfileResponse({ id: user.id, email: user.email, createdAt: user.createdAt });
  }

  @Post('refresh')
  @HttpCode(200)
  @Throttle({ [AUTH_THROTTLE_NAME]: { limit: 10, ttl: 60_000 } })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<MeResponse> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies[REFRESH_COOKIE_NAME];
    if (!refreshToken) throw new UnauthorizedException();

    const { tokens, cookies: newCookies } = await this.authService.rotateRefresh(refreshToken);
    applySessionCookies(res, newCookies);

    // Decode the issued access token to read the user profile without a DB round-trip.
    // The token was just signed so it is guaranteed valid.
    const payloadB64 = tokens.accessToken.split('.')[1];
    if (!payloadB64) throw new UnauthorizedException();
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64').toString('utf-8')) as {
      sub: string;
      email: string;
    };

    const user = await this.usersService.findById(payload.sub);
    if (!user) throw new UnauthorizedException();
    return toUserProfileResponse({ id: user.id, email: user.email, createdAt: user.createdAt });
  }

  @Post('logout')
  @HttpCode(204)
  @SkipThrottle()
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response): Promise<void> {
    const cookies = req.cookies as Record<string, string | undefined>;
    const refreshToken = cookies[REFRESH_COOKIE_NAME];

    if (!refreshToken) {
      // No session present — idempotent: clear cookies and return 204.
      applyClearCookies(res);
      return;
    }

    try {
      await this.authService.revokeRefresh(refreshToken);
    } catch {
      // Redis error during revocation — return 503 WITHOUT clearing cookies.
      // Clearing cookies would falsely claim server-side revocation succeeded.
      throw new ServiceUnavailableException('Session revocation temporarily unavailable');
    }

    applyClearCookies(res);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  async me(@Req() req: AuthenticatedRequest): Promise<MeResponse> {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new UnauthorizedException();
    return toUserProfileResponse({ id: user.id, email: user.email, createdAt: user.createdAt });
  }

  // Initiates the GitHub OAuth flow: the GithubOauthGuard intercepts this route
  // before the handler body runs, mints a single-use CSRF state token into Redis,
  // and redirects the browser to GitHub's authorization endpoint.
  @Get('github')
  @UseGuards(GithubOauthGuard)
  @Throttle({ [AUTH_THROTTLE_NAME]: { limit: 10, ttl: 60_000 } })
  githubAuthorize(): void {
    // Guard redirects to GitHub before this body executes.
  }

  // Handles the OAuth callback from GitHub.
  // The GithubOauthGuard validates and consumes the state token, exchanges the
  // authorization code, and calls GithubStrategy.validate() which performs
  // verified-email selection and populates req.user as a GithubIdentity.
  // On success: issues the session cookie pair and redirects to /dashboard.
  // On typed OAuth failure: GithubOauthRedirectFilter redirects to /login?error=<slug>.
  // On any other error: falls through to the global ProblemDetailsFilter.
  @Get('github/callback')
  @UseGuards(GithubOauthGuard)
  @UseFilters(GithubOauthRedirectFilter)
  @Throttle({ [AUTH_THROTTLE_NAME]: { limit: 10, ttl: 60_000 } })
  async githubCallback(@Req() req: GithubCallbackRequest, @Res() res: Response): Promise<void> {
    const { cookies } = await this.authService.loginWithGithub(req.user);
    applySessionCookies(res, cookies);
    res.redirect(302, '/dashboard');
  }
}
