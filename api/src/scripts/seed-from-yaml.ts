import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { prisma } from '../lib/db.js';

const file = process.env.DEVICE_YAML || path.resolve(process.cwd(), 'config/device-interfaces.yaml');

(async () => {
  const doc: any = yaml.load(fs.readFileSync(file, 'utf8'));
  for (const device of doc?.devices || []) {
    await prisma.device.upsert({
      where: { id: device.id },
      update: {
        name: device.name,
        kind: device.kind,
        address: device.address,
        capabilities: device.capabilities,
        managed: device.managed ?? true,
      },
      create: {
        id: device.id,
        name: device.name,
        kind: device.kind,
        address: device.address,
        capabilities: device.capabilities,
        managed: device.managed ?? true,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log('Seed complete');
  process.exit(0);
})();
