import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import {
  getCameraEvent,
  listCameraEvents,
  resetCameraEvents,
  setCameraEventsForTests,
} from '../../src/services/cameraEvents.js';
import { setRegistryForTests } from '../../src/upstream/devices.js';

const registryDocument = {
  devices: [
    {
      id: 'cam-1',
      name: 'Lobby Camera',
      role: 'camera',
      baseUrl: 'http://127.0.0.1:3100',
    },
    {
      id: 'cam-2',
      name: 'Dock Camera',
      role: 'camera',
      baseUrl: 'http://127.0.0.1:3101',
    },
  ],
};

describe('cameraEvents service', () => {
  beforeEach(() => {
    setRegistryForTests(registryDocument);
    setCameraEventsForTests([
      {
        id: 'evt-001',
        cameraId: 'cam-1',
        type: 'motion',
        severity: 'info',
        timestamp: '2024-04-01T10:00:00Z',
        synopsis: 'Person detected near lobby desk',
        tags: ['person', 'lobby'],
        confidence: 0.34,
        acknowledged: true,
        acknowledgedAt: '2024-04-01T10:05:00Z',
      },
      {
        id: 'evt-002',
        cameraId: 'cam-2',
        type: 'loitering',
        severity: 'warning',
        timestamp: '2024-04-01T11:30:00Z',
        synopsis: 'Extended presence near dock entrance',
        tags: ['dock', 'vehicle'],
        confidence: 0.78,
        clipUrl: 'https://cdn.example.com/cam-dock/evt-002.mp4',
      },
      {
        id: 'evt-003',
        cameraId: 'cam-2',
        type: 'motion',
        severity: 'critical',
        timestamp: '2024-04-01T12:00:00Z',
        synopsis: 'Unauthorized access at dock door',
        tags: ['dock', 'intrusion'],
        confidence: 0.92,
      },
    ]);
  });

  afterEach(() => {
    resetCameraEvents();
  });

  it('returns events sorted by recency with pagination metadata', () => {
    const result = listCameraEvents({ limit: 2 });
    expect(result.events.map((event) => event.id)).toEqual(['evt-003', 'evt-002']);
    expect(result.hasMore).toBe(true);
    expect(result.nextCursor).toBeTruthy();
    expect(result.totalCount).toBe(3);
  });

  it('respects pagination cursor', () => {
    const first = listCameraEvents({ limit: 1 });
    expect(first.events).toHaveLength(1);
    const cursor = first.nextCursor;
    expect(cursor).toBeTruthy();
    const second = listCameraEvents({ limit: 2, cursor: cursor ?? undefined });
    expect(second.events.map((event) => event.id)).toEqual(['evt-002', 'evt-001']);
    expect(second.hasMore).toBe(false);
  });

  it('filters by confidence, tag, and time range', () => {
    const filtered = listCameraEvents({
      minConfidence: 0.7,
      tags: ['dock'],
      start: new Date('2024-04-01T11:00:00Z'),
    });
    expect(filtered.events).toHaveLength(2);
    expect(filtered.events.every((event) => event.tags.includes('dock'))).toBe(true);
  });

  it('returns detailed metadata for an event', () => {
    const detail = getCameraEvent('evt-002');
    expect(detail).toBeTruthy();
    expect(detail?.cameraName).toBe('Dock Camera');
    expect(detail?.clip.url).toContain('evt-002');
    expect(detail?.metadata).not.toBeNull();
    expect(detail?.metadata).toMatchObject({ synopsis: expect.anything() });
    expect(detail?.clip.durationSeconds).toBeGreaterThan(0);
  });

  it('returns null when event is missing', () => {
    const missing = getCameraEvent('evt-999');
    expect(missing).toBeNull();
  });
});
