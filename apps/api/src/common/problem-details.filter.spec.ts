import { HttpException, HttpStatus } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProblemDetailsFilter } from './problem-details.filter';

const PROBLEM_JSON = 'application/problem+json';

const VALIDATION_PAYLOAD = {
  kind: 'validation' as const,
  errors: [{ property: 'email', constraints: { isEmail: 'must be email' } }],
};

class MockResponse {
  statusCode = 0;
  headers: Record<string, string> = {};
  body: unknown;

  status(code: number): this {
    this.statusCode = code;
    return this;
  }

  set(key: string, value: string): this {
    this.headers[key] = value;
    return this;
  }

  json(data: unknown): this {
    this.body = data;
    return this;
  }
}

function makeHost(res: MockResponse) {
  return { switchToHttp: () => ({ getResponse: () => res }) };
}

function makeConfigService(nodeEnv: string): ConfigService {
  return {
    get: (key: string) => (key === 'NODE_ENV' ? nodeEnv : undefined),
  } as unknown as ConfigService;
}

function buildFilter(nodeEnv = 'test'): ProblemDetailsFilter {
  return new ProblemDetailsFilter(makeConfigService(nodeEnv));
}

function asBody(res: MockResponse): Record<string, unknown> {
  return res.body as Record<string, unknown>;
}

describe('ProblemDetailsFilter', () => {
  it('HttpException maps to ProblemDetails with correct status, type, content-type', () => {
    const res = new MockResponse();
    buildFilter().catch(new HttpException('Not Found', HttpStatus.NOT_FOUND), makeHost(res) as never);
    expect(res.statusCode).toBe(HttpStatus.NOT_FOUND);
    expect(res.headers['Content-Type']).toBe(PROBLEM_JSON);
    expect(asBody(res).status).toBe(HttpStatus.NOT_FOUND);
    expect(asBody(res).type).toMatch(/not-found/);
  });

  it('BadRequestException with validation payload emits 422 with errors[]', () => {
    const res = new MockResponse();
    buildFilter().catch(new HttpException(VALIDATION_PAYLOAD, HttpStatus.BAD_REQUEST), makeHost(res) as never);
    expect(res.statusCode).toBe(422);
    expect(asBody(res).status).toBe(422);
    type ErrorEntry = { field: string; rule: string; message: string };
    const errors = asBody(res).errors as ErrorEntry[];
    expect(errors[0].field).toBe('email');
    expect(errors[0].rule).toBe('isEmail');
  });

  it('generic Error in production emits 500 without message in detail', () => {
    const res = new MockResponse();
    buildFilter('production').catch(new Error('internal secret'), makeHost(res) as never);
    expect(res.statusCode).toBe(500);
    expect(asBody(res).detail).toBeUndefined();
  });

  it('generic Error in dev/test includes message in detail', () => {
    const res = new MockResponse();
    buildFilter('development').catch(new Error('debug info'), makeHost(res) as never);
    expect(res.statusCode).toBe(500);
    expect(asBody(res).detail).toBe('debug info');
  });
});
