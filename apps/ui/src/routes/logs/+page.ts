import type { PageLoad } from './$types';
import { fetchLogsSnapshot } from '$lib/api/logs-operations';
import type { LogLevel } from '$lib/types';

const parseLevel = (value: string | null): LogLevel | undefined => {
  if (!value) return undefined;
  const normalised = value.toLowerCase();
  const levels: LogLevel[] = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
  if (levels.includes(normalised as LogLevel)) {
    return normalised as LogLevel;
  }
  if (normalised === 'warning') {
    return 'warn';
  }
  return undefined;
};

const parseLimit = (value: string | null): number | undefined => {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) {
    return undefined;
  }
  return parsed;
};

export const load: PageLoad = async ({ fetch, depends, url }) => {
  depends('app:logs');

  const level = parseLevel(url.searchParams.get('level'));
  const limit = parseLimit(url.searchParams.get('limit'));

  try {
    const snapshot = await fetchLogsSnapshot({ fetch, level, limit });
    return {
      snapshot,
      level: level ?? 'info',
      error: null
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to load logs';
    return {
      snapshot: { entries: [], cursor: null },
      level: level ?? 'info',
      error: message
    };
  }
};
