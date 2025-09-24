import { defineConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const reportsDir = path.resolve(__dirname, '../../reports/acceptance');
fs.mkdirSync(reportsDir, { recursive: true });

export default defineConfig({
  testDir: __dirname,
  testMatch: /.*\.test\.js$/,
  timeout: 60000,
  expect: {
    timeout: Number(process.env.ACCEPTANCE_EXPECT_TIMEOUT || 15000),
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: [
    ['list'],
    ['junit', { outputFile: path.join(reportsDir, 'playwright-tests.xml') }],
    ['json', { outputFile: path.join(reportsDir, 'playwright-summary.json') }],
  ],
  use: {
    baseURL: process.env.UI_BASE_URL || 'http://localhost:4173',
    ignoreHTTPSErrors: process.env.ACCEPTANCE_INSECURE === '1',
    actionTimeout: 15000,
  },
  outputDir: path.join(reportsDir, 'playwright-artifacts'),
});
