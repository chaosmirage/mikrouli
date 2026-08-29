import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import type { AuthenticatedRequest } from '../common/authenticated-request';
import {
  AUTH_THROTTLE_NAME,
  DEFAULT_THROTTLE_NAME,
  REDIRECT_THROTTLE_NAME,
} from '../common/throttler-policy';
import { UsageService } from './usage.service';
import type { UsageSummaryResponse } from '../types/openapi';

@Controller('usage')
@UseGuards(JwtAuthGuard)
// Authenticated traffic runs under the generous data budget alone: the skip
// sheds the three public names, whose floors would otherwise bind through
// the min-rule. JWT auth remains the primary control on these routes.
@SkipThrottle({
  [DEFAULT_THROTTLE_NAME]: true,
  [AUTH_THROTTLE_NAME]: true,
  [REDIRECT_THROTTLE_NAME]: true,
})
export class UsageController {
  constructor(private readonly usageService: UsageService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  getUsage(@Req() req: AuthenticatedRequest): Promise<UsageSummaryResponse> {
    return this.usageService.getSummary(req.user.id);
  }
}
