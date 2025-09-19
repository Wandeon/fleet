import client from 'prom-client';

export const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const jobCreatedCounter = new client.Counter({
  name: 'fleet_jobs_created_total',
  help: 'Number of command jobs created',
});
export const jobSuccessCounter = new client.Counter({
  name: 'fleet_jobs_success_total',
  help: 'Number of command jobs completed successfully',
});
export const jobErrorCounter = new client.Counter({
  name: 'fleet_jobs_error_total',
  help: 'Number of command jobs that ended in error',
});
export const jobRetryCounter = new client.Counter({
  name: 'fleet_jobs_retry_total',
  help: 'Number of job retries scheduled',
});
export const deviceOfflineCounter = new client.Counter({
  name: 'fleet_device_offline_total',
  help: 'Devices marked offline by the worker',
});
export const sseClientsGauge = new client.Gauge({
  name: 'fleet_sse_clients',
  help: 'Number of active SSE clients',
});

register.registerMetric(jobCreatedCounter);
register.registerMetric(jobSuccessCounter);
register.registerMetric(jobErrorCounter);
register.registerMetric(jobRetryCounter);
register.registerMetric(deviceOfflineCounter);
register.registerMetric(sseClientsGauge);

export function recordJobCreated() {
  jobCreatedCounter.inc();
}

export function recordJobSuccess() {
  jobSuccessCounter.inc();
}

export function recordJobError() {
  jobErrorCounter.inc();
}

export function recordJobRetry() {
  jobRetryCounter.inc();
}

export function recordDeviceOffline() {
  deviceOfflineCounter.inc();
}
