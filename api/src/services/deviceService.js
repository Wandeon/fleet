import { nanoid } from 'nanoid';
import { prisma } from '../db/client.js';
import { NotFoundError } from '../utils/errors.js';
import { bus, EVENTS } from '../events/bus.js';

const ACTIVE_JOB_STATUSES = ['pending', 'running'];

export async function listDevices() {
  return prisma.device.findMany({ orderBy: { id: 'asc' } });
}

export async function getDevice(deviceId) {
  const device = await prisma.device.findUnique({ where: { id: deviceId } });
  if (!device) throw new NotFoundError(device  not found);
  return device;
}

export async function getDeviceState(deviceId) {
  await ensureDeviceExists(deviceId);
  const state = await prisma.deviceState.findUnique({ where: { deviceId } });
  return state || { deviceId, state: {}, status: 'unknown' };
}

export async function listDeviceStates() {
  return prisma.deviceState.findMany({ orderBy: { updatedAt: 'desc' } });
}

export async function appendDeviceEvent(deviceId, eventType, payload = {}, meta = {}) {
  await ensureDeviceExists(deviceId);
  const event = await prisma.deviceEvent.create({
    data: {
      deviceId,
      eventType,
      payload,
      origin: meta.origin || null,
      jobId: meta.jobId || null,
      correlationId: meta.correlationId || null,
    },
  });
  bus.emit(EVENTS.EVENT_APPENDED, { deviceId, event });
  return event;
}

export async function listDeviceEvents(deviceId, { since, limit = 100 } = {}) {
  const where = {};
  if (deviceId) where.deviceId = deviceId;
  if (since) where.createdAt = { gt: since };
  return prisma.deviceEvent.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function mergeDeviceState(deviceId, patch = {}, meta = {}) {
  await ensureDeviceExists(deviceId);
  const current = await prisma.deviceState.findUnique({ where: { deviceId } });
  const existing = current?.state || {};
  const merged = deepMerge(existing, patch);
  const record = await prisma.deviceState.upsert({
    where: { deviceId },
    update: {
      state: merged,
      status: meta.status ?? current?.status ?? 'unknown',
      lastSeen: meta.lastSeen ?? current?.lastSeen ?? null,
      offlineReason: meta.offlineReason ?? (meta.status === 'online' ? null : current?.offlineReason ?? null),
      updatedAt: new Date(),
    },
    create: {
      deviceId,
      state: merged,
      status: meta.status ?? 'unknown',
      lastSeen: meta.lastSeen ?? null,
      offlineReason: meta.offlineReason ?? null,
    },
  });
  bus.emit(EVENTS.STATE_UPDATED, { deviceId, state: record });
  return record;
}

export async function markDeviceOnline(deviceId, meta = {}) {
  await prisma.device.update({
    where: { id: deviceId },
    data: { online: true, updatedAt: new Date(), lastSeen: meta.lastSeen ?? new Date() },
  });
  await mergeDeviceState(deviceId, {}, { status: 'online', lastSeen: meta.lastSeen ?? new Date(), offlineReason: null });
}

export async function markDeviceOffline(deviceId, reason = 'unknown') {
  await prisma.device.update({
    where: { id: deviceId },
    data: { online: false, updatedAt: new Date() },
  });
  await mergeDeviceState(deviceId, {}, { status: 'offline', offlineReason: reason });
}

export async function createJob({
  id,
  deviceId,
  command,
  payload,
  metadata = {},
  dedupeKey,
  correlationId,
}) {
  await ensureDeviceExists(deviceId);
  if (dedupeKey) {
    const existing = await prisma.job.findFirst({
      where: {
        dedupeKey,
        status: { in: ACTIVE_JOB_STATUSES },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existing) {
      return { job: existing, created: false };
    }
  }

  const job = await prisma.job.create({
    data: {
      id,
      deviceId,
      command,
      payload,
      metadata,
      dedupeKey: dedupeKey || null,
      correlationId: correlationId || nanoid(16),
      status: 'pending',
      attempts: 0,
      nextRunAt: new Date(),
    },
  });
  bus.emit(EVENTS.JOB_CREATED, job);
  return { job, created: true };
}

export async function updateJob(id, data) {
  const job = await prisma.job.update({
    where: { id },
    data,
  });
  bus.emit(EVENTS.JOB_UPDATED, job);
  return job;
}

export async function getJob(id) {
  return prisma.job.findUnique({ where: { id } });
}

async function ensureDeviceExists(deviceId) {
  const exists = await prisma.device.count({ where: { id: deviceId } });
  if (!exists) throw new NotFoundError(device  not found);
}

function deepMerge(target, source) {
  if (Array.isArray(source)) {
    return source.slice();
  }
  if (source && typeof source === 'object') {
    const base = target && typeof target === 'object' ? { ...target } : {};
    for (const [key, value] of Object.entries(source)) {
      base[key] = deepMerge(base[key], value);
    }
    return base;
  }
  return source;
}
