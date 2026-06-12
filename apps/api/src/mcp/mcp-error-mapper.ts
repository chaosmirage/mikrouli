/**
 * Projects RFC 9457 HttpExceptions into MCP tool errors.
 *
 * Every entrance to link creation (REST or MCP) uses the same error authority:
 * ProblemDetails helpers from common/problem-details.ts. This module is the
 * single projection of that authority into the MCP isError CallToolResult shape.
 * Stack traces are deliberately excluded (RFC 9457 / api_contract section 3.3).
 */

import { HttpException, UnprocessableEntityException } from '@nestjs/common';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { buildProblemFromStatus } from '../common/problem-details';

interface ClassValidatorError {
  property: string;
  constraints?: Record<string, string>;
}

interface ValidationPayload {
  kind: 'validation';
  errors: ClassValidatorError[];
}

function isValidationPayload(r: unknown): r is ValidationPayload {
  return (
    typeof r === 'object' &&
    r !== null &&
    (r as ValidationPayload).kind === 'validation'
  );
}

/**
 * Formats field-level validation errors into the "; field errors: ..." suffix
 * appended to 422 tool error text so callers know exactly which field failed.
 */
function formatFieldErrors(errors: ClassValidatorError[]): string {
  const entries = errors.flatMap((e) =>
    Object.entries(e.constraints ?? {}).map(
      ([rule, msg]) => `${e.property}: ${msg} (${rule})`,
    ),
  );
  return entries.length > 0 ? `; field errors: ${entries.join(', ')}` : '';
}

/**
 * Maps a thrown HttpException to an MCP CallToolResult with isError=true.
 * Derives the error text from the same buildProblemFromStatus helper the REST
 * filter uses, ensuring both surfaces report the same problem shape.
 * No stack traces are included (no internal details leak per api_contract §3.3).
 */
export function mapHttpExceptionToToolError(err: HttpException): CallToolResult {
  const status = err.getStatus();
  const problem = buildProblemFromStatus(status);
  let text = `${status} ${problem.title}`;

  if (err instanceof UnprocessableEntityException) {
    const response = err.getResponse();
    if (isValidationPayload(response)) {
      text += `: Unprocessable Entity${formatFieldErrors(response.errors)}`;
    } else {
      const detail = typeof response === 'string' ? response : undefined;
      if (detail) text += `: ${detail}`;
    }
  } else {
    const response = err.getResponse();
    const detail = typeof response === 'string' ? response : undefined;
    if (detail) text += `: ${detail}`;
  }

  return {
    isError: true,
    content: [{ type: 'text', text }],
  };
}
