import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'change-me-in-production';

export const auth = (apiBearer: string) => (req: Request, res: Response, next: NextFunction) => {
  // Skip auth if no API bearer token is configured
  if (!apiBearer) return next();

  // Check for bearer token first (API clients)
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // Check if it's the API bearer token
    if (token === apiBearer) {
      return next();
    }

    // Check if it's a JWT token
    try {
      jwt.verify(token, JWT_SECRET);
      return next();
    } catch (error) {
      // Invalid JWT, continue to check other auth methods
    }
  }

  // Check for query token (fallback)
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  if (queryToken === apiBearer) {
    return next();
  }

  // Check for session cookie (browser flows)
  const sessionCookie = req.cookies?.session;
  if (sessionCookie) {
    try {
      jwt.verify(sessionCookie, JWT_SECRET);
      return next();
    } catch (error) {
      // Invalid session cookie
    }
  }

  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({
    error: {
      code: 'UNAUTHORIZED',
      message: 'Authentication required'
    }
  });
};
