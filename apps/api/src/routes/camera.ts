import { Router } from 'express';
import { metrics } from '../observability/metrics.js';
import { createHttpError } from '../util/errors.js';
import { cameraEventIdParamSchema, cameraEventsQuerySchema } from '../util/schema/camera.js';
import { getCameraEvent, listCameraEvents } from '../services/cameraEvents.js';
import { deviceRegistry } from '../upstream/devices.js';

const CAMERA_OFFLINE_REASON = 'Camera hardware not attached';

const router = Router();

interface CameraDeviceSummary {
  id: string;
  name: string;
  location: string | null;
  capabilities: string[];
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

router.get('/summary', (_req, res) => {
  res.locals.routePath = '/api/camera/summary';
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
    events: [],
    clips: [],
    overview: {
      previewImage: null,
      streamUrl: null,
      lastMotion: null,
      health: 'offline',
      updatedAt: now,
    },
    summary: {
      status: 'offline',
      updatedAt: now,
      reason: CAMERA_OFFLINE_REASON,
      cameras: devices.map((device) => ({
        id: device.id,
        name: device.name,
        status: 'offline',
        lastSeen: null,
        reason: CAMERA_OFFLINE_REASON,
      })),
    },
    preview: {
      cameraId: null,
      status: 'unavailable',
      posterUrl: null,
      streamUrl: null,
      reason: CAMERA_OFFLINE_REASON,
      updatedAt: now,
    },
    eventFeed: [],
    status: 'offline',
    reason: CAMERA_OFFLINE_REASON,
  } as const;

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
      throw createHttpError(422, 'validation_failed', 'Cannot acknowledge camera event', {
        details: { eventId, reason: 'event_not_found' },
      });
    }

    res.status(202).json({
      status: 'accepted',
      eventId,
      acknowledgedAt: new Date().toISOString(),
      note: CAMERA_OFFLINE_REASON,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/preview/:cameraId', (req, res, next) => {
  res.locals.routePath = '/api/camera/preview/:cameraId';
  try {
    const { cameraId } = req.params;
    const device = deviceRegistry.getDevice(cameraId);
    if (!device || !isCameraDevice(device)) {
      throw createHttpError(404, 'not_found', `Camera ${cameraId} not registered`);
    }

    res.json({
      cameraId: device.id,
      status: 'unavailable',
      posterUrl: null,
      streamUrl: null,
      reason: CAMERA_OFFLINE_REASON,
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
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

export const cameraRouter = router;
