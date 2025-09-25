import { browser } from '$app/environment';
import { API_BASE_URL, rawRequest, USE_MOCKS, UiApiError } from '$lib/api/client';
import type { RequestOptions } from '$lib/api/client';
import { mockApi } from '$lib/api/mock';
import type { LogEntry, LogSeverity, LogsFilterState, LogsSnapshot } from '$lib/types';

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

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const severityToApi = (severity: LogSeverity): string => {
  switch (severity) {
    case 'critical':
      return 'critical';
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

const normaliseEntry = (entry: LogEntry): LogEntry => entry;

const buildQuery = (options: LogQueryOptions): URLSearchParams => {
  const params = new URLSearchParams();
  if (options.sourceId && options.sourceId !== 'all') {
    params.set('source', options.sourceId);
  }
  if (options.severity && options.severity !== 'all') {
    params.set('level', severityToApi(options.severity as LogSeverity));
  }
  if (options.search) {
    params.set('q', options.search);
  }
  if (options.limit) {
    params.set('limit', String(Math.max(1, options.limit)));
  }
  if (options.cursor) {
    params.set('cursor', options.cursor);
  }
  return params;
};

export const fetchLogSnapshot = async (options: LogQueryOptions = {}): Promise<LogsSnapshot> => {
  if (USE_MOCKS) {
    return mockApi.logsSnapshot(options);
  }

  const fetchImpl = ensureFetch(options.fetch);
  const params = buildQuery(options);
  const result = await rawRequest<{
    entries: LogEntry[];
    sources: LogsSnapshot['sources'];
    cursor?: string | null;
    lastUpdated?: string;
  }>(`/logs?${params.toString()}`, {
    method: 'GET',
    fetch: fetchImpl as RequestOptions['fetch']
  });

  return {
    entries: (result?.entries ?? []).map(normaliseEntry),
    sources: result?.sources ?? [],
    cursor: result?.cursor ?? null,
    lastUpdated: result?.lastUpdated ?? new Date().toISOString()
  } satisfies LogsSnapshot;
};

export const exportLogs = async (options: LogExportOptions = {}): Promise<Blob> => {
  const snapshot = await fetchLogSnapshot(options);
  const format = options.format ?? 'json';
  if (format === 'text') {
    const lines = snapshot.entries.map((entry) => {
      const context = entry.context ? ` ${JSON.stringify(entry.context)}` : '';
      return `[${entry.timestamp}] ${entry.severity.toUpperCase()} ${entry.source}: ${entry.message}${context}`;
    });
    return new Blob([lines.join('\n')], { type: 'text/plain' });
  }
  return new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
};

export const subscribeToLogStream = (options: LogStreamOptions): LogStreamSubscription => {
  if (USE_MOCKS || !browser) {
    const stop = mockApi.logsStream(options.filters, options.onEvent);
    return { stop };
  }

  const params = buildQuery(options.filters);
  const url = `${API_BASE_URL}/logs/stream?${params.toString()}`;
  const eventSource = new EventSource(url, { withCredentials: false });

  const handleMessage = (event: MessageEvent) => {
    if (!event.data) return;
    try {
      const payload = JSON.parse(event.data) as LogEntry;
      options.onEvent(normaliseEntry(payload));
    } catch (error) {
      console.warn('Failed to parse log stream payload', error);
    }
  };

  const handleError = (event: Event) => {
    eventSource.close();
    const error = new UiApiError('Log stream disconnected', 502, event);
    options.onError?.(error);
  };

  eventSource.addEventListener('message', handleMessage);
  eventSource.addEventListener('error', handleError);

  return {
    stop: () => {
      eventSource.removeEventListener('message', handleMessage);
      eventSource.removeEventListener('error', handleError);
      eventSource.close();
    }
  };
};
