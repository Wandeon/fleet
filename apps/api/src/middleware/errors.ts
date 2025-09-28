import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { MulterError } from 'multer';
import { logger } from './logging';
import { createHttpError, isHttpError } from '../util/errors';

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let httpError = isHttpError(err) ? err : undefined;

  if (!httpError) {
    if (err instanceof MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        httpError = createHttpError(400, 'file_too_large', 'File too large. Maximum size is 50 MB.');
      } else {
        httpError = createHttpError(400, 'bad_request', err.message);
      }
    } else if (err instanceof ZodError) {
      httpError = createHttpError(422, 'validation_failed', 'Request validation failed', {
        details: err.flatten(),
      });
    } else {
      httpError = createHttpError(500, 'internal_error', 'Unexpected error occurred', {
        cause: err,
      });
    }
  }

  const correlationIdSource =
    typeof res.locals.correlationId === 'string' ? res.locals.correlationId : req.correlationId;
  const correlationId = correlationIdSource ?? undefined;
  const routeInfo = req.route as { path?: unknown } | undefined;
  const routePath =
    typeof res.locals.routePath === 'string'
      ? res.locals.routePath
      : typeof routeInfo?.path === 'string'
        ? routeInfo.path
        : req.originalUrl;
  const deviceId = typeof res.locals.deviceId === 'string' ? res.locals.deviceId : undefined;

  const payload = {
    code: httpError.code,
    message: httpError.message,
    hint: httpError.hint,
    correlationId,
  };

  logger.error({
    msg: 'request_failed',
    route: routePath,
    method: req.method,
    status: httpError.status,
    deviceId,
    correlationId,
    error: {
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    },
  });

  res.status(httpError.status).json(payload);
};
