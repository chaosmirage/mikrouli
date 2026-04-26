import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Request,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { AuthService, PublicUser } from './auth.service';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RequestUser } from './jwt.strategy';
import type {
  RegisterResponse,
  LoginResponse,
  RefreshResponse,
  MeResponse,
} from '../types/openapi';

interface AuthenticatedRequest {
  user: RequestUser;
}

function toRegisterResponse(user: PublicUser): RegisterResponse {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

function toUserProfileResponse(user: PublicUser): MeResponse {
  return { id: user.id, email: user.email, createdAt: user.createdAt.toISOString() };
}

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Post('register')
  @HttpCode(201)
  async register(@Body() dto: RegisterDto): Promise<RegisterResponse> {
    const user = await this.authService.register(dto);
    return toRegisterResponse(user);
  }

  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto): Promise<LoginResponse> {
    const user = await this.authService.validateCredentials(dto.email, dto.password);
    if (!user) throw new UnauthorizedException();
    return this.authService.issueTokens(user) as LoginResponse;
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshDto): Promise<RefreshResponse> {
    return this.authService.rotateRefresh(dto.refreshToken) as Promise<RefreshResponse>;
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@Request() req: AuthenticatedRequest): Promise<MeResponse> {
    const user = await this.usersService.findById(req.user.id);
    if (!user) throw new UnauthorizedException();
    return toUserProfileResponse({ id: user.id, email: user.email, createdAt: user.createdAt });
  }
}
