import { randomUUID } from 'node:crypto';

export type LogExportFormat = 'json' | 'csv';

export interface LogExportFilters {
  deviceId?: string;
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  start?: Date;
  end?: Date;
}

export interface LogExportJob {
  exportId: string;
  status: 'queued';
  format: LogExportFormat;
  filters: {
    deviceId?: string;
    level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    start?: string;
    end?: string;
  };
  requestedAt: string;
  estimatedReadyAt: string;
  downloadUrl: string;
  correlationId?: string | null;
}

const EXPORT_RETENTION_MINUTES = 30;
const PRIVILEGED_ROLES = new Set(['admin', 'security', 'compliance', 'auditor', 'logs_admin']);
const PRIVILEGED_SCOPES = new Set(['logs:export', 'logs:admin', 'logs:*']);

function formatDownloadUrl(exportId: string, format: LogExportFormat): string {
  const extension = format === 'csv' ? 'csv' : 'json';
  return `https://logs.example/exports/${exportId}.${extension}`;
}

function formatDate(date: Date | undefined): string | undefined {
  if (!date) {
    return undefined;
  }
  return date.toISOString();
}

export function createLogExportJob(
  filters: LogExportFilters,
  format: LogExportFormat,
  correlationId?: string
): LogExportJob {
  const exportId = randomUUID();
  const requestedAt = new Date();
  const readyAt = new Date(requestedAt.getTime() + EXPORT_RETENTION_MINUTES * 60 * 1000);

  return {
    exportId,
    status: 'queued',
    format,
    filters: {
      deviceId: filters.deviceId,
      level: filters.level,
      start: formatDate(filters.start),
      end: formatDate(filters.end),
    },
    requestedAt: requestedAt.toISOString(),
    estimatedReadyAt: readyAt.toISOString(),
    downloadUrl: formatDownloadUrl(exportId, format),
    correlationId: correlationId ?? null,
  };
}

export function isLogExportAuthorized(roles: string[], scopes: string[]): boolean {
  const normalizedRoles = roles
    .map((role) => role.trim().toLowerCase())
    .filter((role) => role.length > 0);
  const normalizedScopes = scopes
    .map((scope) => scope.trim().toLowerCase())
    .filter((scope) => scope.length > 0);

  if (normalizedRoles.some((role) => PRIVILEGED_ROLES.has(role))) {
    return true;
  }

  return normalizedScopes.some((scope) => {
    if (PRIVILEGED_SCOPES.has(scope)) {
      return true;
    }
    if (scope === 'admin') {
      return true;
    }
    if (scope.startsWith('logs:')) {
      const [, action] = scope.split(':', 2);
      return action === 'all' || action === 'read-write' || action === 'manage';
    }
    return false;
  });
}
