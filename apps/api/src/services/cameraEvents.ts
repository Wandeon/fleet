import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { deviceRegistry } from '../upstream/devices.js';

export type CameraEventSeverity = 'info' | 'warning' | 'critical';

interface FixtureCameraEvent {
  id: string;
  cameraId: string;
  type: string;
  severity: CameraEventSeverity;
  timestamp: string;
  clipUrl?: string | null;
  thumbnailUrl?: string | null;
  synopsis?: string | null;
}

export interface CameraEventSummary {
  id: string;
  cameraId: string;
  cameraName: string;
  timestamp: string;
  type: string;
  severity: CameraEventSeverity;
  confidence: number;
  tags: string[];
  thumbnailUrl: string | null;
  clipUrl: string | null;
  clipAvailable: boolean;
  acknowledged: boolean;
  acknowledgedAt: string | null;
}

export interface CameraEventDetail extends CameraEventSummary {
  metadata: Record<string, unknown>;
  clip: {
    url: string | null;
    expiresAt: string | null;
    durationSeconds: number | null;
    format: string | null;
  };
}

export interface CameraEventListOptions {
  start?: Date;
  end?: Date;
  minConfidence?: number;
  maxConfidence?: number;
  tags?: string[];
  cameraId?: string;
  limit?: number;
  cursor?: string;
}

export interface CameraEventListResult {
  events: CameraEventSummary[];
  totalCount: number;
  hasMore: boolean;
  nextCursor: string | null;
}

interface CameraEventRecord {
  id: string;
  cameraId: string;
  type: string;
  severity: CameraEventSeverity;
  timestamp: string;
  clipUrl: string | null;
  thumbnailUrl: string | null;
  synopsis?: string | null;
  confidence: number;
  tags: string[];
  acknowledged: boolean;
  acknowledgedAt: string | null;
  durationSeconds: number | null;
  metadata: Record<string, unknown>;
}

export interface CameraEventSeed {
  id: string;
  cameraId: string;
  type: string;
  severity: CameraEventSeverity;
  timestamp: string;
  clipUrl?: string | null;
  thumbnailUrl?: string | null;
  synopsis?: string | null;
  confidence?: number;
  tags?: string[];
  acknowledged?: boolean;
  acknowledgedAt?: string | null;
  durationSeconds?: number | null;
  metadata?: Record<string, unknown>;
}

const DEFAULT_CONFIDENCE_BY_SEVERITY: Record<CameraEventSeverity, number> = {
  info: 0.42,
  warning: 0.68,
  critical: 0.9,
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'in',
  'into',
  'is',
  'near',
  'of',
  'on',
  'or',
  'over',
  'the',
  'to',
  'with',
  'without',
]);

let cachedEvents: CameraEventRecord[] | null = null;

function fixturePath(): string {
  return resolve(__dirname, '../../../api-mock/fixtures/camera.events.json');
}

function computeDeterministicOffset(id: string): number {
  const hash = createHash('sha1').update(id).digest('hex');
  const slice = hash.slice(0, 8);
  const value = Number.parseInt(slice, 16);
  if (!Number.isFinite(value)) {
    return 0;
  }
  return (value % 1000) / 10_000; // up to ~0.099
}

function computeConfidence(id: string, severity: CameraEventSeverity, provided?: number): number {
  if (typeof provided === 'number' && Number.isFinite(provided)) {
    return Math.min(1, Math.max(0, provided));
  }
  const base = DEFAULT_CONFIDENCE_BY_SEVERITY[severity] ?? 0.5;
  const offset = computeDeterministicOffset(id);
  const confidence = base + offset;
  return Math.min(0.99, Math.max(0.15, Number.parseFloat(confidence.toFixed(2))));
}

function deriveDuration(id: string, provided?: number | null): number {
  if (provided != null && Number.isFinite(provided)) {
    return Math.max(1, Math.trunc(provided));
  }
  const hash = createHash('sha1').update(`duration:${id}`).digest('hex');
  const value = Number.parseInt(hash.slice(0, 6), 16);
  const duration = 8 + (value % 45);
  return duration;
}

function sanitizeTag(tag: string): string {
  return tag
    .toLowerCase()
    .replace(/[^a-z0-9:_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-|-$/g, '');
}

function deriveTags(event: FixtureCameraEvent, provided?: string[]): string[] {
  const tags = new Set<string>();
  tags.add(sanitizeTag(`camera:${event.cameraId}`));
  tags.add(sanitizeTag(`type:${event.type}`));
  tags.add(sanitizeTag(`severity:${event.severity}`));

  if (provided) {
    for (const tag of provided) {
      if (typeof tag === 'string' && tag.trim().length > 0) {
        tags.add(sanitizeTag(tag));
      }
    }
  }

  if (event.synopsis) {
    const words = event.synopsis
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
    for (const word of words.slice(0, 6)) {
      tags.add(sanitizeTag(word));
    }
  }

  return Array.from(tags.values()).filter((tag) => tag.length > 0);
}

function normalizeMetadata(
  event: FixtureCameraEvent,
  overrides?: Record<string, unknown>
): Record<string, unknown> {
  const metadata: Record<string, unknown> = {
    severity: event.severity,
    synopsis: event.synopsis ?? null,
    source: 'ai-camera-pipeline',
    cameraId: event.cameraId,
    type: event.type,
  };
  if (overrides) {
    for (const [key, value] of Object.entries(overrides)) {
      metadata[key] = value;
    }
  }
  return metadata;
}

function loadFixture(): CameraEventRecord[] {
  const path = fixturePath();
  if (!existsSync(path)) {
    return [];
  }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as { items?: FixtureCameraEvent[] };
    const events = Array.isArray(raw.items) ? raw.items : [];
    return events.map((event) => ({
      id: event.id,
      cameraId: event.cameraId,
      type: event.type,
      severity: event.severity,
      timestamp: event.timestamp,
      clipUrl: event.clipUrl ?? null,
      thumbnailUrl: event.thumbnailUrl ?? null,
      synopsis: event.synopsis ?? null,
      confidence: computeConfidence(event.id, event.severity),
      tags: deriveTags(event),
      acknowledged: false,
      acknowledgedAt: null,
      durationSeconds: deriveDuration(event.id),
      metadata: normalizeMetadata(event),
    }));
  } catch {
    return [];
  }
}

function ensureEvents(): CameraEventRecord[] {
  if (!cachedEvents) {
    cachedEvents = loadFixture();
  }
  return cachedEvents;
}

function buildCursor(event: CameraEventRecord): string {
  return `${event.timestamp}|${event.id}`;
}

function compareEvents(a: CameraEventRecord, b: CameraEventRecord): number {
  const aTime = Date.parse(a.timestamp);
  const bTime = Date.parse(b.timestamp);
  if (Number.isFinite(aTime) && Number.isFinite(bTime)) {
    if (aTime !== bTime) {
      return bTime - aTime;
    }
  }
  return b.id.localeCompare(a.id);
}

function toSummary(record: CameraEventRecord): CameraEventSummary {
  const device = deviceRegistry.getDevice(record.cameraId);
  return {
    id: record.id,
    cameraId: record.cameraId,
    cameraName: device?.name ?? record.cameraId,
    timestamp: record.timestamp,
    type: record.type,
    severity: record.severity,
    confidence: record.confidence,
    tags: record.tags,
    thumbnailUrl: record.thumbnailUrl,
    clipUrl: record.clipUrl,
    clipAvailable: Boolean(record.clipUrl),
    acknowledged: record.acknowledged,
    acknowledgedAt: record.acknowledgedAt,
  };
}

function detectFormat(url: string | null): string | null {
  if (!url) {
    return null;
  }
  const match = url.match(/\.([a-z0-9]+)(?:\?|#|$)/i);
  return match ? match[1].toLowerCase() : null;
}

function toDetail(record: CameraEventRecord): CameraEventDetail {
  const summary = toSummary(record);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  return {
    ...summary,
    metadata: record.metadata,
    clip: {
      url: record.clipUrl,
      expiresAt: record.clipUrl ? expiresAt : null,
      durationSeconds: record.durationSeconds,
      format: detectFormat(record.clipUrl),
    },
  };
}

function matchesConfidence(record: CameraEventRecord, min?: number, max?: number): boolean {
  if (min != null && record.confidence < min) {
    return false;
  }
  if (max != null && record.confidence > max) {
    return false;
  }
  return true;
}

function matchesTags(record: CameraEventRecord, tags?: string[]): boolean {
  if (!tags || tags.length === 0) {
    return true;
  }
  const lookup = new Set(record.tags.map((tag) => tag.toLowerCase()));
  return tags.every((tag) => lookup.has(tag.toLowerCase()));
}

function applyCursor(events: CameraEventRecord[], cursor?: string): CameraEventRecord[] {
  if (!cursor) {
    return events;
  }
  const [timestamp, id] = cursor.split('|');
  const cursorTime = Date.parse(timestamp ?? '');
  return events.filter((event) => {
    const eventTime = Date.parse(event.timestamp);
    if (Number.isFinite(cursorTime) && Number.isFinite(eventTime)) {
      if (eventTime < cursorTime) {
        return true;
      }
      if (eventTime > cursorTime) {
        return false;
      }
      if (id) {
        return event.id.localeCompare(id) < 0;
      }
      return false;
    }
    if (!Number.isFinite(cursorTime)) {
      return event.id.localeCompare(id ?? '') < 0;
    }
    return false;
  });
}

export function listCameraEvents(options: CameraEventListOptions = {}): CameraEventListResult {
  const events = ensureEvents()
    .slice()
    .sort(compareEvents)
    .filter((event) => {
      if (options.cameraId && event.cameraId !== options.cameraId) {
        return false;
      }
      const eventTime = Date.parse(event.timestamp);
      if (options.start) {
        const startTime = options.start.getTime();
        if (Number.isFinite(eventTime) && eventTime < startTime) {
          return false;
        }
      }
      if (options.end) {
        const endTime = options.end.getTime();
        if (Number.isFinite(eventTime) && eventTime > endTime) {
          return false;
        }
      }
      if (!matchesConfidence(event, options.minConfidence, options.maxConfidence)) {
        return false;
      }
      if (!matchesTags(event, options.tags)) {
        return false;
      }
      return true;
    });

  const limited = applyCursor(events, options.cursor);
  const limit = options.limit ?? 50;
  const items = limited.slice(0, limit);
  const hasMore = limited.length > limit;
  const nextCursor = hasMore && items.length > 0 ? buildCursor(items[items.length - 1]) : null;

  return {
    events: items.map(toSummary),
    totalCount: events.length,
    hasMore,
    nextCursor,
  };
}

export function getCameraEvent(eventId: string): CameraEventDetail | null {
  const events = ensureEvents();
  const record = events.find((event) => event.id === eventId);
  if (!record) {
    return null;
  }
  return toDetail(record);
}

export function setCameraEventsForTests(events: CameraEventSeed[]): void {
  cachedEvents = events.map((event) => ({
    id: event.id,
    cameraId: event.cameraId,
    type: event.type,
    severity: event.severity,
    timestamp: event.timestamp,
    clipUrl: event.clipUrl ?? null,
    thumbnailUrl: event.thumbnailUrl ?? null,
    synopsis: event.synopsis ?? null,
    confidence: computeConfidence(event.id, event.severity, event.confidence),
    tags: deriveTags(event, event.tags),
    acknowledged: event.acknowledged ?? false,
    acknowledgedAt: event.acknowledgedAt ?? null,
    durationSeconds:
      event.durationSeconds ?? deriveDuration(event.id, event.durationSeconds ?? undefined),
    metadata: normalizeMetadata(event, event.metadata),
  }));
}

export function resetCameraEvents(): void {
  cachedEvents = null;
}
