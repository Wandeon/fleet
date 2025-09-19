import { EventEmitter } from 'events';
import type { Request, Response } from 'express';
import { metrics } from '../lib/metrics.js';

export const bus = new EventEmitter();

export function sseHandler(req: Request, res: Response) {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders?.();

  metrics.sse_connections.inc();

  const heartbeatMs = Number(process.env.SSE_HEARTBEAT_MS || 15000);
  const ping = setInterval(() => res.write(`:hb\n\n`), heartbeatMs);
  const onEvent = (e: { type: string; data: unknown }) =>
    res.write(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);

  bus.on('state', onEvent);
  bus.on('job', onEvent);

  req.on('close', () => {
    clearInterval(ping);
    bus.off('state', onEvent);
    bus.off('job', onEvent);
    metrics.sse_connections.dec();
  });
}
