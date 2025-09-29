import { defineConfig, devices } from '@playwright/test';
import testConfig from '../../test.config.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  timeout: testConfig.timeouts.DEFAULT,
  use: {
    baseURL: testConfig.uiBaseUrl,
    trace: 'on-first-retry',
    headless: true,
  },
  webServer: {
    command: `npm run dev -- --host ${testConfig.host} --port ${testConfig.uiPort}`,
    port: testConfig.uiPort,
    reuseExistingServer: !process.env.CI,
    stdout: 'ignore',
    stderr: 'pipe',
    env: testConfig.testEnv,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
