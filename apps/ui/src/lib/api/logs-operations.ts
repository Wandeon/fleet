import { browser } from '$app/environment';
import {
  API_BASE_URL,
  rawRequest,
  USE_MOCKS,
  UiApiError,
  type RequestOptions,
} from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { LogEntry, LogLevel, LogSeverity, LogsFilterState, LogsSnapshot } from '$lib/types';

export interface LogQueryOptions extends Partial<LogsFilterState> {
  limit?: number;
  cursor?: string | null;
  fetch?: typeof fetch;
}

export interface LogExportOptions extends LogQueryOptions {
  format?: 'json' | 'text';
}

export interface LogStreamOptions {
  filters: Partial<LogsFilterState>;
  onEvent: (entry: LogEntry) => void;
  onError?: (error: Error) => void;
}

export interface LogStreamSubscription {
  stop: () => void;
}

// Retry utility with exponential backoff
interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  retryableStatuses?: number[];
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 500,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  retryableStatuses: [408, 429, 500, 502, 503, 504],
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;

      // Check if error is retryable
      const isRetryable =
        error instanceof UiApiError &&
        opts.retryableStatuses.includes(error.status);

      // Don't retry on last attempt or non-retryable errors
      if (attempt === opts.maxAttempts - 1 || !isRetryable) {
        throw error;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt),
        opts.maxDelayMs
      );

      await sleep(delay);
    }
  }

  throw lastError ?? new Error('Retry failed with unknown error');
}

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

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const severityToApi = (severity: LogSeverity): 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' => {
  switch (severity) {
    case 'critical':
      return 'fatal';
    case 'error':
      return 'error';
    case 'warning':
      return 'warn';
    case 'debug':
      return 'debug';
    default:
      return 'info';
  }
};

const levelToSeverity = (level: LogLevel): LogSeverity => {
  switch (level) {
    case 'fatal':
    case 'error':
      return 'error';
    case 'warn':
      return 'warning';
    case 'debug':
      return 'debug';
    case 'trace':
      return 'debug';
    default:
      return 'info';
  }
};

const normaliseEntry = (entry: LogEntry): LogEntry => {
  if (entry.timestamp) {
    return entry;
  }

  const timestamp = entry.ts ?? new Date().toISOString();
  const severity = entry.severity ?? (entry.level ? levelToSeverity(entry.level) : 'info');
  const message = entry.message ?? entry.msg ?? 'Log entry';
  const source = entry.source ?? entry.service ?? 'fleet-service';

  return {
    ...entry,
    timestamp,
    severity,
    message,
    source,
  };
};

// Build query params for /logs/query endpoint (filtering endpoint)
const buildQueryParams = (options: LogQueryOptions): URLSearchParams => {
  const params = new URLSearchParams();

  // For /logs/query endpoint: level, deviceId, correlationId, start, end, limit
  // sourceId maps to deviceId (if it's not 'all')
  if (options.sourceId && options.sourceId !== 'all') {
    params.set('deviceId', options.sourceId);
  }

  // severity maps to level
  if (options.severity && options.severity !== 'all') {
    params.set('level', severityToApi(options.severity as LogSeverity));
  }

  // search can be either a deviceId, correlationId, or general text
  // For now, treat search as correlationId if provided
  if (options.search) {
    params.set('correlationId', options.search);
  }

  if (options.limit) {
    params.set('limit', String(Math.max(1, Math.min(500, options.limit))));
  }

  return params;
};

// Build query params for /logs/stream endpoint
const buildStreamParams = (options: Partial<LogsFilterState>): URLSearchParams => {
  const params = new URLSearchParams();

  // For /logs/stream endpoint: source, level, q
  if (options.sourceId && options.sourceId !== 'all') {
    params.set('source', options.sourceId);
  }

  if (options.severity && options.severity !== 'all') {
    params.set('level', severityToApi(options.severity as LogSeverity));
  }

  if (options.search) {
    params.set('q', options.search);
  }

  return params;
};

export const fetchLogSnapshot = async (options: LogQueryOptions = {}): Promise<LogsSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.logsSnapshot(options);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const params = buildQueryParams(options);

  // Use retry logic for 5xx errors
  return withRetry(async () => {
    const result = await rawRequest<{
      items: LogEntry[];
      total: number;
      fetchedAt: string;
      sources?: LogsSnapshot['sources'];
      cursor?: string | null;
      lastUpdated?: string;
    }>(`/logs/query?${params.toString()}`, {
      method: 'GET',
      fetch: fetchImpl as RequestOptions['fetch'],
    });

    return {
      entries: (result?.items ?? []).map(normaliseEntry),
      sources: result?.sources ?? [],
      cursor: result?.cursor ?? null,
      lastUpdated: result?.fetchedAt ?? new Date().toISOString(),
    } satisfies LogsSnapshot;
  }, {
    maxAttempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 5000,
  });
};

export const fetchLogsSnapshot = async (options: FetchLogsOptions = {}): Promise<LogsSnapshot> => {
  const mapped: LogQueryOptions = {
    fetch: options.fetch,
    limit: options.limit,
    cursor: options.cursor,
  };

  if (options.level) {
    mapped.severity = levelToSeverity(options.level);
  }

  return fetchLogSnapshot(mapped);
};

export const exportLogs = async (options: LogExportOptions = {}): Promise<Blob> => {
  const snapshot = await fetchLogSnapshot(options);
  const format = options.format ?? 'json';
  if (format === 'text') {
    const lines = snapshot.entries.map((entry) => {
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      return `[${entry.timestamp}] ${entry.severity?.toUpperCase() ?? 'INFO'} ${entry.source}: ${entry.message}${context}`;
    });
    return new Blob([lines.join('\n')], { type: 'text/plain' });
  }
  return new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
};

export const subscribeToLogStream = (options: LogStreamOptions): LogStreamSubscription => {
  if (USE_MOCKS || !browser) {
    const stop = mockApi.logsStream(options.filters, (entry) =>
      options.onEvent(normaliseEntry(entry))
    );
    return { stop };
  }

  let eventSource: EventSource | null = null;
  let reconnectAttempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let isStopped = false;

  const connect = () => {
    if (isStopped) return;

    const params = buildStreamParams(options.filters);
    const url = `${API_BASE_URL}/logs/stream?${params.toString()}`;
    eventSource = new EventSource(url, { withCredentials: false });

    const handleMessage = (event: MessageEvent) => {
      // Reset reconnect attempt on successful message
      reconnectAttempt = 0;

      if (!event.data) return;
      try {
        const payload = JSON.parse(event.data) as LogEntry;
        options.onEvent(normaliseEntry(payload));
      } catch (error) {
        console.warn('Failed to parse log stream payload', error);
      }
    };

    const handleError = () => {
      if (isStopped) return;

      eventSource?.close();

      // Calculate exponential backoff delay
      const maxAttempts = 5;
      if (reconnectAttempt < maxAttempts) {
        const delay = Math.min(
          500 * Math.pow(2, reconnectAttempt),
          10000
        );

        reconnectAttempt++;
        reconnectTimer = setTimeout(() => {
          if (!isStopped) {
            connect();
          }
        }, delay);
      } else {
        // Max retries exceeded
        const error = new UiApiError('Log stream disconnected after max retries', 502, {
          attempts: reconnectAttempt,
        });
        options.onError?.(error);
      }
    };

    eventSource.addEventListener('message', handleMessage);
    eventSource.addEventListener('error', handleError);
  };

  // Initial connection
  connect();

  return {
    stop: () => {
      isStopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      eventSource?.close();
      eventSource = null;
    },
  };
};

export const createLogsStream = (options: LogsStreamOptions = {}): LogsStream | null => {
  if (!browser && !USE_MOCKS) {
    return null;
  }

  const listeners = new Set<(entry: LogEntry) => void>();
  let paused = false;
  let subscription: LogStreamSubscription | null = null;

  const filters: Partial<LogsFilterState> = {};
  if (options.level) {
    filters.severity = levelToSeverity(options.level);
  }

  const emit = (entry: LogEntry) => {
    if (paused) return;
    for (const listener of listeners) {
      listener(entry);
    }
  };

  const start = () => {
    subscription?.stop();
    subscription = subscribeToLogStream({
      filters,
      onEvent: emit,
      onError: (error) => options.onError?.(error),
    });
  };

  if (browser || USE_MOCKS) {
    start();
  }

  return {
    subscribe(handler: (entry: LogEntry) => void) {
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },
    pause() {
      paused = true;
    },
    resume() {
      const wasPaused = paused;
      paused = false;
      if (wasPaused && !subscription) {
        start();
      }
    },
    close() {
      paused = true;
      subscription?.stop();
      subscription = null;
      listeners.clear();
    },
    get paused() {
      return paused;
    },
  };
};
