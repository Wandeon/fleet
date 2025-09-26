import type { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { createHttpError } from '../util/errors';

interface Bucket {
  tokens: number;
  lastRefill: number;
}

const windowMs = config.RATE_LIMIT_WINDOW_MS;
const ipCapacity = config.RATE_LIMIT_BURST;
const ipRefillRate = config.RATE_LIMIT_MAX / windowMs;
const globalCapacity = config.RATE_LIMIT_GLOBAL_MAX;
const globalRefillRate = config.RATE_LIMIT_GLOBAL_MAX / windowMs;

const ipBuckets = new Map<string, Bucket>();
const globalBucket: Bucket = {
  tokens: globalCapacity,
  lastRefill: Date.now(),
};

function refill(bucket: Bucket, now: number, refillRate: number, capacity: number): void {
  const elapsed = now - bucket.lastRefill;
  if (elapsed <= 0) {
    return;
  }
  const tokensToAdd = elapsed * refillRate;
  bucket.tokens = Math.min(capacity, bucket.tokens + tokensToAdd);
  bucket.lastRefill = now;
}

function getOrCreateBucket(map: Map<string, Bucket>, key: string, capacity: number): Bucket {
  const existing = map.get(key);
  if (existing) {
    return existing;
  }

  const bucket: Bucket = {
    tokens: capacity,
    lastRefill: Date.now(),
  };
  map.set(key, bucket);
  return bucket;
}

function secondsUntilRefill(bucket: Bucket, capacity: number, refillRate: number): number {
  if (bucket.tokens >= capacity) {
    return 0;
  }
  const missing = capacity - bucket.tokens;
  const millis = missing / refillRate;
  return Math.ceil(millis / 1000);
}

export function rateLimit(req: Request, res: Response, next: NextFunction): void {
  const now = Date.now();
  const key = req.ip ?? req.socket.remoteAddress ?? 'unknown';

  const ipBucket = getOrCreateBucket(ipBuckets, key, ipCapacity);
  refill(ipBucket, now, ipRefillRate, ipCapacity);
  refill(globalBucket, now, globalRefillRate, globalCapacity);

  const canConsumeIp = ipBucket.tokens >= 1;
  const canConsumeGlobal = globalBucket.tokens >= 1;

  if (!canConsumeIp || !canConsumeGlobal) {
    res.setHeader('Retry-After', '1');
    res.setHeader('X-RateLimit-Limit', String(config.RATE_LIMIT_MAX));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Math.floor(ipBucket.tokens))));
    res.setHeader(
      'X-RateLimit-Reset',
      String(secondsUntilRefill(ipBucket, ipCapacity, ipRefillRate))
    );
    return next(createHttpError(429, 'too_many_requests', 'Too many requests'));
  }

  ipBucket.tokens -= 1;
  globalBucket.tokens -= 1;

  res.setHeader('X-RateLimit-Limit', String(config.RATE_LIMIT_MAX));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, Math.floor(ipBucket.tokens))));
  res.setHeader(
    'X-RateLimit-Reset',
    String(secondsUntilRefill(ipBucket, ipCapacity, ipRefillRate))
  );

  next();
}
