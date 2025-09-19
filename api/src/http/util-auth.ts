import type { Request, Response, NextFunction } from 'express';

export const auth = (token: string) => (req: Request, res: Response, next: NextFunction) => {
  if (!token) return next();

  const header = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const queryToken = typeof req.query?.token === 'string' ? req.query.token : undefined;
  if (header === token || queryToken === token) return next();

  res.setHeader('WWW-Authenticate', 'Bearer');
  res.status(401).json({ error: 'unauthorized' });
};
