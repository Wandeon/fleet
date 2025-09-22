import express from 'express';
import { getVideoAdapter } from '../adapters/devices.js';

export const videoDeviceRouter = express.Router();
videoDeviceRouter.use(express.json());

// GET /api/video/devices/:id/status
videoDeviceRouter.get('/devices/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getVideoAdapter();
    const status = await adapter.status(id);

    res.json({ status });
  } catch (error) {
    console.error('Video device status error:', error);
    res.status(400).json({
      error: 'Failed to get video device status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/video/devices/:id/power_on
videoDeviceRouter.post('/devices/:id/power_on', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getVideoAdapter();
    await adapter.powerOn(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Video device power on error:', error);
    res.status(400).json({
      error: 'Failed to power on video device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/video/devices/:id/power_off
videoDeviceRouter.post('/devices/:id/power_off', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getVideoAdapter();
    await adapter.powerOff(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Video device power off error:', error);
    res.status(400).json({
      error: 'Failed to power off video device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/video/devices/:id/input
videoDeviceRouter.post('/devices/:id/input', async (req, res) => {
  try {
    const { id } = req.params;
    const { source } = req.body;
    const adapter = getVideoAdapter();
    await adapter.setInput(id, source);

    res.json({ success: true });
  } catch (error) {
    console.error('Video device input error:', error);
    res.status(400).json({
      error: 'Failed to set video device input',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});