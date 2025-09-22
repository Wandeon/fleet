import express from 'express';
import { getZigbeeAdapter } from '../adapters/devices.js';

export const zigbeeDeviceRouter = express.Router();
zigbeeDeviceRouter.use(express.json());

// GET /api/zigbee/hubs/:id/status
zigbeeDeviceRouter.get('/hubs/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getZigbeeAdapter();
    const status = await adapter.status(id);

    res.json({ status });
  } catch (error) {
    console.error('Zigbee hub status error:', error);
    res.status(400).json({
      error: 'Failed to get Zigbee hub status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/zigbee/hubs/:id/permit_join
zigbeeDeviceRouter.post('/hubs/:id/permit_join', async (req, res) => {
  try {
    const { id } = req.params;
    const { duration = 60 } = req.body;
    const adapter = getZigbeeAdapter();
    await adapter.permitJoin(id, duration);

    res.json({ success: true });
  } catch (error) {
    console.error('Zigbee permit join error:', error);
    res.status(400).json({
      error: 'Failed to enable permit join',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/zigbee/hubs/:id/reset
zigbeeDeviceRouter.post('/hubs/:id/reset', async (req, res) => {
  try {
    const { id } = req.params;
    const adapter = getZigbeeAdapter();
    await adapter.reset(id);

    res.json({ success: true });
  } catch (error) {
    console.error('Zigbee reset error:', error);
    res.status(400).json({
      error: 'Failed to reset Zigbee hub',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// POST /api/zigbee/hubs/:id/publish
zigbeeDeviceRouter.post('/hubs/:id/publish', async (req, res) => {
  try {
    const { id } = req.params;
    const { topic, payload } = req.body;
    const adapter = getZigbeeAdapter();
    await adapter.publish(id, topic, payload);

    res.json({ success: true });
  } catch (error) {
    console.error('Zigbee publish error:', error);
    res.status(400).json({
      error: 'Failed to publish MQTT message',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});