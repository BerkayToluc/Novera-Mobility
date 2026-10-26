import { type ArgumentsHost, Catch, type ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { RateLimitedException } from './rate-limit.js';

// Every error leaves the API in the contract's shape `{ code, message, fieldErrors? }` (openapi.yaml),
// and never carries more than that: no stack, no database text, no parser internals.
//
// - Errors the code raised on purpose already have a `code` and pass through unchanged.
// - Errors from the framework (unknown route, invalid JSON, body too large) get a fixed code and message.
// - Anything else is a bug: it is logged here, on the server, and the caller only sees INTERNAL_ERROR.

export interface ErrorBody {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

const CODES: Record<number, string> = {
  401: 'UNAUTHENTICATED',
  404: 'NOT_FOUND',
  413: 'PAYLOAD_TOO_LARGE',
  429: 'RATE_LIMITED',
};
const MESSAGES: Record<number, string> = {
  400: 'The request is not valid',
  401: 'Sign in to continue',
  403: 'This is not allowed',
  404: 'Not found',
  405: 'This method is not allowed here',
  413: 'The request body is too large',
  415: 'This content type is not supported',
  429: 'Too many requests, try again later',
};

function isCoded(value: unknown): value is ErrorBody {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { code?: unknown }).code === 'string' &&
    typeof (value as { message?: unknown }).message === 'string'
  );
}

function generic(status: number): ErrorBody {
  return { code: CODES[status] ?? 'BAD_REQUEST', message: MESSAGES[status] ?? MESSAGES[400]! };
}

// Nest wraps the JSON parser's errors (invalid JSON, body too large) in HttpException, but an error that
// still arrives as a plain object with a 4xx status is treated the same way.
function clientErrorStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null) return null;
  const { statusCode, status } = error as { statusCode?: unknown; status?: unknown };
  const value = typeof statusCode === 'number' ? statusCode : status;
  return typeof value === 'number' && Number.isInteger(value) && value >= 400 && value < 500 ? value : null;
}

export function describeError(exception: unknown): { status: number; body: ErrorBody } {
  if (exception instanceof HttpException) {
    const status = exception.getStatus();
    const response = exception.getResponse();
    return { status, body: isCoded(response) ? response : generic(status) };
  }
  const status = clientErrorStatus(exception);
  if (status !== null) return { status, body: generic(status) };
  return { status: 500, body: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } };
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Http');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const response = http.getResponse<Response>();
    const request = http.getRequest<Request>();
    const { status, body } = describeError(exception);

    if (status >= 500) {
      // Only the path is logged (never the query string or the body, which can hold a token or a password).
      const detail = exception instanceof Error ? (exception.stack ?? exception.message) : String(exception);
      this.logger.error(`${request.method} ${request.path} answered ${status}`, detail);
    }
    if (response.headersSent) return;
    if (exception instanceof RateLimitedException) response.setHeader('Retry-After', String(exception.retryAfterSeconds));
    response.status(status).json(body);
  }
}
