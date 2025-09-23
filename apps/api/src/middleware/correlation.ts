import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    correlationId?: string;
  }

  interface ResponseLocals {
    correlationId?: string;
  }
}

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = (req.headers['x-correlation-id'] || req.headers['x-request-id']) as string | undefined;
  const correlationId = incoming && incoming.length > 0 ? incoming : randomUUID();

  req.correlationId = correlationId;
  res.locals.correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);

  next();
}
