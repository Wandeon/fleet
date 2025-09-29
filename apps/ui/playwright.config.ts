import { defineConfig, devices } from '@playwright/test';
import testConfig from './test.config.js';

export default defineConfig({
  testDir: 'tests/e2e',
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
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
  ],
});
