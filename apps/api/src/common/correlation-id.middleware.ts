import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { asyncLocalStorage } from './correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const correlationId =
      (req.headers['x-correlation-id'] as string | undefined) ??
      (req.headers['x-request-id'] as string | undefined) ??
      crypto.randomUUID();

    res.setHeader('X-Correlation-ID', correlationId);
    asyncLocalStorage.run({ correlationId }, next);
  }
}
