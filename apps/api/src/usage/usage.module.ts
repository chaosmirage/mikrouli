import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { User } from '../users/user.entity';
import { UsageController } from './usage.controller';
import { UsageService } from './usage.service';

@Module({
  imports: [TypeOrmModule.forFeature([User]), AuthModule],
  providers: [UsageService],
  controllers: [UsageController],
  exports: [UsageService],
})
export class UsageModule {}
