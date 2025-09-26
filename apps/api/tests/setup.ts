import { execSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
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
const tmpDir = resolve(process.cwd(), 'apps/api/tests/tmp');
mkdirSync(tmpDir, { recursive: true });
process.env.ZIGBEE_RULES_PATH =
  process.env.ZIGBEE_RULES_PATH ?? resolve(tmpDir, 'zigbee-rules.json');
process.env.ZIGBEE_RULES_FALLBACK_PATH =
  process.env.ZIGBEE_RULES_FALLBACK_PATH ??
  resolve(__dirname, '../../api-mock/fixtures/zigbee.rules.json');
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
        capabilities: ['status', 'play', 'stop'],
      },
    ],
  });

if (!process.env.PRISMA_MIGRATED) {
  const env = {
    ...process.env,
    DATABASE_URL: process.env.DATABASE_URL ?? 'file:./test.db',
  };
  execSync('npx prisma migrate deploy', { stdio: 'ignore', env });
  process.env.PRISMA_MIGRATED = 'true';
}
