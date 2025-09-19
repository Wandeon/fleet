import axios from 'axios';
import { prisma } from '../lib/db.js';
import { updateJob } from '../services/jobs.js';
import { metrics } from '../lib/metrics.js';

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

      const { baseUrl, token } = (device.address as any) ?? {};
      if (!baseUrl) throw new Error('device missing baseUrl');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      if (job.command === 'tv.power_on') {
        await axios.post(`${baseUrl}/tv/power_on`, null, { headers, timeout: 5000 });
      } else if (job.command === 'tv.power_off') {
        await axios.post(`${baseUrl}/tv/power_off`, null, { headers, timeout: 5000 });
      } else if (job.command === 'tv.input') {
        await axios.post(`${baseUrl}/tv/input`, job.payload, { headers, timeout: 5000 });
      } else {
        throw new Error(`unsupported command ${job.command}`);
      }

      await updateJob(job.id, 'succeeded', { expectedStatus: 'running' });
      metrics.jobs_success.inc();
      stop();
    } catch (error: any) {
      await updateJob(job.id, 'failed', {
        expectedStatus: 'running',
        error: error?.message || 'error',
      });
      metrics.jobs_fail.inc();
      stop();
    }
  }
}
