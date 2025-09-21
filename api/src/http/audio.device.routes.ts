import express from 'express';
import { getAudioAdapter } from '../adapters/devices.js';
import { prisma } from '../lib/db.js';
import { httpError } from './errors.js';

export const audioDeviceRouter = express.Router();
audioDeviceRouter.use(express.json());

const audioAdapter = getAudioAdapter();

// GET /api/audio/devices/:id/status
audioDeviceRouter.get('/devices/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device exists
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    const status = await audioAdapter.status(id);
    res.json({ status });
  } catch (error) {
    console.error('Device status error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to get status for device ${req.params.id}: ${error.message}`);
  }
});

// POST /api/audio/devices/:id/play
audioDeviceRouter.post('/devices/:id/play', async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return httpError(res, 400, 'MISSING_FILE_ID', 'fileId is required');
    }

    // Verify device exists and is audio type
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    // Get file path from database
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return httpError(res, 404, 'FILE_NOT_FOUND', `File ${fileId} not found`);
    }

    await audioAdapter.play(id, file.path);
    res.json({ success: true });
  } catch (error) {
    console.error('Device play error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to play on device ${req.params.id}: ${error.message}`);
  }
});

// POST /api/audio/devices/:id/pause
audioDeviceRouter.post('/devices/:id/pause', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device exists and is audio type
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    await audioAdapter.pause(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Device pause error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to pause device ${req.params.id}: ${error.message}`);
  }
});

// POST /api/audio/devices/:id/stop
audioDeviceRouter.post('/devices/:id/stop', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify device exists and is audio type
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    await audioAdapter.stop(id);
    res.json({ success: true });
  } catch (error) {
    console.error('Device stop error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to stop device ${req.params.id}: ${error.message}`);
  }
});

// POST /api/audio/devices/:id/volume
audioDeviceRouter.post('/devices/:id/volume', async (req, res) => {
  try {
    const { id } = req.params;
    const { value } = req.body;

    if (typeof value !== 'number') {
      return httpError(res, 400, 'INVALID_VOLUME', 'Volume value must be a number');
    }

    if (value < 0 || value > 2) {
      return httpError(res, 400, 'INVALID_VOLUME_RANGE', 'Volume must be between 0 and 2');
    }

    // Verify device exists and is audio type
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    await audioAdapter.volume(id, value);
    res.json({ success: true });
  } catch (error) {
    console.error('Device volume error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to set volume on device ${req.params.id}: ${error.message}`);
  }
});

// POST /api/audio/devices/:id/upload
audioDeviceRouter.post('/devices/:id/upload', async (req, res) => {
  try {
    const { id } = req.params;
    const { fileId } = req.body;

    if (!fileId) {
      return httpError(res, 400, 'MISSING_FILE_ID', 'fileId is required');
    }

    // Verify device exists and is audio type
    const device = await prisma.device.findUnique({
      where: { id },
    });

    if (!device) {
      return httpError(res, 404, 'DEVICE_NOT_FOUND', `Device ${id} not found`);
    }

    if (device.kind !== 'audio') {
      return httpError(res, 400, 'INVALID_DEVICE_TYPE', `Device ${id} is not an audio device`);
    }

    // Get file path from database
    const file = await prisma.file.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      return httpError(res, 404, 'FILE_NOT_FOUND', `File ${fileId} not found`);
    }

    await audioAdapter.upload(id, file.path);
    res.json({ success: true });
  } catch (error) {
    console.error('Device upload error:', error);
    return httpError(res, 500, 'DEVICE_ERROR', `Failed to upload to device ${req.params.id}: ${error.message}`);
  }
});