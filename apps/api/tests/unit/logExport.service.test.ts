import { describe, expect, it } from 'vitest';
import { createLogExportJob, isLogExportAuthorized } from '../../src/services/logExport.js';

describe('logExport service', () => {
  it('creates a log export job with normalized filters', () => {
    const job = createLogExportJob(
      {
        deviceId: 'cam-1',
        level: 'error',
        start: new Date('2024-04-01T10:00:00Z'),
        end: new Date('2024-04-01T11:00:00Z'),
      },
      'csv',
      'corr-1234'
    );

    expect(job.format).toBe('csv');
    expect(job.downloadUrl.endsWith('.csv')).toBe(true);
    expect(job.filters.start).toBe('2024-04-01T10:00:00.000Z');
    expect(job.filters.end).toBe('2024-04-01T11:00:00.000Z');
    expect(job.filters.deviceId).toBe('cam-1');
    expect(job.correlationId).toBe('corr-1234');
    const requestedAt = Date.parse(job.requestedAt);
    const readyAt = Date.parse(job.estimatedReadyAt);
    expect(Number.isFinite(requestedAt)).toBe(true);
    expect(readyAt).toBeGreaterThan(requestedAt);
  });

  it('authorizes privileged roles and scopes', () => {
    expect(isLogExportAuthorized(['admin'], [])).toBe(true);
    expect(isLogExportAuthorized(['operator'], ['logs:export'])).toBe(true);
    expect(isLogExportAuthorized(['operator'], ['logs:read-write'])).toBe(true);
    expect(isLogExportAuthorized(['operator'], ['analytics:view'])).toBe(false);
    expect(isLogExportAuthorized(['auditor'], [])).toBe(true);
    expect(isLogExportAuthorized([], [])).toBe(false);
  });
});
