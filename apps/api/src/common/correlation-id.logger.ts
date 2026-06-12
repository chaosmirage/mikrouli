import { ConsoleLogger, LogLevel } from '@nestjs/common';
import { getCorrelationId } from './correlation-id';

export class CorrelationIdLogger extends ConsoleLogger {
  protected formatMessage(
    logLevel: LogLevel,
    message: unknown,
    pidMessage: string,
    formattedLogLevel: string,
    contextMessage: string,
    timestampDiff: string,
  ): string {
    const correlationId = getCorrelationId();
    const base = super.formatMessage(
      logLevel,
      message,
      pidMessage,
      formattedLogLevel,
      contextMessage,
      timestampDiff,
    );
    if (!correlationId) {
      return base;
    }
    return `[cid:${correlationId}] ${base}`;
  }
}
