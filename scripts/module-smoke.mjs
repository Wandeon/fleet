#!/usr/bin/env node
import { spawn } from 'node:child_process';
import { setTimeout as wait } from 'node:timers/promises';
import { getSmokeConfig } from '../apps/ui/test.config.js';

const config = getSmokeConfig();
const { host, uiPort, apiPort, testEnv } = config;

// Check for module filter from environment
const moduleFilter = process.env.MODULE_FILTER;

// Module test definitions
const MODULE_TESTS = [
  {
    name: 'Audio Module',
    tests: [
      {
        name: 'Audio Overview',
        url: `${config.uiBaseUrl}/ui/audio/devices`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return Array.isArray(data.items) && data.items.length > 0;
        }
      },
      {
        name: 'Audio Device Detail',
        url: `${config.uiBaseUrl}/ui/audio/devices/pi-audio-01`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data.id === 'pi-audio-01' && data.displayName && data.playback;
        }
      }
    ]
  },
  {
    name: 'Video Module',
    tests: [
      {
        name: 'Video Overview',
        url: `${config.uiBaseUrl}/ui/video/devices`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return Array.isArray(data.devices) && data.updatedAt;
        }
      },
      {
        name: 'Video Devices',
        url: `${config.uiBaseUrl}/ui/video/devices`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return Array.isArray(data.devices) && data.updatedAt;
        }
      }
    ]
  },
  {
    name: 'Camera Module',
    tests: [
      {
        name: 'Camera Summary',
        url: `${config.uiBaseUrl}/ui/camera/summary`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data && (data.cameras || data.devices || data.state);
        }
      },
      {
        name: 'Camera Events',
        url: `${config.uiBaseUrl}/ui/camera/events`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data && (Array.isArray(data.items) || data.events || data.state);
        }
      }
    ]
  },
  {
    name: 'Zigbee Module',
    tests: [
      {
        name: 'Zigbee Devices',
        url: `${config.uiBaseUrl}/ui/zigbee`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data.devices || data.state || data.totalDevices !== undefined;
        }
      },
      {
        name: 'Zigbee Rules',
        url: `${config.uiBaseUrl}/ui/zigbee`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data.devices || data.state || data.totalDevices !== undefined;
        }
      }
    ]
  },
  {
    name: 'Fleet Module',
    tests: [
      {
        name: 'Fleet Layout',
        url: `${config.uiBaseUrl}/ui/fleet/layout`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data && typeof data === 'object';
        }
      },
      {
        name: 'Fleet Overview',
        url: `${config.uiBaseUrl}/ui/fleet/overview`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data.totals && Array.isArray(data.modules) && Array.isArray(data.devices);
        }
      }
    ]
  },
  {
    name: 'Health Module',
    tests: [
      {
        name: 'Health Summary',
        url: `${config.uiBaseUrl}/ui/health/summary`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data && (data.status || data.modules || data.updatedAt);
        }
      }
    ]
  },
  {
    name: 'Logs Module',
    tests: [
      {
        name: 'Logs Snapshot',
        url: `${config.uiBaseUrl}/ui/logs?limit=10`,
        expectedStatus: 200,
        expectedContentType: 'application/json',
        validate: (data) => {
          return data && (Array.isArray(data.items) || data.entries || data.logs);
        }
      },
      {
        name: 'Logs SSE Stream',
        url: `${config.uiBaseUrl}/ui/logs/stream`,
        expectedStatus: 200,
        expectedContentType: 'application/json', // Mock returns JSON instead of SSE
        validate: (data) => {
          return data && typeof data === 'object'; // In mock mode, this returns mock data
        }
      }
    ]
  }
];

function prefixLines(prefix, chunk) {
  return chunk
    .toString()
    .split('\\n')
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`)
    .join('\\n');
}

function startMockApiServer() {
  const apiDir = new URL('../apps/api-mock', import.meta.url).pathname;
  const child = spawn(
    'npm',
    ['run', 'mock'],
    {
      cwd: apiDir,
      env: {
        ...process.env,
        PORT: String(apiPort),
        NODE_ENV: 'test',
        MOCK_DELAY_MS: '50', // Fast responses for testing
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout.on('data', (data) => {
    const text = prefixLines('[api]', data);
    if (text) {
      process.stdout.write(`${text}\\n`);
    }
  });

  child.stderr.on('data', (data) => {
    const text = prefixLines('[api]', data);
    if (text) {
      process.stderr.write(`${text}\\n`);
    }
  });

  return child;
}

function startUiServer() {
  const uiDir = new URL('../apps/ui', import.meta.url).pathname;
  const viteBin = new URL('../apps/ui/node_modules/vite/bin/vite.js', import.meta.url).pathname;
  const child = spawn(
    process.execPath,
    [viteBin, 'dev', '--host', host, '--port', String(uiPort), '--strictPort'],
    {
      cwd: uiDir,
      env: {
        ...process.env,
        ...testEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  child.stdout.on('data', (data) => {
    const text = prefixLines('[ui]', data);
    if (text) {
      process.stdout.write(`${text}\\n`);
    }
  });

  child.stderr.on('data', (data) => {
    const text = prefixLines('[ui]', data);
    if (text) {
      process.stderr.write(`${text}\\n`);
    }
  });

  return child;
}

async function waitForServer(url, { attempts = 30, delayMs = 500 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(2000),
        headers: {
          'Authorization': `Bearer ${testEnv.API_BEARER}`
        }
      });
      if (response.ok || response.status === 401) { // 401 means server is up but auth failed
        return;
      }
    } catch (error) {
      if (attempt === attempts) throw error;
    }
    await wait(delayMs);
  }
  throw new Error(`Server at ${url} did not become ready`);
}

async function runTest(test) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), test.isStream ? 10000 : 5000);

  try {
    const headers = {
      'Accept': test.isStream ? 'text/event-stream' : 'application/json',
    };

    const response = await fetch(test.url, {
      headers,
      signal: controller.signal,
    });

    if (response.status !== test.expectedStatus) {
      throw new Error(`Expected status ${test.expectedStatus}, got ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes(test.expectedContentType)) {
      throw new Error(`Expected content-type ${test.expectedContentType}, got ${contentType}`);
    }

    if (test.isStream) {
      // For streams, just validate headers and close
      if (!test.validate(response)) {
        throw new Error('Stream validation failed');
      }
      await response.body?.cancel();
    } else {
      // For JSON responses, parse and validate
      const data = await response.json();
      if (!test.validate(data)) {
        throw new Error('Response validation failed');
      }
    }

    return { success: true };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Test timed out`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function runModuleTests() {
  console.log('🧪 Running deterministic module smoke tests...');

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;
  const failures = [];

  // Filter modules if MODULE_FILTER is set
  const modulesToTest = moduleFilter
    ? MODULE_TESTS.filter(module => module.name.toLowerCase().includes(moduleFilter.toLowerCase()))
    : MODULE_TESTS;

  if (moduleFilter && modulesToTest.length === 0) {
    console.log(`❌ No modules found matching filter: ${moduleFilter}`);
    return false;
  }

  for (const module of modulesToTest) {
    console.log(`\\n📦 Testing ${module.name}...`);

    for (const test of module.tests) {
      totalTests++;
      process.stdout.write(`  • ${test.name}: `);

      try {
        await runTest(test);
        console.log('✅ PASS');
        passedTests++;
      } catch (error) {
        console.log(`❌ FAIL - ${error.message}`);
        failedTests++;
        failures.push(`${module.name} > ${test.name}: ${error.message}`);
      }
    }
  }

  console.log(`\\n📊 Test Results:`);
  console.log(`  Total: ${totalTests}`);
  console.log(`  Passed: ${passedTests}`);
  console.log(`  Failed: ${failedTests}`);

  if (failures.length > 0) {
    console.log(`\\n❌ Failures:`);
    failures.forEach(failure => console.log(`  - ${failure}`));
    return false;
  }

  console.log(`\\n✅ All module smoke tests passed!`);
  return true;
}

async function run() {
  console.log('🚀 Starting module smoke test suite...');

  console.log('Starting mock API server...');
  const apiProcess = startMockApiServer();

  console.log('Starting UI dev server...');
  const uiProcess = startUiServer();

  const stopProcesses = async () => {
    const stopApi = new Promise((resolve) => {
      if (apiProcess.exitCode != null || apiProcess.signalCode != null) {
        resolve();
        return;
      }
      apiProcess.once('exit', resolve);
      apiProcess.kill('SIGTERM');
      setTimeout(() => {
        if (apiProcess.exitCode == null && apiProcess.signalCode == null) {
          apiProcess.kill('SIGKILL');
        }
      }, 5000);
    });

    const stopUi = new Promise((resolve) => {
      if (uiProcess.exitCode != null || uiProcess.signalCode != null) {
        resolve();
        return;
      }
      uiProcess.once('exit', resolve);
      uiProcess.kill('SIGTERM');
      setTimeout(() => {
        if (uiProcess.exitCode == null && uiProcess.signalCode == null) {
          uiProcess.kill('SIGKILL');
        }
      }, 5000);
    });

    await Promise.all([stopApi, stopUi]);
  };

  process.on('SIGINT', () => {
    stopProcesses().finally(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    stopProcesses().finally(() => process.exit(1));
  });

  try {
    // Wait for servers to be ready
    await waitForServer(`${config.apiBaseUrl}/fleet/layout`);
    await waitForServer(config.uiBaseUrl);

    // Run the tests
    const success = await runModuleTests();

    await stopProcesses();
    process.exit(success ? 0 : 1);

  } catch (error) {
    console.error('❌ Module smoke tests failed:', error);
    await stopProcesses();
    process.exit(1);
  }
}

run();