export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'validation_failed'
  | 'upstream_timeout'
  | 'upstream_unreachable'
  | 'upstream_error'
  | 'conflict'
  | 'too_many_requests'
  | 'internal_error'
  | 'circuit_open'
  | 'file_too_large'
  | 'device_busy'
  | 'invalid_input'
  | 'missing_media_url'
  | 'invalid_state'
  | 'invalid_action';

export interface HttpErrorOptions {
  hint?: string;
  details?: unknown;
  cause?: unknown;
}

export class HttpError extends Error {
  public readonly status: number;
  public readonly code: ErrorCode;
  public readonly hint?: string;
  public readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, options?: HttpErrorOptions) {
    super(message);
    if (options?.cause !== undefined) {
      (this as { cause?: unknown }).cause = options.cause;
    }
    this.status = status;
    this.code = code;
    this.hint = options?.hint;
    this.details = options?.details;
  }
}

export function createHttpError(
  status: number,
  code: ErrorCode,
  message: string,
  options?: HttpErrorOptions
): HttpError {
  return new HttpError(status, code, message, options);
}

export function isHttpError(error: unknown): error is HttpError {
  return error instanceof HttpError;
}

export interface UpstreamErrorContext {
  deviceId: string;
  operation: string;
}

export type UpstreamFailureReason = 'timeout' | 'unreachable' | 'http' | 'circuit_open' | 'unknown';

export interface UpstreamError extends HttpError {
  reason: UpstreamFailureReason;
}

export function mapUpstreamError(error: unknown, context: UpstreamErrorContext): UpstreamError {
  if (isHttpError(error)) {
    if ('reason' in error) {
      return error as UpstreamError;
    }

    return Object.assign(error, { reason: 'http' as UpstreamFailureReason });
  }

  if (error instanceof Error) {
    const original = error as NodeJS.ErrnoException;
    const causeCandidate = (original as { cause?: unknown }).cause;
    const causeError = (causeCandidate as NodeJS.ErrnoException | undefined) ?? undefined;
    const causeCode = original.code ?? causeError?.code;
    const errorName = original.name ?? causeError?.name;
    const message = [original.message, causeError?.message].filter(Boolean).join(' ').toUpperCase();

    if (causeCode === 'ETIMEDOUT' || causeCode === 'ABORT_ERR' || errorName === 'AbortError') {
      return Object.assign(
        createHttpError(
          504,
          'upstream_timeout',
          `Device ${context.deviceId} timed out during ${context.operation}`,
          {
            cause: error,
          }
        ),
        { reason: 'timeout' as UpstreamFailureReason }
      );
    }

    const unreachableCodes = ['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH'];
    const unreachableDetected =
      (causeCode && unreachableCodes.includes(causeCode)) ||
      unreachableCodes.some((code) => message.includes(code));

    if (unreachableDetected) {
      return Object.assign(
        createHttpError(502, 'upstream_unreachable', `Device ${context.deviceId} is unreachable`, {
          cause: error,
        }),
        { reason: 'unreachable' as UpstreamFailureReason }
      );
    }
  }

  return Object.assign(
    createHttpError(
      502,
      'upstream_error',
      `Device ${context.deviceId} failed during ${context.operation}`,
      {
        cause: error,
      }
    ),
    { reason: 'unknown' as UpstreamFailureReason }
  );
}
