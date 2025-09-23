import client from 'prom-client';
import type { Request, Response, RequestHandler } from 'express';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests processed by the Fleet API',
  labelNames: ['method', 'route', 'status'] as const,
});

const httpRequestDurationMs = new client.Histogram({
  name: 'http_request_duration_ms',
  help: 'Request duration in milliseconds grouped by route',
  labelNames: ['method', 'route'] as const,
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
});

const upstreamDeviceFailuresTotal = new client.Counter({
  name: 'upstream_device_failures_total',
  help: 'Failures when communicating with managed devices',
  labelNames: ['deviceId', 'reason'] as const,
});

const circuitBreakerState = new client.Gauge({
  name: 'circuit_breaker_state',
  help: 'Circuit breaker state per device (0=closed, 1=open)',
  labelNames: ['deviceId'] as const,
});

const jobsSuccess = new client.Counter({ name: 'fleet_jobs_success_total', help: 'Successful jobs' });
const jobsFail = new client.Counter({ name: 'fleet_jobs_fail_total', help: 'Failed jobs' });
const jobsDuration = new client.Histogram({
  name: 'fleet_jobs_duration_seconds',
  help: 'Job execution duration',
  buckets: [0.1, 0.5, 1, 2, 5, 10],
});
const sseConnections = new client.Gauge({ name: 'fleet_sse_connections', help: 'Open SSE connections' });
const deviceOnline = new client.Gauge({
  name: 'fleet_device_online',
  help: 'Device online status (1 online, 0 offline)',
  labelNames: ['device_id'] as const,
});

registry.registerMetric(httpRequestsTotal);
registry.registerMetric(httpRequestDurationMs);
registry.registerMetric(upstreamDeviceFailuresTotal);
registry.registerMetric(circuitBreakerState);
registry.registerMetric(jobsSuccess);
registry.registerMetric(jobsFail);
registry.registerMetric(jobsDuration);
registry.registerMetric(sseConnections);
registry.registerMetric(deviceOnline);

export const metrics = {
  registry,
  httpRequestsTotal,
  http_requests_total: httpRequestsTotal,
  httpRequestDurationMs,
  http_request_duration_ms: httpRequestDurationMs,
  upstreamDeviceFailuresTotal,
  upstream_device_failures_total: upstreamDeviceFailuresTotal,
  circuitBreakerState,
  circuit_breaker_state: circuitBreakerState,
  jobsSuccess,
  jobs_success: jobsSuccess,
  jobsFail,
  jobs_fail: jobsFail,
  jobsDuration,
  jobs_duration: jobsDuration,
  sseConnections,
  sse_connections: sseConnections,
  deviceOnline,
  device_online: deviceOnline,
};

function resolveRouteLabel(req: Request) {
  if (req.route?.path) {
    return `${req.baseUrl || ''}${req.route.path}` || req.originalUrl.split('?')[0];
  }
  return req.originalUrl.split('?')[0] || req.path || 'unknown';
}

export const metricsMiddleware: RequestHandler = (req, res, next) => {
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const route = resolveRouteLabel(req);
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    metrics.httpRequestsTotal.labels(req.method, route, String(res.statusCode)).inc();
    metrics.httpRequestDurationMs.labels(req.method, route).observe(durationMs);
  });

  next();
};

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', registry.contentType);
  res.end(await registry.metrics());
}
