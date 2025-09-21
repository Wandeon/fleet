import type { Response } from 'express';

export function httpError(res: Response, status: number, code: string, message: string, details?: any) {
  return res.status(status).json({
    error: {
      code,
      message,
      details
    }
  });
}