import type { NextFunction, Request, Response } from 'express';
import pino from 'pino';
import { config } from '../config';

const service = process.env.SERVICE_NAME ?? 'fleet-api';

export const logger = pino({
  level: config.LOG_LEVEL,
  base: {
    service
  },
  timestamp: pino.stdTimeFunctions.isoTime
});

declare module 'express-serve-static-core' {
  interface ResponseLocals {
    routePath?: string;
    deviceId?: string;
  }
}

export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  let logged = false;

  const logRequestCompletion = (): void => {
    if (logged) {
      return;
    }
    logged = true;

    const diff = Number(process.hrtime.bigint() - start) / 1_000_000;
    const routeInfo = req.route as { path?: unknown } | undefined;
    const routePath =
      typeof res.locals.routePath === 'string'
        ? res.locals.routePath
        : typeof routeInfo?.path === 'string'
          ? routeInfo.path
          : req.originalUrl;
    const deviceId = typeof res.locals.deviceId === 'string' ? res.locals.deviceId : undefined;
    const correlationId =
      typeof res.locals.correlationId === 'string' ? res.locals.correlationId : req.correlationId;
    logger.info({
      msg: 'request_completed',
      route: routePath,
      method: req.method,
      status: res.statusCode,
      latency_ms: Math.round(diff * 100) / 100,
      deviceId,
      correlationId,
      userAgent: req.headers['user-agent']
    });
  };

  res.on('finish', logRequestCompletion);
  res.on('close', logRequestCompletion);

  next();
}
