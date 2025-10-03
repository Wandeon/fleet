import { Router } from 'express';
import { metrics } from '../observability/metrics.js';
import { createHttpError } from '../util/errors.js';
import { cameraEventIdParamSchema, cameraEventsQuerySchema } from '../util/schema/camera.js';
import { getCameraEvent, listCameraEvents } from '../services/cameraEvents.js';
import { deviceRegistry } from '../upstream/devices.js';
import { log } from '../observability/logging.js';
import { config } from '../config.js';

const CAMERA_OFFLINE_REASON = 'Camera hardware not attached';

const router = Router();

interface CameraDeviceSummary {
  id: string;
  name: string;
  location: string | null;
  capabilities: string[];
}

interface CameraStatusResponse {
  ok: boolean;
  timestamp: string;
  duration: number;
  hls_url: string;
  rtsp_url: string;
  rtsp_reachable: boolean;
  preview: string[];
  error: string | null;
  last_success: string | null;
  cached: boolean;
}

async function fetchCameraStatus(deviceId: string): Promise<CameraStatusResponse | null> {
  try {
    const device = deviceRegistry.getDevice(deviceId);
    if (!device) {
      return null;
    }

    const response = await fetch(`${device.baseUrl}/status`, {
      method: 'GET',
      headers: device.authToken ? { Authorization: `Bearer ${device.authToken}` } : {},
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      log.warn({ deviceId, status: response.status }, 'Camera status endpoint returned error');
      return null;
    }

    const data = await response.json();
    return data as CameraStatusResponse;
  } catch (error) {
    log.debug({ deviceId, error }, 'Failed to fetch camera status');
    return null;
  }
}

function transformToProxyUrl(hlsUrl: string | null, baseUrl: string): string | null {
  if (!hlsUrl) return null;

  // Extract the path from the HLS URL (e.g., "/camera/index.m3u8")
  try {
    const url = new URL(hlsUrl);
    const path = url.pathname;
    // Transform to HTTPS proxy URL
    return `${baseUrl}/camera/stream${path}`;
  } catch {
    return null;
  }
}

function isCameraDevice(device: { role: string; module: string }): boolean {
  const normalizedRole = device.role.toLowerCase();
  return normalizedRole.includes('camera');
}

function listCameraDevices(): CameraDeviceSummary[] {
  return deviceRegistry
    .list()
    .filter((device) => isCameraDevice(device))
    .map((device) => ({
      id: device.id,
      name: device.name,
      location: typeof device.metadata?.location === 'string' ? device.metadata.location : null,
      capabilities: device.capabilities ?? [],
    }));
}

function recordOfflineMetrics(devices: CameraDeviceSummary[]): void {
  for (const device of devices) {
    metrics.camera_stream_online.labels(device.id).set(0);
  }
}

router.get('/overview', (_req, res) => {
  res.locals.routePath = '/camera/overview';
  const devices = listCameraDevices();
  const now = new Date().toISOString();

  recordOfflineMetrics(devices);

  const response = {
    activeCameraId: null,
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: 'offline',
      location: device.location,
      streamUrl: null,
      stillUrl: null,
      lastHeartbeat: now,
      capabilities: device.capabilities,
    })),
    overview: {
      streamUrl: null,
      previewImage: null,
      status: 'offline'
    },
    clips: [],
    events: [],
    status: 'offline',
    updatedAt: now,
  };

  res.json(response);
});

router.get('/active', (_req, res) => {
  res.locals.routePath = '/camera/active';
  const devices = listCameraDevices();

  const response = {
    activeCameraId: devices.length > 0 ? devices[0].id : null,
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: 'offline',
      location: device.location,
    })),
  };

  res.json(response);
});

router.post('/active', (req, res, next) => {
  res.locals.routePath = '/camera/active';
  try {
    const { cameraId } = req.body;

    if (!cameraId) {
      throw createHttpError(400, 'bad_request', 'cameraId is required');
    }

    const device = deviceRegistry.getDevice(cameraId);
    if (!device || !isCameraDevice(device)) {
      throw createHttpError(404, 'not_found', `Camera ${cameraId} not found`);
    }

    log.info({ cameraId }, 'Active camera updated');
    res.json({
      activeCameraId: cameraId,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ error }, 'Failed to set active camera');
    next(error);
  }
});

router.get('/summary', async (_req, res) => {
  res.locals.routePath = '/api/camera/summary';
  const devices = listCameraDevices();
  const now = new Date().toISOString();

  recordOfflineMetrics(devices);

  // Get the public base URL from CORS allowed origins (first one)
  const publicBaseUrl = config.corsAllowedOrigins[0] ?? 'https://app.headspamartina.hr';

  // Try to fetch status from the first camera device
  let activeCameraId: string | null = null;
  let streamUrl: string | null = null;
  let previewImage: string | null = null;
  let overallStatus: 'online' | 'offline' = 'offline';
  let reason: string = CAMERA_OFFLINE_REASON;

  if (devices.length > 0) {
    const primaryCamera = devices[0];

    // Check if camera is online via healthz endpoint (no auth required)
    const device = deviceRegistry.getDevice(primaryCamera.id);
    if (device) {
      try {
        const healthResponse = await fetch(`${device.baseUrl}/healthz`, {
          method: 'GET',
          signal: AbortSignal.timeout(3000),
        });

        if (healthResponse.ok) {
          activeCameraId = primaryCamera.id;
          // Use known HLS stream URL pattern and transform to HTTPS proxy
          streamUrl = `${publicBaseUrl}/camera/stream/camera/index.m3u8`;
          overallStatus = 'online';
          reason = '';
          metrics.camera_stream_online.labels(primaryCamera.id).set(1);
          log.debug({ deviceId: primaryCamera.id, streamUrl }, 'Camera online, providing stream URL');
        } else {
          metrics.camera_stream_online.labels(primaryCamera.id).set(0);
        }
      } catch (error) {
        log.debug({ deviceId: primaryCamera.id, error }, 'Camera healthz check failed');
        metrics.camera_stream_online.labels(primaryCamera.id).set(0);
      }
    }
  }

  const response = {
    activeCameraId,
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: device.id === activeCameraId ? 'online' : 'offline',
      location: device.location,
      streamUrl: device.id === activeCameraId ? streamUrl : null,
      stillUrl: null,
      lastHeartbeat: now,
      capabilities: device.capabilities,
    })),
    events: [],
    clips: [],
    overview: {
      previewImage,
      streamUrl,
      lastMotion: null,
      health: overallStatus,
      updatedAt: now,
    },
    summary: {
      status: overallStatus,
      updatedAt: now,
      reason,
      cameras: devices.map((device) => ({
        id: device.id,
        name: device.name,
        status: device.id === activeCameraId ? 'online' : 'offline',
        lastSeen: device.id === activeCameraId ? now : null,
        reason: device.id === activeCameraId ? '' : CAMERA_OFFLINE_REASON,
      })),
    },
    preview: {
      cameraId: activeCameraId,
      status: streamUrl ? 'available' : 'unavailable',
      posterUrl: null,
      streamUrl,
      reason: streamUrl ? '' : CAMERA_OFFLINE_REASON,
      updatedAt: now,
    },
    eventFeed: [],
    status: overallStatus,
    reason,
  };

  res.json(response);
});

router.get('/events', (req, res, next) => {
  res.locals.routePath = '/api/camera/events';
  try {
    const params = cameraEventsQuerySchema.parse(req.query);
    const now = new Date().toISOString();

    const pagination = {
      total: 0,
      limit: params.limit,
      nextCursor: null,
      hasMore: false,
    } as const;

    // Keep fixture support available behind the scenes for contract validation.
    const eventsFixture = listCameraEvents({
      cameraId: params.cameraId,
      start: params.start ? new Date(params.start) : undefined,
      end: params.end ? new Date(params.end) : undefined,
      minConfidence: params.minConfidence,
      maxConfidence: params.maxConfidence,
      tags: params.tags,
      limit: params.limit,
      cursor: params.cursor,
    });

    res.json({
      status: 'offline',
      reason: CAMERA_OFFLINE_REASON,
      events: [],
      pagination: {
        ...pagination,
        limit: params.limit,
      },
      filters: {
        cameraId: params.cameraId ?? null,
        start: params.start ?? null,
        end: params.end ?? null,
        tags: params.tags,
        minConfidence: params.minConfidence ?? null,
        maxConfidence: params.maxConfidence ?? null,
      },
      generatedAt: now,
      fixturesAvailable: eventsFixture.totalCount > 0,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/events/:eventId/ack', (req, res, next) => {
  res.locals.routePath = '/api/camera/events/:eventId/ack';
  try {
    const { eventId } = cameraEventIdParamSchema.parse(req.params);
    const event = getCameraEvent(eventId);
    if (!event) {
      log.warn({ eventId }, 'Camera event not found for acknowledgment');
      throw createHttpError(422, 'validation_failed', 'Cannot acknowledge camera event', {
        details: { eventId, reason: 'event_not_found' },
      });
    }

    log.info({ eventId, cameraId: event.cameraId }, 'Camera event acknowledged');
    res.status(202).json({
      status: 'accepted',
      eventId,
      acknowledgedAt: new Date().toISOString(),
      note: CAMERA_OFFLINE_REASON,
    });
  } catch (error) {
    log.error({ eventId: req.params.eventId, error }, 'Failed to acknowledge camera event');
    next(error);
  }
});

router.get('/preview/:cameraId', (req, res, next) => {
  res.locals.routePath = '/api/camera/preview/:cameraId';
  try {
    const { cameraId } = req.params;
    const device = deviceRegistry.getDevice(cameraId);
    if (!device || !isCameraDevice(device)) {
      log.warn({ cameraId }, 'Camera preview requested for unregistered camera');
      throw createHttpError(404, 'not_found', `Camera ${cameraId} not registered`);
    }

    log.info({ cameraId }, 'Camera preview requested');
    res.json({
      cameraId: device.id,
      status: 'unavailable',
      posterUrl: null,
      streamUrl: null,
      reason: CAMERA_OFFLINE_REASON,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    log.error({ cameraId: req.params.cameraId, error }, 'Failed to get camera preview');
    next(error);
  }
});

router.get('/streams', (_req, res) => {
  res.locals.routePath = '/api/camera/streams';
  const devices = listCameraDevices();
  const now = new Date().toISOString();

  recordOfflineMetrics(devices);

  const streams = devices.map((device) => ({
    id: device.id,
    name: device.name,
    status: 'offline',
    reason: CAMERA_OFFLINE_REASON,
    streamUrl: null,
    module: 'camera',
    updatedAt: now,
  }));

  res.json({
    streams,
    total: streams.length,
    updatedAt: now,
  });
});

router.post('/:id/refresh', async (req, res, next) => {
  res.locals.routePath = '/api/camera/:id/refresh';
  try {
    const { id } = req.params;
    const device = deviceRegistry.getDevice(id);

    if (!device || !isCameraDevice(device)) {
      log.warn({ cameraId: id }, 'Camera refresh requested for unregistered camera');
      throw createHttpError(404, 'not_found', `Camera ${id} not found`);
    }

    log.info({ cameraId: id }, 'Camera refresh requested');

    // Attempt to fetch fresh status
    const status = await fetchCameraStatus(id);

    res.json({
      cameraId: id,
      refreshedAt: new Date().toISOString(),
      status: status ? 'online' : 'offline',
      ...(status && { data: status }),
    });
  } catch (error) {
    log.error({ cameraId: req.params.id, error }, 'Failed to refresh camera');
    next(error);
  }
});

router.post('/probe', async (req, res, next) => {
  res.locals.routePath = '/api/camera/probe';
  try {
    const { cameraId } = req.body;
    const now = new Date().toISOString();

    log.info({ cameraId }, 'Camera probe requested');

    if (cameraId) {
      const device = deviceRegistry.getDevice(cameraId);
      if (!device || !isCameraDevice(device)) {
        throw createHttpError(404, 'not_found', `Camera ${cameraId} not found`);
      }

      const status = await fetchCameraStatus(cameraId);

      res.json({
        cameraId,
        probedAt: now,
        status: status ? 'reachable' : 'unreachable',
        reason: status ? '' : CAMERA_OFFLINE_REASON,
        result: status ? {
          rtsp_reachable: status.rtsp_reachable,
          hls_available: !!status.hls_url,
          preview_available: status.preview && status.preview.length > 0,
          last_success: status.last_success,
          cached: status.cached,
        } : null,
      });
    } else {
      const devices = listCameraDevices();
      const probeResults = await Promise.all(
        devices.map(async (device) => {
          const status = await fetchCameraStatus(device.id);
          return {
            cameraId: device.id,
            name: device.name,
            status: status ? 'reachable' : 'unreachable',
            reason: status ? '' : CAMERA_OFFLINE_REASON,
            rtsp_reachable: status?.rtsp_reachable ?? false,
            hls_available: !!status?.hls_url,
          };
        })
      );

      res.json({
        probedAt: now,
        cameras: probeResults,
        summary: {
          total: devices.length,
          reachable: probeResults.filter(r => r.status === 'reachable').length,
          unreachable: probeResults.filter(r => r.status === 'unreachable').length,
        },
      });
    }
  } catch (error) {
    log.error({ error }, 'Failed to probe camera');
    next(error);
  }
});

export const cameraRouter = router;
