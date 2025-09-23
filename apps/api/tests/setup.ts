process.env.NODE_ENV = 'test';
process.env.API_BEARER = process.env.API_BEARER ?? 'test-token';
process.env.TIMEOUT_MS = '200';
process.env.RETRY_MAX = '1';
process.env.RETRY_BACKOFF_MS = '10';
process.env.CIRCUIT_FAILURE_THRESHOLD = '2';
process.env.CIRCUIT_OPEN_MS = '1500';
process.env.RATE_LIMIT_WINDOW_MS = '1000';
process.env.RATE_LIMIT_MAX = '100';
process.env.RATE_LIMIT_BURST = '50';
process.env.RATE_LIMIT_GLOBAL_MAX = '200';
process.env.CORS_ALLOWED_ORIGINS = 'https://app.headspamartina.hr';
process.env.DEVICE_REGISTRY_JSON =
  process.env.DEVICE_REGISTRY_JSON ??
  JSON.stringify({
    devices: [
      {
        id: 'pi-audio-test',
        name: 'Test Audio Device',
        role: 'audio',
        baseUrl: 'http://127.0.0.1:0',
        token: 'device-token',
        capabilities: ['status', 'play', 'stop']
      }
    ]
  });
