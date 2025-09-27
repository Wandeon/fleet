import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { Registry, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';

import type { UpstreamFailureReason } from '../util/errors';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

const sanitizeRoute = (route?: string): string => {
  if (!route) {
    return 'unknown';
  }

  return route.replace(/:(\w+)/g, ':param');
};

export const httpRequestsTotal = new Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed by the Fleet API',
  labelNames: ['method', 'route', 'status'],
  registers: [registry],
});

const httpRequestDurationMs = new Histogram({
  name: 'http_request_duration_ms',
  help: 'Duration histogram of HTTP requests',
  labelNames: ['method', 'route'],
  buckets: [10, 50, 100, 250, 500, 1000, 2000, 5000, 10000],
  registers: [registry],
});

const upstreamDeviceFailuresTotal = new Counter({
  name: 'upstream_device_failures_total',
  help: 'Total number of upstream device failures by reason',
  labelNames: ['deviceId', 'reason'],
  registers: [registry],
});

const circuitBreakerStateGauge = new Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state per device (0 = closed, 1 = open)',
  labelNames: ['deviceId'],
  registers: [registry],
});

const deviceOnlineGauge = new Gauge({
  name: 'device_online',
  help: 'Device online status (1 = online, 0 = offline)',
  labelNames: ['device_id'],
  registers: [registry],
});

const cameraStreamOnlineGauge = new Gauge({
  name: 'camera_stream_online',
  help: 'Camera stream availability (1 = online, 0 = offline)',
  labelNames: ['camera_id'],
  registers: [registry],
});

const sseConnectionsGauge = new Gauge({
  name: 'sse_connections',
  help: 'Number of active Server-Sent Events connections',
  registers: [registry],
});

const jobsDurationHistogram = new Histogram({
  name: 'jobs_duration_ms',
  help: 'Duration histogram for job execution times',
  labelNames: ['deviceId'],
  buckets: [50, 100, 250, 500, 1000, 2000, 5000, 10000],
  registers: [registry],
});

const jobsSuccessCounter = new Counter({
  name: 'jobs_success_total',
  help: 'Total number of successfully executed jobs',
  registers: [registry],
});

const jobsFailCounter = new Counter({
  name: 'jobs_fail_total',
  help: 'Total number of failed jobs',
  registers: [registry],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const routeInfo = req.route as { path?: unknown } | undefined;
    const rawRoute =
      typeof res.locals.routePath === 'string'
        ? res.locals.routePath
        : typeof routeInfo?.path === 'string'
          ? routeInfo.path
          : req.originalUrl;
    const route = sanitizeRoute(rawRoute);
    const status = String(res.statusCode);
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;

    httpRequestsTotal.labels(req.method, route, status).inc();
    httpRequestDurationMs.labels(req.method, route).observe(durationMs);
  });

  next();
}

export const metricsHandler: RequestHandler = async (_req, res) => {
  res.setHeader('Content-Type', registry.contentType);
  res.send(await registry.metrics());
};

export function recordUpstreamFailure(deviceId: string, reason: UpstreamFailureReason): void {
  upstreamDeviceFailuresTotal.labels(deviceId, reason).inc();
}

export function setCircuitBreakerState(deviceId: string, open: boolean): void {
  circuitBreakerStateGauge.labels(deviceId).set(open ? 1 : 0);
}

export function resetMetricsForTest(): void {
  registry.resetMetrics();
}

export const metrics = {
  http_requests_total: httpRequestsTotal,
  http_request_duration_ms: httpRequestDurationMs,
  upstream_device_failures_total: upstreamDeviceFailuresTotal,
  circuit_breaker_state: circuitBreakerStateGauge,
  device_online: deviceOnlineGauge,
  camera_stream_online: cameraStreamOnlineGauge,
  sse_connections: sseConnectionsGauge,
  jobs_duration: jobsDurationHistogram,
  jobs_success: jobsSuccessCounter,
  jobs_fail: jobsFailCounter,
};
