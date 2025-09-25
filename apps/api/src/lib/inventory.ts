import fs from 'node:fs';
import path from 'node:path';
import yaml from 'js-yaml';

export interface InventoryDevice {
  role: string;
  logs?: boolean;
  lokiSource?: string;
  logLabels?: Record<string, string>;
  displayName?: string;
}

export interface InventoryLogSource {
  id: string;
  host: string;
  labels: Record<string, string>;
  role?: string;
  displayName?: string;
}

type InventoryFile = {
  devices?: Record<string, any>;
};

const INVENTORY_PATH =
  process.env.DEVICES_INVENTORY_PATH || path.resolve(process.cwd(), '../inventory/devices.yaml');

let cached: { mtimeMs: number; devices: Record<string, InventoryDevice> } | null = null;

function coerceBoolean(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  return undefined;
}

function coerceRecord(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const output: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (raw == null) continue;
    output[key] = String(raw);
  }
  return Object.keys(output).length ? output : undefined;
}

function normalizeDevice(entry: Record<string, unknown> | undefined): InventoryDevice | null {
  if (!entry || typeof entry !== 'object') return null;
  const role = typeof entry.role === 'string' ? entry.role : '';
  if (!role) return null;

  const logsValue =
    coerceBoolean((entry as any).logs) ??
    coerceBoolean((entry as any).log) ??
    coerceBoolean((entry as any).logging);

  const lokiSource =
    typeof (entry as any).loki_source === 'string'
      ? (entry as any).loki_source
      : typeof (entry as any).lokiSource === 'string'
        ? (entry as any).lokiSource
        : typeof (entry as any).log_source === 'string'
          ? (entry as any).log_source
          : typeof (entry as any).logSource === 'string'
            ? (entry as any).logSource
            : undefined;

  const logLabels =
    coerceRecord((entry as any).loki_labels) ||
    coerceRecord((entry as any).lokiLabels) ||
    coerceRecord((entry as any).log_labels) ||
    coerceRecord((entry as any).logLabels) ||
    undefined;

  const displayName =
    typeof (entry as any).display_name === 'string'
      ? (entry as any).display_name
      : typeof (entry as any).displayName === 'string'
        ? (entry as any).displayName
        : typeof (entry as any).name === 'string'
          ? (entry as any).name
          : undefined;

  return {
    role,
    logs: logsValue,
    lokiSource,
    logLabels,
    displayName,
  };
}

export function loadInventoryDevices(): Record<string, InventoryDevice> {
  try {
    const stats = fs.statSync(INVENTORY_PATH);
    if (cached && cached.mtimeMs === stats.mtimeMs) {
      return cached.devices;
    }

    const text = fs.readFileSync(INVENTORY_PATH, 'utf8');
    const parsed = yaml.load(text) as InventoryFile | undefined;
    const devices: Record<string, InventoryDevice> = {};
    if (parsed?.devices && typeof parsed.devices === 'object') {
      for (const [id, value] of Object.entries(parsed.devices)) {
        const normalized = normalizeDevice(value as Record<string, unknown>);
        if (normalized) {
          devices[id] = normalized;
        }
      }
    }
    cached = { mtimeMs: stats.mtimeMs, devices };
    return devices;
  } catch {
    // File missing or unreadable – return empty structure.
    cached = null;
    return {};
  }
}

export function listInventoryLogSources(): InventoryLogSource[] {
  const devices = loadInventoryDevices();
  const results: InventoryLogSource[] = [];
  for (const [id, device] of Object.entries(devices)) {
    const hasLogsFlag = device.logs === true;
    const host = device.lokiSource || id;
    if (!hasLogsFlag && !device.lokiSource) continue;
    results.push({
      id,
      host,
      labels: device.logLabels ?? {},
      role: device.role,
      displayName: device.displayName,
    });
  }
  return results.sort((a, b) => a.id.localeCompare(b.id));
}
