import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { correlationIdMiddleware } from '../../src/middleware/correlation';

describe('correlationIdMiddleware', () => {
  const createContext = (incoming?: string) => {
    const req = {
      headers: incoming ? { 'x-correlation-id': incoming } : {},
      correlationId: undefined,
    } as unknown as Request;
    const res = {
      locals: {},
      setHeader: vi.fn(),
    } as unknown as Response;
    return { req, res };
  };

  it('uses incoming correlation id when provided', () => {
    const { req, res } = createContext('abc-123');
    correlationIdMiddleware(req, res, () => undefined);
    expect(req.correlationId).toBe('abc-123');
    expect(res.locals.correlationId).toBe('abc-123');
    expect(res.setHeader).toHaveBeenCalledWith('x-correlation-id', 'abc-123');
  });

  it('generates a correlation id when missing', () => {
    const { req, res } = createContext();
    correlationIdMiddleware(req, res, () => undefined);
    expect(req.correlationId).toBeDefined();
    expect(res.setHeader).toHaveBeenCalled();
  });
});
