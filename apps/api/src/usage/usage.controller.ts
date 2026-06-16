import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import { UsageService } from './usage.service';
import type { UsageSummaryResponse } from '../types/openapi';

@Controller('usage')
@UseGuards(JwtAuthGuard)
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getUsage(@Req() req: AuthenticatedRequest): Promise<UsageSummaryResponse> {
    return this.usageService.getSummary(req.user.id);
  }
}
