import { prisma } from '../db/client.js';
import { getDevice as getRegistryDevice } from '../utils/deviceRegistry.js';
import { callDeviceEndpoint } from '../utils/deviceHttp.js';
import {
  updateJob,
  appendDeviceEvent,
  mergeDeviceState,
  markDeviceOnline,
  markDeviceOffline,
  getDevice as getDeviceRecord,
  listDevices,
} from '../services/deviceService.js';
import {
  recordJobSuccess,
  recordJobError,
  recordJobRetry,
  recordDeviceOffline,
} from '../metrics/index.js';

const POLL_INTERVAL_MS = parseInt(process.env.WORKER_POLL_INTERVAL_MS || '2000', 10);
const RETRY_BASE_MS = parseInt(process.env.WORKER_RETRY_BASE_MS || '2000', 10);
const MAX_ATTEMPTS = parseInt(process.env.WORKER_MAX_ATTEMPTS || '5', 10);
const RECONCILE_INTERVAL_MS = parseInt(process.env.WORKER_RECONCILE_INTERVAL_MS || '10000', 10);
const OFFLINE_FAILURE_THRESHOLD = parseInt(process.env.WORKER_OFFLINE_THRESHOLD || '3', 10);

let running = false;
let jobTimer = null;
let reconcileTimer = null;
const failureCounts = new Map();

export function startBackgroundWorkers() {
  if (running) return;
  running = true;
  scheduleJobLoop();
  scheduleReconcileLoop();
}

export async function stopBackgroundWorkers() {
  running = false;
  if (jobTimer) clearTimeout(jobTimer);
  if (reconcileTimer) clearTimeout(reconcileTimer);
  jobTimer = null;
  reconcileTimer = null;
}

function scheduleJobLoop() {
  if (!running) return;
  processNextJob()
    .catch((err) => {
      console.error('worker job error', err);
      return false;
    })
    .then((processed) => {
      const delay = processed ? 0 : POLL_INTERVAL_MS;
      jobTimer = setTimeout(scheduleJobLoop, delay);
    });
}

async function processNextJob() {
  const now = new Date();
  const job = await prisma.job.findFirst({
    where: {
      status: 'pending',
      OR: [
        { nextRunAt: null },
        { nextRunAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
  });
  if (!job) return false;

  const attempts = job.attempts + 1;
  await updateJob(job.id, {
    status: 'running',
    attempts,
    lastAttemptAt: new Date(),
  });

  const metadata = job.metadata || {};
  const request = metadata.request;
  if (!request) {
    await failJob(job, 'missing_request', metadata, attempts);
    return true;
  }

  const device = await getDeviceRecord(job.deviceId).catch(() => null);
  if (!device) {
    await failJob(job, 'device_missing', metadata, attempts);
    return true;
  }

  try {
    const result = await callDeviceEndpoint(device, request);
    if (!result.ok) {
      throw new Error(HTTP );
    }

    await updateJob(job.id, {
      status: 'success',
      result: result.data ?? null,
      error: null,
      completedAt: new Date(),
    });
    recordJobSuccess();

    const successEvent = metadata.successEvent || ${job.command}.success;
    await appendDeviceEvent(job.deviceId, successEvent, {
      request: job.payload,
      response: {
        ok: result.ok,
        status: result.status,
        data: result.data ?? null,
      },
    }, { jobId: job.id, origin: 'worker', correlationId: job.correlationId });

    await markDeviceOnline(job.deviceId, { lastSeen: new Date() });
    if (metadata.statePatch) {
      await mergeDeviceState(job.deviceId, metadata.statePatch, { status: 'online', lastSeen: new Date() });
    }
    failureCounts.delete(job.deviceId);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failJob(job, message, metadata, attempts);
  }

  return true;
}

async function failJob(job, message, metadata, attemptNumber) {
  if (attemptNumber >= MAX_ATTEMPTS) {
    await updateJob(job.id, {
      status: 'failed',
      error: message,
      completedAt: new Date(),
    });
    recordJobError();

    const errorEvent = metadata.errorEvent || ${job.command}.error;
    await appendDeviceEvent(job.deviceId, errorEvent, {
      request: job.payload,
      error: message,
    }, { jobId: job.id, origin: 'worker', correlationId: job.correlationId });

    if (metadata.stateOnError) {
      await mergeDeviceState(job.deviceId, metadata.stateOnError, { status: 'offline', offlineReason: message });
    }
    if (metadata.markOfflineOnError) {
      await markDeviceOffline(job.deviceId, message);
      recordDeviceOffline();
    }
  } else {
    const delay = RETRY_BASE_MS * Math.pow(2, attemptNumber - 1);
    await updateJob(job.id, {
      status: 'pending',
      error: message,
      nextRunAt: new Date(Date.now() + delay),
    });
    recordJobRetry();

    const errorEvent = metadata.errorEvent || ${job.command}.error;
    await appendDeviceEvent(job.deviceId, errorEvent, {
      request: job.payload,
      error: message,
      retry_in_ms: delay,
    }, { jobId: job.id, origin: 'worker', correlationId: job.correlationId });
  }

  const count = (failureCounts.get(job.deviceId) || 0) + 1;
  failureCounts.set(job.deviceId, count);
  if (count >= OFFLINE_FAILURE_THRESHOLD) {
    await markDeviceOffline(job.deviceId, message);
    recordDeviceOffline();
  }
}

function scheduleReconcileLoop() {
  if (!running) return;
  reconcileDevices()
    .catch((err) => console.error('reconcile error', err))
    .finally(() => {
      reconcileTimer = setTimeout(scheduleReconcileLoop, RECONCILE_INTERVAL_MS);
    });
}

async function reconcileDevices() {
  const devices = await listDevices();
  await Promise.all(
    devices.map(async (device) => {
      const registry = getRegistryDevice(device.id);
      if (!registry) return;
      const statusPath = registry.api?.status_path || registry.address?.api?.status_path || '/status';
      const hasBase = registry.api?.base_url || device.address?.api?.base_url;
      if (!hasBase) return;
      try {
        const result = await callDeviceEndpoint(device, {
          path: statusPath,
          method: 'GET',
          accept: 'application/json, text/plain;q=0.8',
          timeout: 4000,
        });
        if (!result.ok) throw new Error(HTTP );
        await markDeviceOnline(device.id, { lastSeen: new Date() });
        await mergeDeviceState(device.id, { health: { ok: true, data: result.data ?? null } }, { status: 'online', lastSeen: new Date(), offlineReason: null });
        failureCounts.delete(device.id);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const count = (failureCounts.get(device.id) || 0) + 1;
        failureCounts.set(device.id, count);
        if (count >= OFFLINE_FAILURE_THRESHOLD) {
          await markDeviceOffline(device.id, message);
          recordDeviceOffline();
        }
      }
    })
  );
}
