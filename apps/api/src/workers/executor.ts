import axios from 'axios';
import { prisma } from '../lib/db.js';
import { updateJob } from '../services/jobs.js';
import { metrics } from '../observability/metrics.js';
import { joinDeviceUrl, normalizeAddress, resolveBearerToken } from '../lib/device-address.js';
import { parseJsonOr } from '../lib/json.js';

export async function runPendingJobsOnce() {
  const jobs = await prisma.job.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    take: 20,
  });
  for (const job of jobs) {
    const claimed = await updateJob(job.id, 'running', { expectedStatus: 'pending' });
    if (!claimed) {
      continue;
    }

    const stop = metrics.jobs_duration.startTimer();
    try {
      const device = await prisma.device.findUnique({ where: { id: job.deviceId } });
      if (!device) throw new Error('device not found');

      const address = normalizeAddress(parseJsonOr<Record<string, unknown>>(device.address, {}));
      const baseUrl = address.baseUrl;
      if (!baseUrl) throw new Error('device missing baseUrl');

      const token = resolveBearerToken(address);
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const post = async (path: string, payload: any = null) =>
        axios.post(joinDeviceUrl(baseUrl, path), payload, { headers, timeout: 5000 });

      if (job.command === 'tv.power_on') {
        await post('/tv/power_on');
      } else if (job.command === 'tv.power_off') {
        await post('/tv/power_off');
      } else if (job.command === 'tv.input') {
        const payload = parseJsonOr<Record<string, unknown>>(job.payload, {});
        await post('/tv/input', payload);
      } else {
        throw new Error(`unsupported command ${job.command}`);
      }

      await updateJob(job.id, 'succeeded', { expectedStatus: 'running' });
      metrics.jobs_success.inc();
      metrics.circuit_breaker_state.set({ deviceId: job.deviceId }, 0);
      stop();
    } catch (error: any) {
      await updateJob(job.id, 'failed', {
        expectedStatus: 'running',
        error: error?.message || 'error',
      });
      metrics.jobs_fail.inc();
      const reason = axios.isAxiosError(error)
        ? error.code || String(error.response?.status || 'axios')
        : error instanceof Error
          ? error.name || 'error'
          : 'unknown';
      metrics.upstream_device_failures_total.labels(job.deviceId, reason).inc();
      metrics.circuit_breaker_state.set({ deviceId: job.deviceId }, 1);
      stop();
    }
  }
}
