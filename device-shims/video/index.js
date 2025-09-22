#!/usr/bin/env node
import express from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 8082;
const BEARER_TOKEN = process.env.HDMI_PI_VIDEO_01_TOKEN || 'mock-video-01-token';

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
  power: 'off',
  input: 'HDMI1',
  cec_ok: true
};

// Status endpoint
app.get('/status', auth, (req, res) => {
  res.json(deviceState);
});

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Power control
app.post('/power', auth, (req, res) => {
  const { state } = req.body;

  if (!state || !['on', 'off'].includes(state)) {
    return res.status(400).json({ error: 'Invalid state. Must be "on" or "off"' });
  }

  try {
    // In real implementation: execSync(`cec-client -s -d 1 -t 1 <<< "${state === 'on' ? 'on 0' : 'standby 0'}"`);
    console.log(`[VIDEO] Power ${state} command executed`);

    deviceState.power = state;
    res.json({ ok: true, power: state });
  } catch (error) {
    console.error('Power command failed:', error.message);
    res.status(500).json({ error: 'Power command failed' });
  }
});

// Input control
app.post('/input', auth, (req, res) => {
  const { source } = req.body;

  if (!source || !['HDMI1', 'HDMI2', 'AV'].includes(source)) {
    return res.status(400).json({ error: 'Invalid source. Must be HDMI1, HDMI2, or AV' });
  }

  try {
    // In real implementation: execSync(`cec-client -s -d 1 -t 1 <<< "as"`); // Active source
    console.log(`[VIDEO] Input switched to ${source}`);

    deviceState.input = source;
    res.json({ ok: true, input: source });
  } catch (error) {
    console.error('Input command failed:', error.message);
    res.status(500).json({ error: 'Input command failed' });
  }
});

// Legacy TV power endpoints (compatibility)
app.post('/tv/power_on', auth, (req, res) => {
  deviceState.power = 'on';
  res.json({ ok: true, power: 'on' });
});

app.post('/tv/power_off', auth, (req, res) => {
  deviceState.power = 'off';
  res.json({ ok: true, power: 'off' });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(`# HELP video_device_power_state Current power state (1=on, 0=off)
# TYPE video_device_power_state gauge
video_device_power_state{device="pi-video-01"} ${deviceState.power === 'on' ? 1 : 0}

# HELP video_device_cec_ok CEC communication status (1=ok, 0=error)
# TYPE video_device_cec_ok gauge
video_device_cec_ok{device="pi-video-01"} ${deviceState.cec_ok ? 1 : 0}
`);
});

app.listen(PORT, () => {
  console.log(`Video device shim listening on port ${PORT}`);
  console.log(`Power: ${deviceState.power}, Input: ${deviceState.input}`);
});