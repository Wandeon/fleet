import { prisma } from '../lib/db.js';
import { bus } from '../http/sse.js';
import { metrics } from '../lib/metrics.js';

export async function upsertDeviceState(deviceId: string, patch: Record<string, unknown>) {
  const existing = await prisma.deviceState.findFirst({
    where: { deviceId },
    orderBy: { updatedAt: 'desc' },
  });
  const state = existing?.state ?? {};
  const merged = { ...state, ...patch };
  const saved = await prisma.deviceState.create({
    data: {
      deviceId,
      status: (merged as any).status || 'online',
      lastSeen: new Date(),
      state: merged,
    },
  });
  bus.emit('state', { type: 'state', data: { deviceId, state: saved } });
  metrics.device_online.set({ device_id: deviceId }, saved.status === 'online' ? 1 : 0);
  return saved;
}
