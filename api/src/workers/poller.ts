import axios from 'axios';
import { prisma } from '../lib/db.js';
import { upsertDeviceState } from '../services/devices.js';

export async function pollOnce() {
  const devices = await prisma.device.findMany({ where: { managed: true } });
  await Promise.all(
    devices.map(async (device) => {
      const { baseUrl, token } = (device.address as any) ?? {};
      if (!baseUrl) return;
      try {
        const headers = token ? { Authorization: `Bearer ${token}` } : {};
        const [health, status] = await Promise.allSettled([
          axios.get(`${baseUrl}/health`, { headers, timeout: 3000 }),
          axios.get(`${baseUrl}/status`, { headers, timeout: 3000 }),
        ]);

        const ok = health.status === 'fulfilled' && health.value?.data?.ok !== false;
        const snapshot = status.status === 'fulfilled' ? status.value.data : {};

        await upsertDeviceState(device.id, {
          status: ok ? 'online' : 'offline',
          lastHealth: ok ? 'ok' : 'fail',
          snapshot,
        });
      } catch (error) {
        await upsertDeviceState(device.id, { status: 'offline' });
      }
    }),
  );
}
