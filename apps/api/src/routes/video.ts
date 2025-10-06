import { Router } from 'express';
import { z } from 'zod';
import multer from 'multer';
import {
  listVideoDevices,
  setDevicePower,
  setDeviceMute,
  setDeviceInput,
  setDeviceVolume,
  runDevicePlayback,
  requestPreviewSession,
  listRecordingSegments,
  createClipExport,
} from '../services/video.js';
import { log } from '../observability/logging.js';
import { deviceRegistry } from '../upstream/devices.js';
import { httpRequestJson, httpRequest } from '../upstream/http.js';
import createHttpError from 'http-errors';

const router = Router();

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 500 * 1024 * 1024 } }); // 500MB limit

const powerSchema = z.object({ power: z.enum(['on', 'standby']) });
const muteSchema = z.object({ mute: z.boolean() });
const inputSchema = z.object({ input: z.string().min(1) });
const volumeSchema = z.object({ volumePercent: z.coerce.number().int().min(0).max(100) });
const playbackSchema = z.object({
  action: z.enum(['play', 'pause', 'resume', 'stop']),
  url: z.string().url().optional(),
  startSeconds: z.coerce.number().min(0).optional(),
});
const previewSchema = z.object({ deviceId: z.string().min(1).optional() });
const clipExportSchema = z.object({
  startOffsetSeconds: z.coerce.number().min(0),
  endOffsetSeconds: z.coerce.number().min(0),
});

router.get('/', (_req, res) => {
  res.locals.routePath = '/video';
  const devices = listVideoDevices();
  res.json({
    message: 'Video API endpoint',
    status: 'active',
    timestamp: new Date().toISOString(),
    total: devices.length,
    devices,
  });
});

router.get('/overview', (_req, res) => {
  res.locals.routePath = '/video/overview';
  const devices = listVideoDevices();
  const online = devices.filter((device) => device.power === 'on').length;
  res.json({
    devices,
    total: devices.length,
    online,
    updatedAt: new Date().toISOString(),
  });
});

// Add missing displays endpoints
router.get('/displays', (_req, res) => {
  res.locals.routePath = '/video/displays';
  const displays = listVideoDevices().map((device) => ({
    id: device.id,
    name: device.name,
    role: device.role,
    module: device.module,
    status: device.status,
  }));

  res.json({
    displays,
    total: displays.length,
    updatedAt: new Date().toISOString(),
  });
});

router.get('/displays/:id/status', (req, res) => {
  res.locals.routePath = '/video/displays/:id/status';
  const { id } = req.params;
  const device = listVideoDevices().find((item) => item.id === id);

  if (!device) {
    return res.status(404).json({
      error: 'Display not found',
      id,
    });
  }

  res.json({
    id: device.id,
    name: device.name,
    status: device.status,
    power: device.power,
    timestamp: new Date().toISOString(),
  });
});

router.get('/devices', (req, res) => {
  res.locals.routePath = '/video/devices';
  const devices = listVideoDevices();
  res.json({ devices, updatedAt: new Date().toISOString() });
});

router.post('/devices/:deviceId/commands', (req, res) => {
  res.locals.routePath = '/video/devices/:deviceId/commands';
  const { deviceId } = req.params;
  res.json({
    deviceId,
    accepted: false,
    message: 'Video control coming soon',
  });
});

router.post('/devices/:deviceId/power', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/power';
  try {
    const { deviceId } = req.params;
    const payload = powerSchema.parse(req.body);
    log.info({ deviceId, power: payload.power }, 'Video device power change requested');
    const { jobId, state } = await setDevicePower(deviceId, payload.power);
    log.info({ deviceId, power: state.power, jobId }, 'Video device power changed');
    res.status(202).json({
      deviceId: state.deviceId,
      power: state.power,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to change video device power');
    next(error);
  }
});

router.post('/devices/:deviceId/mute', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/mute';
  try {
    const { deviceId } = req.params;
    const payload = muteSchema.parse(req.body);
    log.info({ deviceId, mute: payload.mute }, 'Video device mute change requested');
    const { jobId, state } = await setDeviceMute(deviceId, payload.mute);
    log.info({ deviceId, mute: state.mute, jobId }, 'Video device mute changed');
    res.status(202).json({
      deviceId: state.deviceId,
      mute: state.mute,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to change video device mute');
    next(error);
  }
});

router.post('/devices/:deviceId/input', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/input';
  try {
    const { deviceId } = req.params;
    const payload = inputSchema.parse(req.body);
    log.info({ deviceId, input: payload.input }, 'Video device input change requested');
    const { jobId, state } = await setDeviceInput(deviceId, payload.input);
    log.info({ deviceId, input: state.input, jobId }, 'Video device input changed');
    res.status(202).json({
      deviceId: state.deviceId,
      input: state.input,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to change video device input');
    next(error);
  }
});

router.post('/devices/:deviceId/volume', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/volume';
  try {
    const { deviceId } = req.params;
    const payload = volumeSchema.parse(req.body);
    log.info({ deviceId, volumePercent: payload.volumePercent }, 'Video device volume change requested');
    const { jobId, state } = await setDeviceVolume(deviceId, payload.volumePercent);
    log.info({ deviceId, volumePercent: state.volume, jobId }, 'Video device volume changed');
    res.status(202).json({
      deviceId: state.deviceId,
      volumePercent: state.volume,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to change video device volume');
    next(error);
  }
});

router.post('/devices/:deviceId/playback', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/playback';
  try {
    const { deviceId } = req.params;
    const payload = playbackSchema.parse(req.body);
    log.info(
      {
        deviceId,
        action: payload.action,
        url: payload.url,
        startSeconds: payload.startSeconds,
      },
      'Video device playback control requested'
    );
    const { jobId, state } = await runDevicePlayback(deviceId, payload.action, {
      url: payload.url ?? null,
      startSeconds: payload.startSeconds ?? null,
    });
    log.info({ deviceId, action: payload.action, jobId }, 'Video device playback control applied');
    res.status(202).json({
      deviceId: state.deviceId,
      playback: state.playback,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to control video device playback');
    next(error);
  }
});

router.get('/recordings', (_req, res) => {
  res.locals.routePath = '/video/recordings';
  const recordings = listRecordingSegments();
  res.json({ items: recordings, total: recordings.length, generatedAt: new Date().toISOString() });
});

router.post('/recordings/:recordingId/export', (req, res, next) => {
  res.locals.routePath = '/video/recordings/:recordingId/export';
  try {
    const { recordingId } = req.params;
    const payload = clipExportSchema.parse(req.body);
    log.info(
      {
        recordingId,
        startOffsetSeconds: payload.startOffsetSeconds,
        endOffsetSeconds: payload.endOffsetSeconds,
      },
      'Video clip export requested'
    );
    const result = createClipExport(recordingId, payload);
    log.info({ recordingId, exportId: result.exportId }, 'Video clip export created');
    res.status(202).json(result);
  } catch (error) {
    log.error({ recordingId: req.params.recordingId, error }, 'Failed to export video clip');
    next(error);
  }
});

router.post('/preview', (req, res, next) => {
  res.locals.routePath = '/video/preview';
  try {
    const payload = previewSchema.parse(req.body ?? {});
    log.info({ deviceId: payload.deviceId }, 'Video preview session requested');
    const session = requestPreviewSession(payload.deviceId);
    log.info({ sessionId: session.sessionId, deviceId: session.device.id }, 'Video preview session created');
    res.json(session);
  } catch (error) {
    log.error({ error }, 'Failed to create video preview session');
    next(error);
  }
});

router.get('/devices/:deviceId/library', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/library';
  try {
    const { deviceId } = req.params;
    const device = deviceRegistry.requireDevice(deviceId);

    log.info({ deviceId }, 'Video library list requested');

    const data = await httpRequestJson<{ videos: unknown[] }>(device, '/library');

    log.info({ deviceId, count: data.videos?.length || 0 }, 'Video library fetched');
    res.json(data);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to fetch video library');
    next(error);
  }
});

router.post('/devices/:deviceId/library/upload', upload.single('file'), async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/library/upload';
  try {
    const { deviceId } = req.params;
    const file = req.file;

    if (!file) {
      throw createHttpError(400, 'bad_request', 'Missing upload file');
    }

    const device = deviceRegistry.requireDevice(deviceId);

    log.info(
      { deviceId, filename: file.originalname, size: file.size },
      'Video upload to device requested'
    );

    const formData = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype });
    formData.append('file', blob, file.originalname || 'video');

    const response = await httpRequest(device, '/library/upload', {
      method: 'POST',
      body: formData,
      timeoutMs: 300000, // 5 minute timeout for large videos
    });

    const result = await response.json();
    log.info({ deviceId, filename: result.filename }, 'Video uploaded to device');
    res.json(result);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to upload video to device');
    next(error);
  }
});

router.delete('/devices/:deviceId/library/:filename', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/library/:filename';
  try {
    const { deviceId, filename } = req.params;
    const device = deviceRegistry.requireDevice(deviceId);

    log.info({ deviceId, filename }, 'Video deletion from device requested');

    const result = await httpRequestJson(device, `/library/${encodeURIComponent(filename)}`, {
      method: 'DELETE',
    });

    log.info({ deviceId, filename }, 'Video deleted from device');
    res.json(result);
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, filename: req.params.filename, error }, 'Failed to delete video from device');
    next(error);
  }
});

router.post('/devices/:deviceId/library/play', async (req, res, next) => {
  res.locals.routePath = '/video/devices/:deviceId/library/play';
  try {
    const { deviceId } = req.params;
    const { filename } = z.object({ filename: z.string().min(1) }).parse(req.body);
    const device = deviceRegistry.requireDevice(deviceId);

    log.info({ deviceId, filename }, 'Video library play requested');

    const result = await httpRequestJson<{ jobId?: string }>(device, '/library/play', {
      method: 'POST',
      body: JSON.stringify({ filename }),
      headers: { 'Content-Type': 'application/json' },
    });

    log.info({ deviceId, filename }, 'Video playback started');
    res.status(202).json({
      deviceId,
      filename,
      accepted: true,
      jobId: result.jobId || res.locals.correlationId,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    log.error({ deviceId: req.params.deviceId, error }, 'Failed to play video from library');
    next(error);
  }
});

// Convenience routes for primary TV (pi-video-01)
// These routes provide a simpler API for the UI that doesn't require device ID in the path
const PRIMARY_VIDEO_DEVICE = 'pi-video-01';

router.post('/tv/power', async (req, res, next) => {
  res.locals.routePath = '/video/tv/power';
  try {
    const { on } = z.object({ on: z.boolean() }).parse(req.body);
    const power: 'on' | 'standby' = on ? 'on' : 'standby';
    log.info({ power }, 'TV power control requested via convenience route');
    const { jobId, state } = await setDevicePower(PRIMARY_VIDEO_DEVICE, power);
    log.info({ power, jobId }, 'TV power control accepted');
    res.status(202).json({
      deviceId: state.deviceId,
      power: state.power,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    log.error({ error }, 'Failed to control TV power via convenience route');
    next(error);
  }
});

router.post('/tv/input', async (req, res, next) => {
  res.locals.routePath = '/video/tv/input';
  try {
    const { input } = z.object({ input: z.string().min(1) }).parse(req.body);
    log.info({ input }, 'TV input control requested via convenience route');
    const { jobId, state } = await setDeviceInput(PRIMARY_VIDEO_DEVICE, input);
    log.info({ input, jobId }, 'TV input control accepted');
    res.status(202).json({
      deviceId: state.deviceId,
      input: state.input,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    log.error({ error }, 'Failed to control TV input via convenience route');
    next(error);
  }
});

router.post('/tv/volume', async (req, res, next) => {
  res.locals.routePath = '/video/tv/volume';
  try {
    const { volume } = z.object({ volume: z.coerce.number().int().min(0).max(100) }).parse(req.body);
    log.info({ volume }, 'TV volume control requested via convenience route');
    const { jobId, state } = await setDeviceVolume(PRIMARY_VIDEO_DEVICE, volume);
    log.info({ volume, jobId }, 'TV volume control accepted');
    res.status(202).json({
      deviceId: state.deviceId,
      volumePercent: state.volume,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    log.error({ error }, 'Failed to control TV volume via convenience route');
    next(error);
  }
});

router.post('/tv/mute', async (req, res, next) => {
  res.locals.routePath = '/video/tv/mute';
  try {
    const { mute } = z.object({ mute: z.boolean() }).parse(req.body);
    log.info({ mute }, 'TV mute control requested via convenience route');
    const { jobId, state } = await setDeviceMute(PRIMARY_VIDEO_DEVICE, mute);
    log.info({ mute, jobId }, 'TV mute control accepted');
    res.status(202).json({
      deviceId: state.deviceId,
      mute: state.mute,
      lastUpdated: state.lastUpdated,
      accepted: true,
      jobId,
      correlationId: res.locals.correlationId,
    });
  } catch (error) {
    log.error({ error }, 'Failed to control TV mute via convenience route');
    next(error);
  }
});

export const videoRouter = router;
