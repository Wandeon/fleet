#!/usr/bin/env node
import express from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 8084;
const BEARER_TOKEN = process.env.ZIGBEE_HUB_01_TOKEN || 'mock-zigbee-01-token';

app.use(express.json());

// Simple auth middleware
const auth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization' });
  }

  const token = authHeader.substring(7);
  if (token !== BEARER_TOKEN) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  next();
};

// Simulated state
let deviceState = {
  coordinator: 'ok',
  devices: 23,
  permit_join: false,
  permit_join_until: null,
  network_channel: 11,
  pan_id: '0x1234'
};

// Status endpoint
app.get('/status', auth, (req, res) => {
  res.json(deviceState);
});

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Permit join endpoint
app.post('/permit-join', auth, (req, res) => {
  const { seconds } = req.body;

  if (!seconds || typeof seconds !== 'number' || seconds < 0 || seconds > 3600) {
    return res.status(400).json({ error: 'Invalid seconds. Must be 0-3600' });
  }

  try {
    const now = new Date();
    const until = new Date(now.getTime() + seconds * 1000);

    // In real implementation:
    // execSync(`mosquitto_pub -h localhost -t zigbee2mqtt/bridge/request/permit_join -m '{"value": true, "time": ${seconds}}'`);

    console.log(`[ZIGBEE] Permit join enabled for ${seconds} seconds`);

    deviceState.permit_join = seconds > 0;
    deviceState.permit_join_until = seconds > 0 ? until.toISOString() : null;

    // Auto-disable after timeout
    if (seconds > 0) {
      setTimeout(() => {
        deviceState.permit_join = false;
        deviceState.permit_join_until = null;
        console.log('[ZIGBEE] Permit join auto-disabled');
      }, seconds * 1000);
    }

    res.json({
      ok: true,
      permit_join: deviceState.permit_join,
      until: deviceState.permit_join_until
    });
  } catch (error) {
    console.error('Permit join failed:', error.message);
    res.status(500).json({ error: 'Permit join failed' });
  }
});

// Reset network endpoint
app.post('/reset', auth, (req, res) => {
  try {
    console.log('[ZIGBEE] Network reset initiated');

    // In real implementation:
    // execSync('mosquitto_pub -h localhost -t zigbee2mqtt/bridge/request/restart -m ""');

    res.json({
      ok: true,
      message: 'Network reset initiated',
      estimated_downtime_seconds: 60
    });
  } catch (error) {
    console.error('Reset failed:', error.message);
    res.status(500).json({ error: 'Reset failed' });
  }
});

// Publish MQTT message endpoint
app.post('/publish', auth, (req, res) => {
  const { topic, message } = req.body;

  if (!topic || !message) {
    return res.status(400).json({ error: 'Topic and message required' });
  }

  try {
    // In real implementation:
    // execSync(`mosquitto_pub -h localhost -t "${topic}" -m '${JSON.stringify(message)}'`);

    console.log(`[ZIGBEE] Published to ${topic}:`, message);

    res.json({
      ok: true,
      topic,
      message,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Publish failed:', error.message);
    res.status(500).json({ error: 'Publish failed' });
  }
});

// Device list endpoint
app.get('/devices', auth, (req, res) => {
  // Mock device list
  res.json({
    devices: [
      { ieee: '0x00124b001234abcd', friendly_name: 'living_room_light', type: 'Router' },
      { ieee: '0x00124b001234abce', friendly_name: 'bedroom_sensor', type: 'EndDevice' },
      { ieee: '0x00124b001234abcf', friendly_name: 'kitchen_switch', type: 'Router' }
    ],
    total: deviceState.devices
  });
});

// Identify device endpoint
app.post('/identify', auth, (req, res) => {
  const { ieee, seconds = 3 } = req.body;

  if (!ieee) {
    return res.status(400).json({ error: 'IEEE address required' });
  }

  try {
    // In real implementation:
    // execSync(`mosquitto_pub -h localhost -t zigbee2mqtt/bridge/request/device/identify -m '{"id": "${ieee}", "options": {"duration": ${seconds}}}'`);

    console.log(`[ZIGBEE] Identifying device ${ieee} for ${seconds} seconds`);

    res.json({
      ok: true,
      ieee,
      duration_seconds: seconds
    });
  } catch (error) {
    console.error('Identify failed:', error.message);
    res.status(500).json({ error: 'Identify failed' });
  }
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(`# HELP zigbee_coordinator_status Coordinator status (1=ok, 0=error)
# TYPE zigbee_coordinator_status gauge
zigbee_coordinator_status{device="zigbee-hub-01"} ${deviceState.coordinator === 'ok' ? 1 : 0}

# HELP zigbee_device_count Number of connected Zigbee devices
# TYPE zigbee_device_count gauge
zigbee_device_count{device="zigbee-hub-01"} ${deviceState.devices}

# HELP zigbee_permit_join_status Permit join status (1=enabled, 0=disabled)
# TYPE zigbee_permit_join_status gauge
zigbee_permit_join_status{device="zigbee-hub-01"} ${deviceState.permit_join ? 1 : 0}

# HELP zigbee_network_channel Current network channel
# TYPE zigbee_network_channel gauge
zigbee_network_channel{device="zigbee-hub-01"} ${deviceState.network_channel}
`);
});

app.listen(PORT, () => {
  console.log(`Zigbee device shim listening on port ${PORT}`);
  console.log(`Coordinator: ${deviceState.coordinator}, Devices: ${deviceState.devices}`);
});