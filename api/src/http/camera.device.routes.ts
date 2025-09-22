import express from 'express';
import { getCameraAdapter } from '../adapters/devices.js';

export const cameraDeviceRouter = express.Router();
cameraDeviceRouter.use(express.json());

// GET /api/camera/devices/:id/status
cameraDeviceRouter.get('/devices/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getCameraAdapter();
    const status = await adapter.status(id);

    res.json({ status });
  } catch (error) {
    console.error('Camera device status error:', error);
    res.status(400).json({
      error: 'Failed to get camera device status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/camera/devices/:id/reboot
cameraDeviceRouter.post('/devices/:id/reboot', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getCameraAdapter();
    await adapter.reboot(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Camera device reboot error:', error);
    res.status(400).json({
      error: 'Failed to reboot camera device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/camera/devices/:id/probe
cameraDeviceRouter.post('/devices/:id/probe', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getCameraAdapter();
    await adapter.probe(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Camera device probe error:', error);
    res.status(400).json({
      error: 'Failed to probe camera device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});