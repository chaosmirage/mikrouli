import { Controller, Get } from '@nestjs/common';
import type { HealthCheckResponse } from '../types/openapi';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthCheckResponse {
    return { status: 'ok' };
  }
}
