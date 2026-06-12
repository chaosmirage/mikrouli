import { asyncLocalStorage } from './correlation-id';
import { CorrelationIdLogger } from './correlation-id.logger';

function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const originalWrite = process.stdout.write;
  process.stdout.write = (chunk: unknown) => {
    if (typeof chunk === 'string') {
      chunks.push(chunk);
    }
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = originalWrite;
  }
  return chunks.join('');
}

describe('CorrelationIdLogger', () => {
  let logger: CorrelationIdLogger;

  beforeEach(() => {
    logger = new CorrelationIdLogger();
  });

  it('includes the correlation ID in log output when inside a request context', () => {
    const correlationId = 'test-corr-id-789';
    const output = asyncLocalStorage.run({ correlationId }, () =>
      captureStdout(() => logger.log('hello world')),
    );

    expect(output).toContain('test-corr-id-789');
  });

  it('omits the correlation ID when no request context is active', () => {
    const output = captureStdout(() => logger.log('startup message'));

    expect(output).not.toContain('[cid:');
  });

  it('produces different output with vs without correlation ID for the same message', () => {
    const correlationId = 'abc-def-ghi';
    const withId = asyncLocalStorage.run({ correlationId }, () =>
      captureStdout(() => logger.log('same message')),
    );
    const withoutId = captureStdout(() => logger.log('same message'));

    expect(withId).not.toBe(withoutId);
    expect(withId).toContain('abc-def-ghi');
    expect(withoutId).not.toContain('[cid:');
  });
});
