#!/usr/bin/env node
/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');

const apiPort = Number.parseInt(process.env.API_HTTP_PORT ?? '3015', 10);
const uiPort = Number.parseInt(process.env.UI_HTTP_PORT ?? '4173', 10);
const apiBearer = process.env.API_BEARER ?? 'ci-test-bearer';
const registry = process.env.DEVICE_REGISTRY_JSON ?? '{"devices":[]}';

function prefixLines(prefix, data) {
  return data
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`)
    .join('\n');
}

function startProcess(name, command, args, options) {
  const child = spawn(command, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });

  child.stdout.on('data', (data) => {
    const text = prefixLines(`[${name}]`, data);
    if (text) {
      console.log(text);
    }
  });

  child.stderr.on('data', (data) => {
    const text = prefixLines(`[${name}]`, data);
    if (text) {
      console.error(text);
    }
  });

  child.on('exit', (code, signal) => {
    if (code !== 0 && signal == null) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  return child;
}

async function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function pollEndpoint({ label, url, expectedStatus, attempts = 30, delayMs = 1000, method = 'GET' }) {
  let lastError;
  let lastStatus;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(5000),
      });
      lastStatus = response.status;
      if (response.status === expectedStatus) {
        console.log(`✔ ${label} responded with expected status ${expectedStatus}`);
        return;
      }
      lastError = new Error(`unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    if (attempt < attempts) {
      await wait(delayMs);
    }
  }

  const details = lastError ? lastError.message : `status ${lastStatus}`;
  throw new Error(`${label} did not reach expected status ${expectedStatus}: ${details}`);
}

async function run() {
  console.log('Starting API and UI for smoke verification...');

  const apiProcess = startProcess(
    'api',
    process.execPath,
    ['dist/index.js'],
    {
      cwd: path.resolve(__dirname, '..', '..', 'apps', 'api'),
      env: {
        ...process.env,
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        HTTP_PORT: String(apiPort),
        API_BEARER: apiBearer,
        DEVICE_REGISTRY_JSON: registry,
        CORS_ALLOWED_ORIGINS: '*',
      },
    },
  );

  const uiProcess = startProcess(
    'ui',
    'npm',
    ['run', 'preview', '--', '--host', '127.0.0.1', '--port', String(uiPort)],
    {
      cwd: path.resolve(__dirname, '..', '..', 'apps', 'ui'),
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: String(uiPort),
        API_BASE_URL: `http://127.0.0.1:${apiPort}`,
        API_BEARER: '',
        VITE_USE_MOCKS: '1',
      },
    },
  );

  const processes = [apiProcess, uiProcess];

  let success = false;
  try {
    await pollEndpoint({
      label: 'API health check',
      url: `http://127.0.0.1:${apiPort}/healthz`,
      expectedStatus: 200,
    });

    await pollEndpoint({
      label: 'UI /ui/fleet/layout',
      url: `http://127.0.0.1:${uiPort}/ui/fleet/layout`,
      expectedStatus: 200,
    });

    await pollEndpoint({
      label: 'UI /ui/fleet/overview',
      url: `http://127.0.0.1:${uiPort}/ui/fleet/overview`,
      expectedStatus: 200,
    });

    await pollEndpoint({
      label: 'API /api/fleet/overview without bearer',
      url: `http://127.0.0.1:${apiPort}/api/fleet/overview`,
      expectedStatus: 401,
    });

    success = true;
    console.log('Smoke checks completed successfully.');
  } finally {
    for (const child of processes) {
      if (!child.killed) {
        child.kill('SIGTERM');
      }
    }

    // Give processes a moment to exit cleanly before forcing.
    await wait(1000);
    for (const child of processes) {
      if (!child.killed && child.exitCode == null) {
        child.kill('SIGKILL');
      }
    }
  }

  if (!success) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(`Smoke checks failed: ${error.message}`);
  process.exit(1);
});
