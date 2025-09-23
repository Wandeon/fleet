export type HealthStatus = 'UP' | 'DEGRADED' | 'DOWN' | 'UNKNOWN';

export function stateToHealth(state: any): HealthStatus {
  const raw = (state?.status ?? state)?.toString().toLowerCase();
  switch (raw) {
    case 'online':
    case 'up':
    case 'healthy':
      return 'UP';
    case 'degraded':
    case 'warning':
    case 'partial':
      return 'DEGRADED';
    case 'offline':
    case 'down':
    case 'error':
      return 'DOWN';
    default:
      return 'UNKNOWN';
  }
}

export function formatIso(value: string | null | undefined): string {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString();
  } catch (err) {
    return value;
  }
}

export function summarizeHealth(statuses: HealthStatus[]): HealthStatus {
  if (!statuses.length) return 'UNKNOWN';
  if (statuses.includes('DOWN')) return 'DOWN';
  if (statuses.includes('DEGRADED')) return 'DEGRADED';
  return 'UP';
}
