import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';
import { prisma } from '../lib/db.js';

const defaultFiles = [
  path.resolve(process.cwd(), 'config/device-interfaces.yaml'),
  path.resolve(process.cwd(), '../inventory/device-interfaces.yaml'),
];

const file =
  process.env.DEVICE_YAML ||
  defaultFiles.find((candidate) => fs.existsSync(candidate)) ||
  defaultFiles[0];

type InventoryDevice = {
  id: string;
  name: string;
  kind?: string;
  managed?: boolean;
  api?: {
    base_url?: string;
    health_path?: string;
    status_path?: string;
    metrics_path?: string;
    auth?: {
      type?: string;
      token_env?: string;
      token?: string;
    };
  };
  address?: {
    baseUrl?: string;
    base_url?: string;
    token?: string;
    tokenEnv?: string;
    token_env?: string;
    healthPath?: string;
    health_path?: string;
    statusPath?: string;
    status_path?: string;
    metricsPath?: string;
    metrics_path?: string;
  };
  management?: unknown;
  endpoints?: unknown;
  monitoring?: unknown;
  operations?: unknown;
  capabilities?: unknown;
};

function selectAddress(device: InventoryDevice) {
  const baseUrl =
    device.api?.base_url ||
    device.address?.baseUrl ||
    device.address?.base_url ||
    undefined;
  const healthPath =
    device.api?.health_path || device.address?.healthPath || device.address?.health_path || undefined;
  const statusPath =
    device.api?.status_path || device.address?.statusPath || device.address?.status_path || undefined;
  const metricsPath =
    device.api?.metrics_path || device.address?.metricsPath || device.address?.metrics_path || undefined;

  const tokenEnv =
    device.api?.auth?.token_env ||
    device.address?.tokenEnv ||
    device.address?.token_env ||
    undefined;
  const token =
    device.api?.auth?.token ||
    device.address?.token ||
    (tokenEnv ? process.env[tokenEnv] : undefined) ||
    undefined;

  const address: Record<string, unknown> = {};
  if (baseUrl) address.baseUrl = baseUrl;
  if (healthPath) address.healthPath = healthPath;
  if (statusPath) address.statusPath = statusPath;
  if (metricsPath) address.metricsPath = metricsPath;
  if (token) address.token = token;
  if (tokenEnv) {
    address.tokenEnv = tokenEnv;
    address.token_env = tokenEnv;
  }

  return address;
}

function buildCapabilities(device: InventoryDevice) {
  if (device.capabilities) return device.capabilities;
  return {
    operations: device.operations || [],
    management: device.management || null,
    endpoints: device.endpoints || [],
    monitoring: device.monitoring || null,
  };
}

(async () => {
  const doc: any = yaml.load(fs.readFileSync(file, 'utf8'));
  for (const device of (doc?.devices as InventoryDevice[]) || []) {
    if (!device?.id) continue;
    await prisma.device.upsert({
      where: { id: device.id },
      update: {
        name: device.name,
        kind: device.kind || 'unknown',
        address: selectAddress(device),
        capabilities: buildCapabilities(device),
        managed: device.managed ?? true,
      },
      create: {
        id: device.id,
        name: device.name,
        kind: device.kind || 'unknown',
        address: selectAddress(device),
        capabilities: buildCapabilities(device),
        managed: device.managed ?? true,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log('Seed complete');
  process.exit(0);
})();
