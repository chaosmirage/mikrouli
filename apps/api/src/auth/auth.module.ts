import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UsersModule } from '../users/users.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';

const ACCESS_TOKEN_TTL = '15m';

function buildJwtOptions(configService: ConfigService) {
  return {
    secret: configService.getOrThrow<string>('JWT_SECRET'),
    signOptions: { expiresIn: ACCESS_TOKEN_TTL },
  };
}

const jwtModule = JwtModule.registerAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: buildJwtOptions,
});

@Module({
  imports: [UsersModule, PassportModule, jwtModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [JwtAuthGuard],
})
export class AuthModule {}
