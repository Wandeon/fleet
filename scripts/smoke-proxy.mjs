#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as wait } from 'node:timers/promises';
import { getSmokeConfig } from '../apps/ui/test.config.js';

const smokeConfig = getSmokeConfig();
const { host, uiPort, apiPort, testEnv } = smokeConfig;

function prefixLines(prefix, chunk) {
  return chunk
    .toString()
    .split('\n')
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`)
    .join('\n');
}

function startUiProcess(env = {}) {
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
        ...env,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );

  child.stdout.on('data', (data) => {
    const text = prefixLines('[ui]', data);
    if (text) {
      process.stdout.write(`${text}\n`);
    }
  });

  child.stderr.on('data', (data) => {
    const text = prefixLines('[ui]', data);
    if (text) {
      process.stderr.write(`${text}\n`);
    }
  });

  return child;
}

function startSseServer() {
  const server = http.createServer((req, res) => {
    if (!req.url) {
      res.writeHead(400).end();
      return;
    }

    const url = new URL(req.url, `http://${host}:${apiPort}`);
    console.log(`[sse] ${req.method ?? 'GET'} ${url.pathname}${url.search}`);

    if (url.pathname === '/api/logs/stream' || url.pathname === '/logs/stream') {
      res.writeHead(200, {
        'content-type': 'text/event-stream',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write(`data: ${JSON.stringify({ message: 'mock heartbeat', generatedAt: new Date().toISOString() })}\n\n`);
      const heartbeat = setInterval(() => {
        res.write(': keep-alive\n\n');
      }, 15000);
      req.on('close', () => {
        clearInterval(heartbeat);
      });
      return;
    }

    res.writeHead(404).end();
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(apiPort, host, () => {
      server.off('error', reject);
      resolve(server);
    });
  });
}

async function waitForServer(url, { attempts = 30, delayMs = 500 } = {}) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(2000) });
      if (response.ok) {
        return;
      }
    } catch (error) {
      if (attempt === attempts) throw error;
    }
    await wait(delayMs);
  }
  throw new Error(`Server at ${url} did not become ready`);
}

async function assertHtmlResponse(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (response.status !== 200) {
    throw new Error(`Expected 200 from ${url}, received ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('text/html')) {
    throw new Error(`Expected text/html content-type at ${url}, received ${contentType ?? 'null'}`);
  }
  await response.text();
}

async function assertJsonResponse(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (response.status !== 200) {
    throw new Error(`Expected 200 from ${url}, received ${response.status}`);
  }
  const contentType = response.headers.get('content-type');
  if (!contentType || !contentType.includes('application/json')) {
    throw new Error(`Expected application/json content-type at ${url}, received ${contentType ?? 'null'}`);
  }
  await response.json();
}

async function assertSseResponse(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(url, {
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    });
    if (response.status !== 200) {
      throw new Error(`Expected 200 from ${url}, received ${response.status}`);
    }
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/event-stream')) {
      throw new Error(`Expected text/event-stream content-type at ${url}, received ${contentType ?? 'null'}`);
    }
    await response.body?.cancel();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`Timed out waiting for ${url}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }
}

async function run() {
  console.log('Starting mock SSE server...');
  const sseServer = await startSseServer();

  console.log('Starting UI dev server...');
  const uiProcess = startUiProcess();

  const stopUi = async () =>
    new Promise((resolve) => {
      if (uiProcess.exitCode != null || uiProcess.signalCode != null) {
        resolve();
        return;
      }

      let forceKill;
      const onExit = () => {
        if (forceKill) {
          clearTimeout(forceKill);
        }
        resolve();
      };

      forceKill = setTimeout(() => {
        if (uiProcess.exitCode == null && uiProcess.signalCode == null) {
          uiProcess.kill('SIGKILL');
        }
      }, 5000);

      uiProcess.once('exit', onExit);
      uiProcess.kill('SIGTERM');
    });

  const stopSse = async () =>
    new Promise((resolve, reject) => {
      if (!sseServer.listening) {
        resolve();
        return;
      }
      sseServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });

  const cleanup = async () => {
    await stopUi().catch((error) => {
      console.error('Failed to stop UI process:', error);
    });
    await stopSse().catch((error) => {
      console.error('Failed to stop SSE server:', error);
    });
  };

  process.on('SIGINT', () => {
    cleanup().finally(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    cleanup().finally(() => process.exit(1));
  });

  try {
    await waitForServer(smokeConfig.uiBaseUrl);

    console.log('Verifying root HTML response...');
    await assertHtmlResponse(smokeConfig.uiBaseUrl);
    console.log('✔ GET / returned text/html');

    console.log('Verifying fleet overview JSON response...');
    await assertJsonResponse(`${smokeConfig.uiBaseUrl}/ui/fleet/overview`);
    console.log('✔ GET /ui/fleet/overview returned JSON');

    console.log('Verifying logs stream SSE response...');
    await assertSseResponse(`${smokeConfig.uiBaseUrl}/ui/logs/stream`);
    console.log('✔ GET /ui/logs/stream returned text/event-stream');
    console.log('Smoke proxy checks completed successfully.');
  } finally {
    await cleanup();
  }
}

run().catch((error) => {
  console.error('Smoke proxy checks failed:', error);
  process.exit(1);
});
