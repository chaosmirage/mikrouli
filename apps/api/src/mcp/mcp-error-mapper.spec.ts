/**
 * Verifies that RFC 9457 problem-details HTTP errors are truthfully projected
 * into MCP tool errors (isError: true CallToolResult), with no stack traces.
 */

import { HttpException, UnauthorizedException, UnprocessableEntityException } from '@nestjs/common';
import { mapHttpExceptionToToolError } from './mcp-error-mapper';

describe('mapHttpExceptionToToolError', () => {
  it('maps a 401 UnauthorizedException to isError result with status and title', () => {
    const err = new UnauthorizedException();
    const result = mapHttpExceptionToToolError(err);

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe('text');
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/^401/);
    expect(text).toMatch(/Unauthorized/i);
    // No stack traces
    expect(text).not.toMatch(/at \w/);
    expect(text).not.toMatch(/Error:/);
  });

  it('maps a 422 validation error and appends field errors', () => {
    const payload = {
      kind: 'validation' as const,
      errors: [
        {
          property: 'url',
          constraints: { isPublicHttpUrl: 'url must be a valid http(s) URL' },
        },
      ],
    };
    const err = new UnprocessableEntityException(payload);
    const result = mapHttpExceptionToToolError(err);

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/^422/);
    expect(text).toMatch(/Unprocessable Entity/i);
    expect(text).toMatch(/field errors/i);
    expect(text).toMatch(/url/);
    // No stack traces
    expect(text).not.toMatch(/at \w/);
  });

  it('maps a 500 generic HttpException to isError result', () => {
    const err = new HttpException('internal error', 500);
    const result = mapHttpExceptionToToolError(err);

    expect(result.isError).toBe(true);
    const text = (result.content[0] as { type: string; text: string }).text;
    expect(text).toMatch(/^500/);
    expect(text).not.toMatch(/at \w/);
  });
});
