import { prisma } from '../lib/db.js';
import { log } from '../observability/logging.js';
import { bus } from '../http/sse.js';
import { stringifyJson } from '../lib/json.js';

export async function enqueueJob(deviceId: string, command: string, payload: any) {
  const job = await prisma.$transaction(async (tx) => {
    const created = await tx.job.create({
      data: { deviceId, command, payload: stringifyJson(payload), status: 'pending', error: null },
    });
    await tx.deviceEvent.create({
      data: {
        deviceId,
        eventType: 'command.accepted',
        payload: stringifyJson({ command, payload }),
        origin: 'api',
        correlationId: created.id,
      },
    });
    return created;
  });

  bus.emit('job', { type: 'job', data: { jobId: job.id, status: 'pending' } });
  log.debug({ jobId: job.id, deviceId, command }, 'Job enqueued');
  return job;
}

type JobStatus = 'pending' | 'running' | 'succeeded' | 'failed';

interface UpdateJobOptions {
  error?: string | null;
  expectedStatus?: JobStatus;
}

export async function updateJob(
  jobId: string,
  status: JobStatus,
  { error, expectedStatus }: UpdateJobOptions = {},
) {
  const job = await prisma.$transaction(async (tx) => {
    const where: { id: string; status?: JobStatus } = { id: jobId };
    if (expectedStatus) {
      where.status = expectedStatus;
    }

    const updated = await tx.job.updateMany({
      where,
      data: { status, error: error ?? null },
    });
    if (updated.count === 0) {
      return null;
    }

    const fresh = await tx.job.findUniqueOrThrow({ where: { id: jobId } });
    await tx.deviceEvent.create({
      data: {
        deviceId: fresh.deviceId,
        eventType: `command.${status}`,
        payload: stringifyJson({ command: fresh.command, error }),
        origin: 'worker',
        correlationId: fresh.id,
      },
    });
    return fresh;
  });

  if (!job) {
    log.debug({ jobId, status, expectedStatus }, 'Job update skipped (state changed)');
    return null;
  }

  bus.emit('job', { type: 'job', data: { jobId: job.id, status, error: error ?? undefined } });
  if (status === 'failed') {
    log.warn({ jobId, error }, 'Job failed');
  } else {
    log.debug({ jobId, status }, 'Job updated');
  }
  return job;
}
