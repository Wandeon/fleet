import axios, { isAxiosError } from 'axios';
import { log } from '../observability/logging.js';
import { listInventoryLogSources, type InventoryLogSource } from '../lib/inventory.js';

export type LogSeverity =
  | 'emergency'
  | 'alert'
  | 'critical'
  | 'error'
  | 'warning'
  | 'notice'
  | 'info'
  | 'debug';

type SourceKind = 'group' | 'device' | 'infrastructure';

export interface LogEntry {
  id: string;
  timestamp: string;
  timestampNs: string;
  message: string;
  severity: LogSeverity;
  source: string;
  labels: Record<string, string>;
  raw: string;
  fields?: Record<string, unknown>;
}

export interface LogSourceDescriptor {
  id: string;
  label: string;
  kind: SourceKind;
  hosts: string[];
  labels: Record<string, string>;
  role?: string;
  displayName?: string;
}

export interface FetchLogsOptions {
  sourceId?: string;
  limit?: number;
  since?: Date;
  rangeMinutes?: number;
  direction?: 'forward' | 'backward';
}

export interface FetchLogsResult {
  source: string;
  sources: LogSourceDescriptor[];
  query: string;
  range: { start: string; end: string };
  limit: number;
  entries: LogEntry[];
  stats?: unknown;
}

const DEFAULT_LIMIT = Number.parseInt(process.env.LOGS_DEFAULT_LIMIT ?? '200', 10) || 200;
const MAX_LIMIT = Number.parseInt(process.env.LOGS_MAX_LIMIT ?? '1000', 10) || 1000;
const DEFAULT_RANGE_MINUTES = Number.parseInt(process.env.LOGS_DEFAULT_RANGE_MINUTES ?? '60', 10) || 60;
const LOKI_TIMEOUT_MS = Number.parseInt(process.env.LOKI_QUERY_TIMEOUT_MS ?? '10000', 10) || 10000;
const LOKI_BASE_URL = (process.env.LOKI_QUERY_URL || process.env.LOKI_BASE_URL || 'http://fleet-vps:3100').replace(/\/$/, '');
const EXTRA_VPS_HOST = (process.env.LOKI_VPS_SOURCE || process.env.VPS_HOST || 'fleet-vps').trim();

function uniqueHosts(sources: InventoryLogSource[]): string[] {
  const dedupe = new Set<string>();
  for (const source of sources) {
    if (!source.host) continue;
    dedupe.add(source.host);
  }
  return Array.from(dedupe.values());
}

function buildSources(): LogSourceDescriptor[] {
  const inventorySources = listInventoryLogSources();
  const devices = inventorySources.map((source) => ({
    id: source.id,
    label: source.displayName || source.host || source.id,
    kind: 'device' as const,
    hosts: [source.host],
    labels: source.labels ?? {},
    role: source.role,
    displayName: source.displayName,
  }));

  const sources: LogSourceDescriptor[] = [];
  const deviceHosts = uniqueHosts(inventorySources);
  if (deviceHosts.length) {
    sources.push({
      id: 'all',
      label: 'All Devices',
      kind: 'group',
      hosts: deviceHosts,
      labels: {},
    });
  }

  if (EXTRA_VPS_HOST && !devices.find((device) => device.id === 'vps')) {
    sources.push({
      id: 'vps',
      label: 'VPS',
      kind: 'infrastructure',
      hosts: [EXTRA_VPS_HOST],
      labels: {},
    });
  }

  sources.push(...devices);
  return sources;
}

function resolveSource(sourceId?: string): { sources: LogSourceDescriptor[]; active: LogSourceDescriptor } {
  const sources = buildSources();
  if (!sources.length) {
    const fallback: LogSourceDescriptor = {
      id: 'all',
      label: 'All Logs',
      kind: 'group',
      hosts: [],
      labels: {},
    };
    return { sources: [fallback], active: fallback };
  }
  const preferred = sources.find((source) => source.id === 'all') || sources[0];
  if (!sourceId) {
    return { sources, active: preferred };
  }
  const match = sources.find((source) => source.id === sourceId);
  if (match) {
    return { sources, active: match };
  }
  return { sources, active: preferred };
}

function escapeLabelValue(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function escapeRegexValue(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildLabelSelector(hosts: string[], labels: Record<string, string>): string | null {
  const parts: string[] = [];
  if (hosts.length === 1) {
    parts.push(`host="${escapeLabelValue(hosts[0])}"`);
  } else if (hosts.length > 1) {
    const pattern = hosts.map((host) => escapeRegexValue(host)).join('|');
    parts.push(`host=~"(${pattern})"`);
  }
  for (const [key, value] of Object.entries(labels ?? {})) {
    if (!value) continue;
    parts.push(`${key}="${escapeLabelValue(value)}"`);
  }
  if (!parts.length) return null;
  return `{${parts.join(',')}}`;
}

function priorityToSeverity(value: number): LogSeverity | null {
  const map: Record<number, LogSeverity> = {
    0: 'emergency',
    1: 'alert',
    2: 'critical',
    3: 'error',
    4: 'warning',
    5: 'notice',
    6: 'info',
    7: 'debug',
  };
  if (!Number.isFinite(value)) return null;
  const clamped = Math.max(0, Math.min(7, Math.round(value)));
  return map[clamped] ?? null;
}

function normalizeSeverity(input: unknown): LogSeverity | null {
  if (input == null) return null;
  if (typeof input === 'number') {
    return priorityToSeverity(input);
  }
  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    if (/^-?\d+$/.test(trimmed)) {
      const asNumber = Number.parseInt(trimmed, 10);
      const mapped = priorityToSeverity(asNumber);
      if (mapped) return mapped;
    }
    const lower = trimmed.toLowerCase();
    const table: Record<string, LogSeverity> = {
      emergency: 'emergency',
      emerg: 'emergency',
      alert: 'alert',
      critical: 'critical',
      crit: 'critical',
      fatal: 'critical',
      severe: 'critical',
      error: 'error',
      err: 'error',
      warning: 'warning',
      warn: 'warning',
      notice: 'notice',
      info: 'info',
      informational: 'info',
      information: 'info',
      debug: 'debug',
      trace: 'debug',
      verbose: 'debug',
    };
    if (table[lower]) return table[lower];
    if (lower.startsWith('warn')) return 'warning';
    if (lower.startsWith('err')) return 'error';
    if (lower.startsWith('crit')) return 'critical';
    if (lower.startsWith('fatal')) return 'critical';
  }
  return null;
}

function deriveSeverity(
  labels: Record<string, string>,
  candidate: unknown,
  message: string,
): LogSeverity {
  const fromCandidate = normalizeSeverity(candidate);
  if (fromCandidate) return fromCandidate;

  const fromLabels =
    normalizeSeverity(labels.level) ||
    normalizeSeverity(labels.severity) ||
    normalizeSeverity(labels.priority) ||
    normalizeSeverity((labels as Record<string, unknown>).syslog_priority);
  if (fromLabels) return fromLabels;

  const match = message.match(/^[\s[]*(TRACE|DEBUG|INFO|NOTICE|WARN|WARNING|ERR|ERROR|CRIT|CRITICAL|ALERT|EMERG|FATAL)\b/i);
  if (match) {
    const fromMessage = normalizeSeverity(match[1]);
    if (fromMessage) return fromMessage;
  }

  return 'info';
}

function parseLogLine(raw: string): {
  message: string;
  candidateSeverity?: unknown;
  fields?: Record<string, unknown>;
} {
  let message = typeof raw === 'string' ? raw : String(raw ?? '');
  let candidateSeverity: unknown;
  let fields: Record<string, unknown> | undefined;

  const trimmed = message.trimEnd();
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === 'object') {
        if (typeof parsed.log === 'string') {
          message = parsed.log;
        } else if (typeof parsed.message === 'string') {
          message = parsed.message;
        } else if (typeof parsed.msg === 'string') {
          message = parsed.msg;
        }
        candidateSeverity = parsed.level ?? parsed.severity ?? parsed.priority;
        const copy: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(parsed)) {
          if (key === 'log' || key === 'message' || key === 'msg') continue;
          copy[key] = value;
        }
        fields = Object.keys(copy).length ? copy : undefined;
      }
    } catch {
      message = trimmed;
    }
  } else {
    message = trimmed;
  }

  message = message.replace(/\s+$/u, '');
  return { message, candidateSeverity, fields };
}

function nsToIso(ns: string): string {
  try {
    const ms = Number(BigInt(ns) / 1_000_000n);
    return new Date(ms).toISOString();
  } catch {
    const fallback = Number.parseInt(ns.slice(0, -6), 10);
    return new Date(fallback).toISOString();
  }
}

function dateToNs(date: Date): string {
  return (BigInt(date.getTime()) * 1_000_000n).toString();
}

function transformStreams(
  streams: Array<{ stream: Record<string, string>; values: [string, string][] }>,
  active: LogSourceDescriptor,
): LogEntry[] {
  const entries: LogEntry[] = [];
  let sequence = 0;
  for (const stream of streams || []) {
    const labels = stream?.stream ?? {};
    const values = Array.isArray(stream?.values) ? stream.values : [];
    for (const [timestampNs, raw] of values) {
      if (typeof timestampNs !== 'string') continue;
      const rawMessage = typeof raw === 'string' ? raw : String(raw ?? '');
      const { message, candidateSeverity, fields } = parseLogLine(rawMessage);
      const severity = deriveSeverity(labels, candidateSeverity, message);
      entries.push({
        id: `${timestampNs}-${sequence++}`,
        timestamp: nsToIso(timestampNs),
        timestampNs,
        message,
        severity,
        source: labels.host || active.hosts[0] || 'unknown',
        labels,
        raw: rawMessage,
        ...(fields ? { fields } : {}),
      });
    }
  }
  entries.sort((a, b) => {
    if (a.timestampNs === b.timestampNs) return a.id.localeCompare(b.id);
    return BigInt(a.timestampNs) < BigInt(b.timestampNs) ? -1 : 1;
  });
  return entries;
}

export async function fetchLogs(options: FetchLogsOptions = {}): Promise<FetchLogsResult> {
  const { sources, active } = resolveSource(options.sourceId);
  const limit = Math.max(1, Math.min(options.limit ?? DEFAULT_LIMIT, MAX_LIMIT));

  const end = new Date();
  let start: Date;
  if (options.since && !Number.isNaN(options.since.getTime())) {
    start = options.since;
  } else if (options.rangeMinutes && options.rangeMinutes > 0) {
    start = new Date(end.getTime() - options.rangeMinutes * 60_000);
  } else {
    start = new Date(end.getTime() - DEFAULT_RANGE_MINUTES * 60_000);
  }
  if (start > end) {
    start = new Date(end.getTime() - 1_000);
  }

  const selector = buildLabelSelector(active.hosts, active.labels);
  if (!selector) {
    return {
      source: active.id,
      sources,
      query: '{}',
      range: { start: start.toISOString(), end: end.toISOString() },
      limit,
      entries: [],
    };
  }

  const direction = options.direction === 'forward' ? 'forward' : 'backward';

  try {
    const response = await axios.get(`${LOKI_BASE_URL}/loki/api/v1/query_range`, {
      params: {
        query: selector,
        limit,
        direction,
        start: dateToNs(start),
        end: dateToNs(end),
      },
      timeout: LOKI_TIMEOUT_MS,
    });

    const data = response.data?.data;
    const streams = Array.isArray(data?.result) ? (data.result) : [];
    const entries = transformStreams(streams, active);
    return {
      source: active.id,
      sources,
      query: selector,
      range: { start: start.toISOString(), end: end.toISOString() },
      limit,
      entries,
      stats: data?.stats ?? null,
    };
  } catch (err) {
    if (isAxiosError(err)) {
      const status = err.response?.status;
      const message = err.response?.data?.error || err.message;
      log.error({ err: message, status }, 'loki query failed');
      const error = new Error(message);
      (error as any).status = status ?? 502;
      throw error;
    }
    log.error({ err }, 'loki query failed');
    throw err;
  }
}

export function listLogSources(): LogSourceDescriptor[] {
  return resolveSource().sources;
}
