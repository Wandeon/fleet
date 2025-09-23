import { Router } from 'express';
import multer from 'multer';
import { deviceRegistry } from '../upstream/devices';
import {
  fetchStatus,
  fetchConfig,
  updateConfig,
  setVolume,
  play,
  stop,
  uploadFallback
} from '../upstream/audio';
import {
  audioConfigSchema,
  audioPlaySchema,
  audioVolumeSchema,
  deviceIdParamSchema
} from '../util/schema/audio';
import { recordEvent } from '../observability/events';
import { createHttpError } from '../util/errors';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

router.get('/:deviceId/status', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/status';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const device = deviceRegistry.requireDevice(deviceId);
    const status = await fetchStatus(device, req.correlationId);
    res.json({ deviceId, status });
  } catch (error) {
    next(error);
  }
});

router.get('/:deviceId/config', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/config';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const device = deviceRegistry.requireDevice(deviceId);
    const config = await fetchConfig(device, req.correlationId);
    res.json({ deviceId, config });
  } catch (error) {
    next(error);
  }
});

router.put('/:deviceId/config', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/config';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioConfigSchema.parse(req.body);
    const device = deviceRegistry.requireDevice(deviceId);
    const config = await updateConfig(device, payload, req.correlationId);
    recordEvent({
      type: 'audio.config',
      target: deviceId,
      message: 'Audio configuration updated',
      severity: 'info',
      metadata: payload
    });
    res.json({ deviceId, config });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/volume', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/volume';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioVolumeSchema.parse(req.body);
    const device = deviceRegistry.requireDevice(deviceId);
    const config = await setVolume(device, payload.volume, req.correlationId);
    recordEvent({
      type: 'audio.volume',
      target: deviceId,
      message: `Volume set to ${payload.volume}`,
      severity: 'info'
    });
    res.json({ deviceId, config });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/play', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/play';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const payload = audioPlaySchema.parse(req.body);
    const device = deviceRegistry.requireDevice(deviceId);
    const config = await play(device, payload, req.correlationId);
    recordEvent({
      type: 'audio.play',
      target: deviceId,
      message: `Playback started from ${payload.source}`,
      severity: 'info',
      metadata: payload
    });
    res.json({ deviceId, config });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/stop', async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/stop';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const device = deviceRegistry.requireDevice(deviceId);
    const config = await stop(device, req.correlationId);
    recordEvent({
      type: 'audio.stop',
      target: deviceId,
      message: 'Playback stopped',
      severity: 'info'
    });
    res.json({ deviceId, config });
  } catch (error) {
    next(error);
  }
});

router.post('/:deviceId/upload', upload.single('file'), async (req, res, next) => {
  res.locals.routePath = '/audio/:deviceId/upload';
  try {
    const { deviceId } = deviceIdParamSchema.parse(req.params);
    res.locals.deviceId = deviceId;
    const device = deviceRegistry.requireDevice(deviceId);
    const file = req.file;
    if (!file) {
      throw createHttpError(400, 'bad_request', 'Missing upload file');
    }

    const result = await uploadFallback(
      device,
      {
        buffer: file.buffer,
        filename: file.originalname,
        mimetype: file.mimetype
      },
      req.correlationId
    );

    recordEvent({
      type: 'audio.upload',
      target: deviceId,
      message: `Fallback uploaded: ${file.originalname}`,
      severity: 'info'
    });

    res.json({ deviceId, result });
  } catch (error) {
    next(error);
  }
});

export const audioRouter = router;
