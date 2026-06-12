import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import { QueryFailedError } from 'typeorm';
import { getCorrelationId } from './correlation-id';
import { buildProblem, buildProblemFromStatus, ProblemDetails } from './problem-details';

const CONTENT_TYPE_PROBLEM_JSON = 'application/problem+json';
const HTTP_STATUS_UNPROCESSABLE = 422;
const HTTP_STATUS_INTERNAL = 500;

interface ClassValidatorError {
  property: string;
  constraints?: Record<string, string>;
}

interface ValidationPayload {
  kind: 'validation';
  errors: ClassValidatorError[];
}

interface ProblemPayload {
  kind: 'problem';
  typeSlug: string;
  title: string;
  detail: string;
}

type ErrorEntry = { field: string; message: string; rule: string };

function isValidationPayload(payload: unknown): payload is ValidationPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as ValidationPayload).kind === 'validation'
  );
}

// Typed exceptions that carry an explicit slug (e.g. github-no-verified-email)
// are mapped through buildProblem so the response type URI is the correct slug,
// not the generic status-based one that buildProblemFromStatus would produce.
function isProblemPayload(payload: unknown): payload is ProblemPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    (payload as ProblemPayload).kind === 'problem'
  );
}

function isClassValidatorError(e: unknown): e is ClassValidatorError {
  return typeof e === 'object' && e !== null && 'property' in e;
}

function constraintToEntry(field: string, rule: string, message: string): ErrorEntry {
  return { field, message, rule };
}

function expandValidatorError(e: ClassValidatorError): ErrorEntry[] {
  return Object.entries(e.constraints ?? {}).map(([rule, msg]) =>
    constraintToEntry(e.property, rule, msg),
  );
}

function mapValidationErrors(errors: ClassValidatorError[]): ErrorEntry[] {
  return errors.filter(isClassValidatorError).flatMap(expandValidatorError);
}

function buildValidationProblem(errors: ClassValidatorError[]): ProblemDetails {
  return {
    ...buildProblem(HTTP_STATUS_UNPROCESSABLE, 'validation', 'Unprocessable Entity'),
    errors: mapValidationErrors(errors),
  };
}

function resolveHttpProblem(exc: HttpException): ProblemDetails {
  const response = exc.getResponse();
  if (isValidationPayload(response)) {
    return buildValidationProblem(response.errors);
  }
  if (isProblemPayload(response)) {
    return buildProblem(exc.getStatus(), response.typeSlug, response.title, response.detail);
  }
  const detail = typeof response === 'string' ? response : undefined;
  return buildProblemFromStatus(exc.getStatus(), detail);
}

function resolveQueryFailedProblem(isProd: boolean): ProblemDetails {
  const detail = isProd ? undefined : 'Database query failed';
  return buildProblemFromStatus(HTTP_STATUS_INTERNAL, detail);
}

function resolveGenericProblem(err: Error, isProd: boolean): ProblemDetails {
  const detail = isProd ? undefined : err.message;
  return buildProblemFromStatus(HTTP_STATUS_INTERNAL, detail);
}

function sendProblem(res: Response, status: number, body: ProblemDetails): void {
  res.status(status).set('Content-Type', CONTENT_TYPE_PROBLEM_JSON).json(body);
}

function dispatchProblem(exception: unknown, res: Response, isProd: boolean): void {
  const correlationId = getCorrelationId();
  if (correlationId) {
    res.setHeader('X-Correlation-ID', correlationId);
  }

  if (exception instanceof HttpException) {
    const problem = resolveHttpProblem(exception);
    sendProblem(res, problem.status, problem);
    return;
  }
  if (exception instanceof QueryFailedError) {
    sendProblem(res, HTTP_STATUS_INTERNAL, resolveQueryFailedProblem(isProd));
    return;
  }
  const err = exception instanceof Error ? exception : new Error(String(exception));
  sendProblem(res, HTTP_STATUS_INTERNAL, resolveGenericProblem(err, isProd));
}

@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  constructor(private readonly configService: ConfigService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    dispatchProblem(exception, res, isProd);
  }
}
