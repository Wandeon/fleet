#!/usr/bin/env node
import express from 'express';
import { execSync } from 'child_process';

const app = express();
const PORT = process.env.PORT || 8083;
const BEARER_TOKEN = process.env.CAMERA_PI_CAMERA_01_TOKEN || 'mock-camera-01-token';

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
  streaming: true,
  latency_ms: 42,
  bitrate_kbps: 3500,
  resolution: '1920x1080',
  fps: 30
};

// Status endpoint
app.get('/status', auth, (req, res) => {
  res.json(deviceState);
});

// Health check
app.get('/healthz', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Probe endpoint - trigger capture/self-check
app.post('/probe', auth, (req, res) => {
  try {
    const timestamp = new Date().toISOString();

    // In real implementation:
    // execSync('ffmpeg -f v4l2 -i /dev/video0 -frames:v 1 -f image2 /tmp/probe.jpg');
    // const frameData = fs.readFileSync('/tmp/probe.jpg', 'base64');

    console.log('[CAMERA] Probe executed - capturing test frame');

    // Mock response with simulated frame data
    const mockFrameData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

    res.json({
      ok: true,
      frame: mockFrameData,
      ts: timestamp,
      resolution: deviceState.resolution,
      format: 'jpeg'
    });
  } catch (error) {
    console.error('Probe failed:', error.message);
    res.status(500).json({ error: 'Probe failed' });
  }
});

// Reboot endpoint
app.post('/reboot', auth, (req, res) => {
  try {
    console.log('[CAMERA] Reboot command received');

    // In real implementation:
    // execSync('sudo systemctl restart camera-service');

    res.json({
      ok: true,
      message: 'Camera reboot initiated',
      estimated_downtime_seconds: 30
    });
  } catch (error) {
    console.error('Reboot failed:', error.message);
    res.status(500).json({ error: 'Reboot failed' });
  }
});

// Stream info endpoint
app.get('/stream-info', auth, (req, res) => {
  res.json({
    rtsp_url: 'rtsp://pi-camera-01:8554/camera',
    hls_url: 'http://pi-camera-01:8888/camera/index.m3u8',
    webrtc_url: 'http://pi-camera-01:8889/camera',
    ...deviceState
  });
});

// Metrics endpoint for Prometheus
app.get('/metrics', (req, res) => {
  res.type('text/plain');
  res.send(`# HELP camera_streaming_status Camera streaming status (1=streaming, 0=stopped)
# TYPE camera_streaming_status gauge
camera_streaming_status{device="pi-camera-01"} ${deviceState.streaming ? 1 : 0}

# HELP camera_latency_ms Camera latency in milliseconds
# TYPE camera_latency_ms gauge
camera_latency_ms{device="pi-camera-01"} ${deviceState.latency_ms}

# HELP camera_bitrate_kbps Camera bitrate in kbps
# TYPE camera_bitrate_kbps gauge
camera_bitrate_kbps{device="pi-camera-01"} ${deviceState.bitrate_kbps}

# HELP camera_fps Camera frames per second
# TYPE camera_fps gauge
camera_fps{device="pi-camera-01"} ${deviceState.fps}
`);
});

app.listen(PORT, () => {
  console.log(`Camera device shim listening on port ${PORT}`);
  console.log(`Streaming: ${deviceState.streaming}, Resolution: ${deviceState.resolution}`);
});