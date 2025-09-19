import { prisma } from '../lib/db.js';
import { log } from '../lib/logger.js';
import { bus } from '../http/sse.js';

export async function enqueueJob(deviceId: string, command: string, payload: any) {
  const job = await prisma.job.create({ data: { deviceId, command, payload, status: 'pending' } });
  await prisma.deviceEvent.create({
    data: {
      deviceId,
      eventType: 'command.accepted',
      payload: { command, payload },
      origin: 'api',
      correlationId: job.id,
    },
  });
  bus.emit('job', { type: 'job', data: { jobId: job.id, status: 'pending' } });
  log.debug({ jobId: job.id, deviceId, command }, 'Job enqueued');
  return job;
}

export async function updateJob(
  jobId: string,
  status: 'running' | 'succeeded' | 'failed',
  error?: string,
) {
  const job = await prisma.job.update({ where: { id: jobId }, data: { status, error } });
  await prisma.deviceEvent.create({
    data: {
      deviceId: job.deviceId,
      eventType: `command.${status}`,
      payload: { command: job.command, error },
      origin: 'worker',
      correlationId: job.id,
    },
  });
  bus.emit('job', { type: 'job', data: { jobId: job.id, status, error } });
  if (status === 'failed') {
    log.warn({ jobId, error }, 'Job failed');
  } else {
    log.debug({ jobId, status }, 'Job updated');
  }
  return job;
}
