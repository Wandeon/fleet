import { defineConfig } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const artifactsDir = path.join(__dirname, 'artifacts');
const screenshotsDir = path.join(__dirname, 'screenshots');
fs.mkdirSync(artifactsDir, { recursive: true });
fs.mkdirSync(screenshotsDir, { recursive: true });

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.test\.js$/,
  timeout: 120000,
  expect: { timeout: 15000 },
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [
    ['list'],
    ['html', { outputFolder: path.join(__dirname, 'playwright-report'), open: 'never' }],
    ['junit', { outputFile: path.join(artifactsDir, 'junit-results.xml') }],
    ['json', { outputFile: path.join(artifactsDir, 'test-results.json') }],
  ],
  use: {
    baseURL: 'https://app.headspamartina.hr',
    ignoreHTTPSErrors: true,
    actionTimeout: 15000,
    navigationTimeout: 30000,
    trace: 'on',
    video: 'on',
    screenshot: 'on',
    launchOptions: { slowMo: 100 },
  },
  outputDir: path.join(artifactsDir, 'test-state'),
  projects: [{
    name: 'chromium',
    use: {
      browserName: 'chromium',
      viewport: { width: 1920, height: 1080 },
    },
  }],
});
