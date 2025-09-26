import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { config } from '../config';
import { createHttpError } from '../util/errors';

const deviceSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  kind: z.string().optional(),
  module: z.string().optional(),
  baseUrl: z.string().url(),
  token: z.string().optional(),
  tokenEnv: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const registrySchema = z.object({
  devices: z.array(deviceSchema),
});

export type DeviceDocument = z.infer<typeof deviceSchema>;
export type DeviceRegistryDocument = z.infer<typeof registrySchema>;

export interface Device extends Omit<DeviceDocument, 'token' | 'tokenEnv'> {
  authToken?: string;
  module: string;
  capabilities: string[];
}

class DeviceRegistry {
  private devices = new Map<string, Device>();
  private ready = false;
  private lastError?: Error;
  private lastLoadedAt?: Date;

  load(document: DeviceRegistryDocument): void {
    this.devices.clear();
    for (const item of document.devices) {
      const authToken = item.token ?? (item.tokenEnv ? process.env[item.tokenEnv] : undefined);
      const device: Device = {
        ...item,
        module: item.module ?? item.role,
        capabilities: item.capabilities ?? [],
        authToken,
      };
      this.devices.set(device.id, device);
    }

    this.ready = true;
    this.lastError = undefined;
    this.lastLoadedAt = new Date();
  }

  loadFromEnv(): void {
    try {
      const raw = config.DEVICE_REGISTRY_JSON
        ? config.DEVICE_REGISTRY_JSON
        : readFileSync(resolve(config.DEVICE_REGISTRY_PATH ?? ''), 'utf8');
      const parsed = registrySchema.parse(JSON.parse(raw));
      this.load(parsed);
    } catch (error) {
      this.devices.clear();
      this.ready = false;
      this.lastError = error as Error;
    }
  }

  getDevice(id: string): Device | undefined {
    return this.devices.get(id);
  }

  requireDevice(id: string): Device {
    const device = this.getDevice(id);
    if (!device) {
      throw createHttpError(404, 'not_found', `Device ${id} not found`);
    }
    return device;
  }

  list(): Device[] {
    return Array.from(this.devices.values());
  }

  listByRole(role: string): Device[] {
    return this.list().filter((device) => device.role === role);
  }

  isReady(): boolean {
    return this.ready;
  }

  getLastError(): Error | undefined {
    return this.lastError;
  }

  getLastLoadedAt(): Date | undefined {
    return this.lastLoadedAt;
  }
}

export const deviceRegistry = new DeviceRegistry();

export function initializeRegistry(): void {
  deviceRegistry.loadFromEnv();
}

export function setRegistryForTests(document: DeviceRegistryDocument): void {
  deviceRegistry.load(document);
}
