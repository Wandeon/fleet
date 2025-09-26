import { Router } from 'express';
import { deviceRegistry } from '../upstream/devices';
import { getCameraEvent, listCameraEvents } from '../services/cameraEvents.js';
import { cameraEventIdParamSchema, cameraEventsQuerySchema } from '../util/schema/camera.js';

const router = Router();

router.get('/', (req, res) => {
  res.locals.routePath = '/camera';
  const devices = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'));
  res.json({
    message: 'Camera API endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    total: devices.length,
    online: 0,
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      status: 'offline',
    })),
  });
});

// Add standard streams endpoint
router.get('/streams', (req, res) => {
  res.locals.routePath = '/camera/streams';
  const streams = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'offline',
    }));

  res.json({
    streams,
    total: streams.length,
    updatedAt: new Date().toISOString(),
  });
});

router.get('/streams/:id/status', (req, res) => {
  res.locals.routePath = '/camera/streams/:id/status';
  const { id } = req.params;
  const device = deviceRegistry.getDevice(id);

  if (!device || (device.module !== 'camera' && !device.role.includes('camera'))) {
    return res.status(404).json({
      error: 'Camera stream not found',
      id,
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: 'offline',
    reason: 'Camera stream not implemented',
    timestamp: new Date().toISOString(),
  });
});

router.get('/summary', (req, res) => {
  res.locals.routePath = '/camera/summary';
  const cameras = deviceRegistry
    .list()
    .filter((device) => device.module === 'camera' || device.role.includes('camera'))
    .map((device) => ({
      id: device.id,
      name: device.name,
      role: device.role,
      module: device.module,
      status: 'unimplemented',
    }));

  res.json({ cameras, updatedAt: new Date().toISOString() });
});

router.get('/events', (req, res, next) => {
  res.locals.routePath = '/camera/events';
  try {
    const params = cameraEventsQuerySchema.parse(req.query);
    const result = listCameraEvents({
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
      events: result.events,
      pagination: {
        total: result.totalCount,
        limit: params.limit,
        nextCursor: result.nextCursor,
        hasMore: result.hasMore,
      },
      filters: {
        cameraId: params.cameraId ?? null,
        start: params.start ?? null,
        end: params.end ?? null,
        tags: params.tags,
        minConfidence: params.minConfidence ?? null,
        maxConfidence: params.maxConfidence ?? null,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/events/:eventId', (req, res, next) => {
  res.locals.routePath = '/camera/events/:eventId';
  try {
    const { eventId } = cameraEventIdParamSchema.parse(req.params);
    const event = getCameraEvent(eventId);
    if (!event) {
      res.status(404).json({
        code: 'not_found',
        message: 'Camera event not found',
        eventId,
      });
      return;
    }
    res.json({
      event,
      retrievedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

export const cameraRouter = router;
