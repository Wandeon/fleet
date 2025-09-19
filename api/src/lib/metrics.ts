import client from 'prom-client';
import type { Request, Response } from 'express';

const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const metrics = {
  jobs_success: new client.Counter({ name: 'fleet_jobs_success_total', help: 'Jobs ok' }),
  jobs_fail: new client.Counter({ name: 'fleet_jobs_fail_total', help: 'Jobs failed' }),
  jobs_duration: new client.Histogram({
    name: 'fleet_jobs_duration_seconds',
    help: 'Job duration',
    buckets: [0.1, 0.5, 1, 2, 5, 10],
  }),
  sse_connections: new client.Gauge({ name: 'fleet_sse_connections', help: 'Open SSE' }),
  device_online: new client.Gauge({
    name: 'fleet_device_online',
    help: 'Online=1 Offline=0',
    labelNames: ['device_id'],
  }),
  registry,
};

registry.registerMetric(metrics.jobs_success);
registry.registerMetric(metrics.jobs_fail);
registry.registerMetric(metrics.jobs_duration);
registry.registerMetric(metrics.sse_connections);
registry.registerMetric(metrics.device_online);

export async function metricsHandler(_req: Request, res: Response) {
  res.set('Content-Type', metrics.registry.contentType);
  res.end(await metrics.registry.metrics());
}
