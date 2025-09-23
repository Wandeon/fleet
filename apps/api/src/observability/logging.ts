import { randomUUID } from 'node:crypto';
import os from 'node:os';
import type { Request, Response, NextFunction, RequestHandler } from 'express';
import pino from 'pino';
import { getContext, getCorrelationId, runWithContext } from './context.js';

const host = process.env.LOG_HOST || os.hostname();
const service = process.env.LOG_SERVICE || 'fleet-api';
const role = process.env.LOG_ROLE || process.env.ROLE || 'control-plane';
const commit =
  process.env.LOG_COMMIT ||
  process.env.FLEET_COMMIT ||
  process.env.GIT_COMMIT ||
  process.env.COMMIT_SHA ||
  'unknown';

function timestamp() {
  return `,"ts":"${new Date().toISOString()}"`;
}

export const log = pino({
  level: process.env.LOG_LEVEL || 'info',
  timestamp,
  formatters: {
    level(label: string) {
      return { level: label };
    },
    bindings() {
      return { service, host, role, commit };
    },
  },
  hooks: {
    logMethod(args, method) {
      const context = getContext();
      const base = {
        correlationId: context?.correlationId ?? null,
        durationMs: context?.durationMs ?? null,
        errorCode: context?.errorCode ?? null,
      };
      if (typeof args[0] === 'object' && args[0] !== null && !(args[0] instanceof Error)) {
        args[0] = { ...base, ...args[0] };
      } else {
        args.unshift(base);
      }
      return method.apply(this, args);
    },
  },
});

export interface RequestWithCorrelation extends Request {
  correlationId?: string;
  route?: {
    path?: string;
  };
  baseUrl?: string;
}

export const correlationIdMiddleware: RequestHandler = (req, res, next) => {
  const request = req as RequestWithCorrelation;
  const headerValue = req.headers['x-correlation-id'];
  const correlationId =
    typeof headerValue === 'string' && headerValue.trim().length > 0
      ? headerValue.trim()
      : Array.isArray(headerValue) && headerValue.length > 0
        ? headerValue[0]
        : randomUUID();

  request.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  runWithContext({ correlationId }, () => {
    next();
  });
};

export function requestLogger(): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const request = req as RequestWithCorrelation;
    const start = process.hrtime.bigint();

    res.on('finish', () => {
      const end = process.hrtime.bigint();
      const durationMs = Number(end - start) / 1_000_000;
      const roundedDuration = Math.round(durationMs * 100) / 100;

      const routePath = request.route?.path
        ? `${request.baseUrl || ''}${request.route.path}`
        : req.originalUrl.split('?')[0];
      const payload = {
        method: req.method,
        route: routePath,
        status: res.statusCode,
        durationMs: roundedDuration,
        correlationId: request.correlationId || getCorrelationId() || null,
        errorCode: res.statusCode >= 400 ? String(res.statusCode) : null,
      };

      if (res.statusCode >= 500) {
        log.error(payload, 'HTTP request failed');
      } else if (res.statusCode >= 400) {
        log.warn(payload, 'HTTP request warning');
      } else {
        log.info(payload, 'HTTP request completed');
      }
    });

    next();
  };
}

export function withCorrelation<T>(correlationId: string, fn: () => T): T {
  return runWithContext({ correlationId }, fn);
}

export function getRequestCorrelationId(): string | undefined {
  return getCorrelationId();
}
