/**
 * Centralized test configuration
 * Single source of truth for BASE_URL, AUTH, and test environment settings
 */

const TEST_DEFAULTS = {
  UI_PORT: 5173,
  API_PORT: 4010,
  HOST: '127.0.0.1',
  USE_MOCKS: true,
  AUTH_TOKEN: 'demo',
  TIMEOUTS: {
    DEFAULT: 5000,
    NETWORK: 2000,
    SERVER_STARTUP: 15000,
  },
};

/**
 * Resolve test configuration from environment variables with fallbacks
 */
function resolveTestConfig() {
  const host = process.env.TEST_HOST ?? TEST_DEFAULTS.HOST;
  const uiPort = Number.parseInt(process.env.TEST_UI_PORT ?? process.env.SMOKE_UI_PORT ?? String(TEST_DEFAULTS.UI_PORT), 10);
  const apiPort = Number.parseInt(process.env.TEST_API_PORT ?? process.env.SMOKE_API_PORT ?? String(TEST_DEFAULTS.API_PORT), 10);
  const useMocks = process.env.TEST_USE_MOCKS === '1' || process.env.VITE_USE_MOCKS === '1' || TEST_DEFAULTS.USE_MOCKS;
  const authToken = process.env.TEST_AUTH_TOKEN ?? process.env.API_BEARER ?? TEST_DEFAULTS.AUTH_TOKEN;

  return {
    host,
    uiPort,
    apiPort,
    useMocks,
    authToken,
    timeouts: TEST_DEFAULTS.TIMEOUTS,
    // Computed URLs
    uiBaseUrl: `http://${host}:${uiPort}`,
    apiBaseUrl: `http://${host}:${apiPort}/api`,
    // Environment variables for process spawning
    testEnv: {
      NODE_ENV: 'test',
      VITE_USE_MOCKS: useMocks ? '1' : '0',
      API_BASE_URL: `http://${host}:${apiPort}/api`,
      API_BEARER: authToken,
      TEST_HOST: host,
      TEST_UI_PORT: String(uiPort),
      TEST_API_PORT: String(apiPort),
    },
  };
}

/**
 * Get configuration for Playwright tests
 */
export function getPlaywrightConfig() {
  const config = resolveTestConfig();
  return {
    baseURL: config.uiBaseUrl,
    timeout: config.timeouts.DEFAULT,
    webServer: {
      command: `npm run dev -- --host ${config.host} --port ${config.uiPort}`,
      port: config.uiPort,
      reuseExistingServer: !process.env.CI,
      stdout: 'ignore',
      stderr: 'pipe',
      env: config.testEnv,
    },
    use: {
      baseURL: config.uiBaseUrl,
      trace: 'on-first-retry',
      headless: true,
    },
  };
}

/**
 * Get configuration for smoke tests
 */
export function getSmokeConfig() {
  const config = resolveTestConfig();
  return {
    host: config.host,
    uiPort: config.uiPort,
    apiPort: config.apiPort,
    uiBaseUrl: config.uiBaseUrl,
    apiBaseUrl: config.apiBaseUrl,
    testEnv: config.testEnv,
    timeouts: config.timeouts,
  };
}

/**
 * Get configuration for UX tests
 */
export function getUxConfig() {
  return getPlaywrightConfig(); // UX tests use same config as E2E
}

/**
 * Get configuration for unit tests (vitest/jest)
 */
export function getUnitConfig() {
  const config = resolveTestConfig();
  return {
    environment: 'jsdom',
    env: {
      ...config.testEnv,
      VITE_API_BASE: config.apiBaseUrl,
    },
    timeout: config.timeouts.DEFAULT,
  };
}

// Default export for direct usage
export default resolveTestConfig();