import { mockApi } from './mock';
import { rawRequest, USE_MOCKS, type RequestOptions } from './client';
import type { CameraEventEntry, CameraOverview, CameraPreviewState, CameraState, CameraSummaryItem } from '$lib/types';
import { UiApiError } from './client';

interface CameraSummaryResponse {
  cameras?: Record<string, unknown>[];
  status?: string;
  updatedAt?: string;
  reason?: string | null;
}

interface CameraEventsResponse {
  items?: Record<string, unknown>[];
  events?: Record<string, unknown>[];
  updatedAt?: string;
}

interface CameraPreviewResponse {
  cameraId?: string;
  url?: string | null;
  expiresAt?: string;
}

const ensureFetch = (fetchImpl?: typeof fetch) => fetchImpl ?? fetch;

const toCameraStatus = (value: unknown): CameraSummaryItem['status'] => {
  if (typeof value !== 'string') return 'offline';
  const normalised = value.toLowerCase();
  if (normalised === 'online' || normalised === 'ready') return 'online';
  if (normalised === 'degraded' || normalised === 'warn' || normalised === 'warning') return 'degraded';
  return 'offline';
};

const mapSummary = (payload: CameraSummaryResponse | unknown): CameraOverview => {
  const source = (payload ?? {}) as CameraSummaryResponse;
  const camerasRaw = Array.isArray(source.cameras) ? source.cameras : [];
  const cameras: CameraSummaryItem[] = camerasRaw.map((item) => {
    const status = toCameraStatus(item.status);
    return {
      id: typeof item.id === 'string' ? item.id : (typeof item.cameraId === 'string' ? item.cameraId : 'camera-unknown'),
      name: typeof item.name === 'string' ? item.name : 'Camera',
      status,
      lastSeen: typeof item.lastSeen === 'string' ? item.lastSeen : undefined,
      reason: typeof item.reason === 'string' ? item.reason : undefined,
    } satisfies CameraSummaryItem;
  });

  const overallStatus = (() => {
    if (cameras.every((camera) => camera.status === 'offline')) return 'offline';
    if (cameras.some((camera) => camera.status === 'degraded')) return 'degraded';
    if (cameras.some((camera) => camera.status === 'online')) return 'online';
    return 'offline';
  })();

  const fallbackUpdatedAt = new Date().toISOString();

  return {
    status: overallStatus,
    reason: source.reason ?? (overallStatus === 'offline' ? 'No camera streams available yet' : null),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : fallbackUpdatedAt,
    cameras,
  } satisfies CameraOverview;
};

const mapEvents = (payload: CameraEventsResponse | unknown): CameraEventEntry[] => {
  const source = (payload ?? {}) as CameraEventsResponse;
  const rows = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.events)
      ? source.events
      : [];

  return rows
    .map((item, index) => {
      const ts = typeof item.ts === 'string'
        ? item.ts
        : typeof item.timestamp === 'string'
          ? item.timestamp
          : new Date(Date.now() - index * 60_000).toISOString();
      const message = typeof item.message === 'string'
        ? item.message
        : typeof item.description === 'string'
          ? item.description
          : 'Camera event';
      const severityRaw = typeof item.severity === 'string' ? item.severity.toLowerCase() : 'info';
      const severity = (severityRaw === 'warning' ? 'warn' : severityRaw) as CameraEventEntry['severity'];
      return {
        id: typeof item.id === 'string' ? item.id : `camera-event-${index}`,
        ts,
        message,
        severity: ['info', 'warn', 'error'].includes(severity) ? severity : 'info',
        cameraId: typeof item.cameraId === 'string' ? item.cameraId : undefined,
        snapshotUrl: typeof item.snapshotUrl === 'string' ? item.snapshotUrl : undefined,
      } satisfies CameraEventEntry;
    })
    .sort((a, b) => b.ts.localeCompare(a.ts));
};

const mapPreview = (
  payload: CameraPreviewResponse | unknown,
  cameraId: string | null,
  fallbackReason: string | null,
  updatedAt: string,
): CameraPreviewState => {
  if (!payload || typeof payload !== 'object') {
    return {
      cameraId,
      status: 'unavailable',
      posterUrl: null,
      streamUrl: null,
      reason: fallbackReason ?? 'Preview unavailable',
      updatedAt,
    } satisfies CameraPreviewState;
  }

  const source = payload as CameraPreviewResponse;
  const url = typeof source.url === 'string' ? source.url : null;
  return {
    cameraId: typeof source.cameraId === 'string' ? source.cameraId : cameraId,
    status: url ? 'ready' : 'unavailable',
    posterUrl: url ? null : null,
    streamUrl: url,
    reason: url ? null : fallbackReason ?? 'Preview unavailable',
    updatedAt,
  } satisfies CameraPreviewState;
};

const failurePreview = (cameraId: string | null, reason: string, updatedAt: string): CameraPreviewState => ({
  cameraId,
  status: 'unavailable',
  posterUrl: null,
  streamUrl: null,
  reason,
  updatedAt,
});

export const loadCameraState = async (options: { fetch?: typeof fetch } = {}): Promise<CameraState> => {
  if (USE_MOCKS) {
    return mockApi.camera();
  }

  const fetchImpl = ensureFetch(options.fetch);

  try {
    const [summaryPayload, eventsPayload] = await Promise.all([
      rawRequest<CameraSummaryResponse>('/camera/summary', {
        fetch: fetchImpl as RequestOptions['fetch'],
      }),
      rawRequest<CameraEventsResponse>('/camera/events', {
        fetch: fetchImpl as RequestOptions['fetch'],
      })
    ]);

    const summary = mapSummary(summaryPayload);
    const events = mapEvents(eventsPayload);
    const primaryCamera = summary.cameras[0]?.id ?? null;

    let preview: CameraPreviewState;
    if (primaryCamera) {
      try {
        const previewPayload = await rawRequest<CameraPreviewResponse>(`/camera/preview/${primaryCamera}`, {
          fetch: fetchImpl as RequestOptions['fetch'],
        });
        preview = mapPreview(previewPayload, primaryCamera, summary.reason ?? null, summary.updatedAt);
      } catch (error) {
        const message = error instanceof UiApiError ? error.message : 'Preview unavailable';
        preview = failurePreview(primaryCamera, message, summary.updatedAt);
      }
    } else {
      preview = failurePreview(null, 'No cameras registered', summary.updatedAt);
    }

    return { summary, events, preview } satisfies CameraState;
  } catch (error) {
    const fallback = mockApi.camera();
    return {
      summary: {
        ...fallback.summary,
        reason: fallback.summary.reason ?? (error instanceof UiApiError ? error.message : 'Camera API unreachable'),
      },
      preview: {
        ...fallback.preview,
        reason: fallback.preview.reason ?? 'Camera preview unavailable',
      },
      events: fallback.events,
    } satisfies CameraState;
  }
};
