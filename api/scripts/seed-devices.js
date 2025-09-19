import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { fileURLToPath } from 'url';
import { prisma, disconnectPrisma } from '../src/db/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..', '..');
const inventoryFile = path.join(ROOT, 'inventory', 'device-interfaces.yaml');

async function main() {
  const raw = fs.readFileSync(inventoryFile, 'utf-8');
  const parsed = YAML.parse(raw);
  const devices = Array.isArray(parsed?.devices) ? parsed.devices : [];
  let count = 0;
  for (const entry of devices) {
    if (!entry?.id) continue;
    const id = entry.id;
    const kind = entry.kind || entry.role || 'device';
    const role = entry.role || null;
    const name = entry.name || id;
    const capabilities = deriveCapabilities(entry);
    const address = buildAddress(entry);
    await prisma.device.upsert({
      where: { id },
      update: {
        kind,
        role,
        name,
        alias: entry.alias || null,
        address,
        capabilities,
        updatedAt: new Date(),
      },
      create: {
        id,
        kind,
        role,
        name,
        alias: entry.alias || null,
        address,
        capabilities,
      },
    });
    await prisma.deviceState.upsert({
      where: { deviceId: id },
      update: {},
      create: {
        deviceId: id,
        state: {},
        status: 'unknown',
      },
    });
    count += 1;
  }
  console.log(`Seeded ${count} devices.`);
}

function buildAddress(entry) {
  const api = entry.api || {};
  const endpoints = entry.endpoints || [];
  return {
    api,
    endpoints,
    management: entry.management || {},
    monitoring: entry.monitoring || {},
  };
}

function deriveCapabilities(entry) {
  const caps = new Set();
  if (Array.isArray(entry?.operations)) {
    for (const op of entry.operations) {
      if (op?.id) caps.add(op.id);
    }
  }
  if (entry.kind === 'video' || entry.role === 'hdmi-media') {
    caps.add('tv.power');
    caps.add('tv.input');
    caps.add('media.playback');
  }
  if (entry.kind === 'audio' || entry.role === 'audio-player') {
    caps.add('audio.playback');
  }
  if (entry.kind === 'camera') {
    caps.add('camera.stream');
  }
  if (entry.role === 'zigbee') {
    caps.add('zigbee');
  }
  return Array.from(caps);
}

main()
  .catch((err) => {
    console.error('Failed to seed devices:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
  });
