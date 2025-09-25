import { browser } from '$app/environment';
import { mockApi } from './mock';
import { rawRequest, USE_MOCKS, type RequestOptions } from './client';
import type { LogEntry, LogsSnapshot, LogLevel } from '$lib/types';

export interface FetchLogsOptions {
  level?: LogLevel;
  limit?: number;
  cursor?: string | null;
  fetch?: typeof fetch;
}

export interface LogsStreamOptions {
  level?: LogLevel;
  onError?: (error: Error) => void;
}

export interface LogsStream {
  subscribe(handler: (entry: LogEntry) => void): () => void;
  pause(): void;
  resume(): void;
  close(): void;
  readonly paused: boolean;
}

const DEFAULT_LEVEL: LogLevel = 'info';
const MAX_LIMIT = 500;

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const normaliseLevel = (level?: string | null): LogLevel => {
  if (!level) return DEFAULT_LEVEL;
  const lower = level.toLowerCase();
  switch (lower) {
    case 'trace':
    case 'debug':
    case 'info':
    case 'warn':
    case 'warning':
    case 'error':
    case 'fatal':
      return lower === 'warning' ? 'warn' : (lower as LogLevel);
    default:
      return DEFAULT_LEVEL;
  }
};

const normaliseEntry = (entry: unknown, index: number): LogEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const candidate = entry as Record<string, unknown>;
  const ts = typeof candidate.ts === 'string'
    ? candidate.ts
    : typeof candidate.timestamp === 'string'
      ? candidate.timestamp
      : null;

  if (!ts) {
    return null;
  }

  const service = typeof candidate.service === 'string'
    ? candidate.service
    : typeof candidate.module === 'string'
      ? candidate.module
      : typeof candidate.source === 'string'
        ? candidate.source
        : 'fleet-api';

  const host = typeof candidate.host === 'string'
    ? candidate.host
    : typeof candidate.hostname === 'string'
      ? candidate.hostname
      : typeof candidate.node === 'string'
        ? candidate.node
        : service;

  const msg = typeof candidate.msg === 'string'
    ? candidate.msg
    : typeof candidate.message === 'string'
      ? candidate.message
      : JSON.stringify(candidate);

  const level = normaliseLevel((candidate.level as string | null) ?? null);

  const correlationId = typeof candidate.correlationId === 'string'
    ? candidate.correlationId
    : typeof candidate.correlation_id === 'string'
      ? candidate.correlation_id
      : typeof candidate.requestId === 'string'
        ? candidate.requestId
        : null;

  const idSource = typeof candidate.id === 'string'
    ? candidate.id
    : typeof candidate.uid === 'string'
      ? candidate.uid
      : `${ts}-${service}-${index}`;

  const context = typeof candidate === 'object' ? { ...candidate } : undefined;

  return {
    id: idSource,
    ts,
    level,
    msg,
    service,
    host,
    correlationId,
    context,
  } satisfies LogEntry;
};

const fromRawResponse = (payload: unknown): LogsSnapshot => {
  if (payload && typeof payload === 'object') {
    const source = payload as Record<string, unknown>;
    const entriesCandidate = Array.isArray(source.entries)
      ? source.entries
      : Array.isArray(source.logs)
        ? source.logs
        : Array.isArray(source.items)
          ? source.items
          : [];

    const cursor = typeof source.cursor === 'string'
      ? source.cursor
      : typeof source.nextCursor === 'string'
        ? source.nextCursor
        : null;

    const entries: LogEntry[] = entriesCandidate
      .map((item, index) => normaliseEntry(item, index))
      .filter((item): item is LogEntry => item !== null);

    return { entries, cursor } satisfies LogsSnapshot;
  }

  return { entries: [], cursor: null } satisfies LogsSnapshot;
};

const buildQuery = (options: FetchLogsOptions): string => {
  const params = new URLSearchParams();
  if (options.level) params.set('level', options.level);
  if (options.limit) params.set('limit', String(Math.min(options.limit, MAX_LIMIT)));
  if (options.cursor) params.set('cursor', options.cursor);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const fetchLogsSnapshot = async (options: FetchLogsOptions = {}): Promise<LogsSnapshot> => {
  if (USE_MOCKS) {
    const data = mockApi.logs();
    return fromRawResponse(data);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const query = buildQuery(options);
  const response = await rawRequest<unknown>(`/logs${query}`, {
    fetch: fetchImpl as RequestOptions['fetch'],
  });
  return fromRawResponse(response);
};

class EventSourceStream implements LogsStream {
  #listeners = new Set<(entry: LogEntry) => void>();
  #source: EventSource | null;
  #paused = false;
  #options: LogsStreamOptions;

  constructor(url: string, options: LogsStreamOptions = {}) {
    this.#options = options;
    this.#source = new EventSource(url);
    this.#source.addEventListener('message', (event) => {
      if (this.#paused) return;
      try {
        const parsed = JSON.parse((event as MessageEvent).data);
        const entry = normaliseEntry(parsed, Date.now());
        if (entry) {
          for (const listener of this.#listeners) {
            listener(entry);
          }
        }
      } catch (error) {
        options.onError?.(error instanceof Error ? error : new Error(String(error)));
      }
    });
    this.#source.addEventListener('error', () => {
      options.onError?.(new Error('Log stream connection failed'));
    });
  }

  subscribe(handler: (entry: LogEntry) => void): () => void {
    this.#listeners.add(handler);
    return () => {
      this.#listeners.delete(handler);
    };
  }

  pause(): void {
    this.#paused = true;
  }

  resume(): void {
    this.#paused = false;
  }

  close(): void {
    this.#source?.close();
    this.#listeners.clear();
  }

  get paused(): boolean {
    return this.#paused;
  }
}

class MockLogsStream implements LogsStream {
  #listeners = new Set<(entry: LogEntry) => void>();
  #timer: ReturnType<typeof setInterval> | null = null;
  #paused = false;
  #entries: LogEntry[];
  #pointer = 0;

  constructor(entries: LogEntry[], level: LogLevel = DEFAULT_LEVEL) {
    this.#entries = entries
      .filter((entry) => filterByLevel(entry, level))
      .sort((a, b) => a.ts.localeCompare(b.ts));
    this.resume();
  }

  subscribe(handler: (entry: LogEntry) => void): () => void {
    this.#listeners.add(handler);
    return () => this.#listeners.delete(handler);
  }

  pause(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
    this.#paused = true;
  }

  resume(): void {
    if (this.#timer || this.#entries.length === 0) {
      this.#paused = false;
      return;
    }
    this.#paused = false;
    this.#timer = setInterval(() => {
      if (this.#paused || this.#entries.length === 0) {
        return;
      }
      const template = this.#entries[this.#pointer % this.#entries.length];
      this.#pointer += 1;
      const offset = this.#pointer;
      const emitted: LogEntry = {
        ...template,
        id: `${template.id}-mock-${offset}`,
        ts: new Date(Date.parse(template.ts) + offset * 1000).toISOString(),
      };
      for (const listener of this.#listeners) {
        listener(emitted);
      }
    }, 1200);
  }

  close(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
    }
    this.#timer = null;
    this.#listeners.clear();
  }

  get paused(): boolean {
    return this.#paused;
  }
}

const filterByLevel = (entry: LogEntry, level: LogLevel): boolean => {
  const priority = new Map<LogLevel, number>([
    ['trace', 0],
    ['debug', 1],
    ['info', 2],
    ['warn', 3],
    ['error', 4],
    ['fatal', 5],
  ]);
  const target = priority.get(level) ?? priority.get(DEFAULT_LEVEL)!;
  return (priority.get(entry.level) ?? target) >= target;
};

export const createLogsStream = (options: LogsStreamOptions = {}): LogsStream | null => {
  const level = options.level ?? DEFAULT_LEVEL;
  if (USE_MOCKS || !browser) {
    const snapshot = fromRawResponse(mockApi.logs());
    return new MockLogsStream(snapshot.entries, level);
  }

  const params = new URLSearchParams({ level });
  const url = `/ui/logs/stream?${params.toString()}`;
  return new EventSourceStream(url, options);
};
