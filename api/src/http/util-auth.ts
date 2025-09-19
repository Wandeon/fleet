import type { Request, Response, NextFunction } from 'express';

export const auth = (token: string) => (req: Request, res: Response, next: NextFunction) => {
  const got = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token || got === token) return next();
  res.status(401).json({ error: 'unauthorized' });
};
