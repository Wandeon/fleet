import { nanoid } from 'nanoid';
import { createJob, appendDeviceEvent } from './deviceService.js';

export async function queueDeviceCommand(device, options = {}) {
  const {
    command,
    payload = {},
    request,
    statePatch,
    stateOnError,
    successEvent,
    errorEvent,
    intentEvent,
    markOfflineOnError = false,
    jobId = nanoid(16),
    origin = 'api',
    dedupeKey,
    correlationId = nanoid(12),
  } = options;

  if (!command) throw new Error('command required');
  if (!request || typeof request !== 'object') throw new Error('request definition required');

  const metadata = {
    request,
    statePatch: statePatch || null,
    stateOnError: stateOnError || null,
    successEvent: successEvent || null,
    errorEvent: errorEvent || null,
    markOfflineOnError,
  };

  const { job, created } = await createJob({
    id: jobId,
    deviceId: device.id,
    command,
    payload,
    metadata,
    dedupeKey,
    correlationId,
  });

  if (created) {
    const intentType = intentEvent || `${command}.intent`;
    await appendDeviceEvent(device.id, intentType, payload, {
      jobId: job.id,
      origin,
      correlationId: job.correlationId,
    });
  }

  return { jobId: job.id, correlationId: job.correlationId };
}
