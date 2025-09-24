import { prisma } from '../lib/db.js';
import { bus } from '../http/sse.js';
import { metrics } from '../observability/metrics.js';
import { parseJsonOr, stringifyJson } from '../lib/json.js';

export async function upsertDeviceState(deviceId: string, patch: Record<string, unknown>) {
  const existing = await prisma.deviceState.findFirst({
    where: { deviceId },
    orderBy: { updatedAt: 'desc' },
  });
  const state = parseJsonOr<Record<string, unknown>>(existing?.state, {});
  const { lastSeen, ...rest } = patch;
  const merged = { ...state, ...rest } as Record<string, unknown>;

  let lastSeenDate: Date | null = null;
  if (typeof lastSeen === 'string' || lastSeen instanceof Date) {
    const parsed = new Date(lastSeen);
    if (!Number.isNaN(parsed.getTime())) {
      lastSeenDate = parsed;
      merged.lastSeen = parsed.toISOString();
    }
  }

  const status = (rest as any).status || (state as any).status || existing?.status || 'online';
  if (!lastSeenDate) {
    if (status === 'online') {
      lastSeenDate = new Date();
      merged.lastSeen = lastSeenDate.toISOString();
    } else if (existing?.lastSeen) {
      lastSeenDate = existing.lastSeen;
      merged.lastSeen = existing.lastSeen.toISOString();
    }
  }

  const saved = await prisma.deviceState.create({
    data: {
      deviceId,
      status,
      lastSeen: lastSeenDate,
      state: stringifyJson(merged),
    },
  });
  const serialized = {
    ...saved,
    state: merged,
  };
  bus.emit('state', { type: 'state', data: { deviceId, state: serialized } });
  metrics.device_online.set({ device_id: deviceId }, saved.status === 'online' ? 1 : 0);
  return serialized;
}
