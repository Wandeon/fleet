import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { createHttpError } from '../util/errors';

export interface AuthContext {
  token: string;
  scopes: string[];
}

declare module 'express-serve-static-core' {
  interface ResponseLocals {
    auth?: AuthContext;
  }
}

export function bearerAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return next(createHttpError(401, 'unauthorized', 'Missing bearer token'));
  }

  const [scheme, token] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !token) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    return next(createHttpError(401, 'unauthorized', 'Invalid Authorization header format'));
  }

  if (token !== config.API_BEARER) {
    res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
    return next(createHttpError(401, 'unauthorized', 'Invalid bearer token'));
  }

  res.locals.auth = {
    token,
    scopes: []
  };

  return next();
}
