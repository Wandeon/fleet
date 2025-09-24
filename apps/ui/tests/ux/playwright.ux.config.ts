import baseConfig from '../../playwright.config';
import { defineConfig } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  ...baseConfig,
  testDir: __dirname,
  testMatch: ['**/*.spec.ts'],
  projects: baseConfig.projects,
  use: {
    ...baseConfig.use
  },
  webServer: baseConfig.webServer
});
