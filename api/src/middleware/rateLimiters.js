import rateLimit from 'express-rate-limit';
export const limitHealth = rateLimit({ windowMs: 60_000, max: 30 });
export const limitLogs   = rateLimit({ windowMs: 60_000, max: 30 });

