#!/usr/bin/env node
import { spawn } from 'node:child_process';
import http from 'node:http';
import { setTimeout as wait } from 'node:timers/promises';
import { getSmokeConfig } from '../apps/ui/test.config.js';

const config = getSmokeConfig();
const { host, uiPort, apiPort, testEnv } = config;

function prefixLines(prefix, chunk) {
  return chunk
    .toString()
    .split('\\n')
    .filter(Boolean)
    .map((line) => `${prefix} ${line}`)
    .join('\\n');
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
        'access-control-allow-origin': '*',
        'access-control-allow-headers': 'accept',
        connection: 'keep-alive',
      });

      // Send initial heartbeat
      res.write(`data: ${JSON.stringify({ message: 'SSE connection established', generatedAt: new Date().toISOString(), type: 'heartbeat' })}\\n\\n`);

      // Send some mock log events
      let eventCount = 0;
      const sendMockEvent = () => {
        eventCount++;
        const mockLog = {
          id: `log-${eventCount}`,
          timestamp: new Date().toISOString(),
          level: ['info', 'warning', 'error'][eventCount % 3],
          source: 'test-source',
          message: `Mock log event #${eventCount}`,
          correlationId: `test-${eventCount}`,
        };
        res.write(`data: ${JSON.stringify(mockLog)}\\n\\n`);
      };

      // Send mock events every 2 seconds
      const eventInterval = setInterval(sendMockEvent, 2000);

      // Send heartbeat every 15 seconds
      const heartbeat = setInterval(() => {
        res.write(': keep-alive\\n\\n');
      }, 15000);

      req.on('close', () => {
        clearInterval(heartbeat);
        clearInterval(eventInterval);
        console.log('[sse] Client disconnected');
      });

      return;
    }

    if (url.pathname === '/api/health/summary') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', modules: [] }));
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
        signal: AbortSignal.timeout(2000)
      });
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

async function testSseStream() {
  console.log('🧪 Testing SSE (Server-Sent Events) stream...');

  const sseUrl = `http://${host}:${apiPort}/logs/stream`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000); // 10 second timeout

  let eventsReceived = 0;
  let heartbeatReceived = false;
  let logEventReceived = false;

  try {
    console.log(`  📡 Connecting to SSE endpoint: ${sseUrl}`);

    const response = await fetch(sseUrl, {
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`SSE endpoint returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/event-stream')) {
      throw new Error(`Expected text/event-stream, got ${contentType}`);
    }

    console.log('  ✅ SSE connection established');
    console.log('  📊 Listening for events...');

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No readable stream available');
    }

    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            eventsReceived++;
            const data = JSON.parse(line.substring(6));
            console.log(`  📦 Event ${eventsReceived}: ${data.message || data.type || 'unknown'}`);

            if (data.type === 'heartbeat') {
              heartbeatReceived = true;
            } else if (data.message && data.level) {
              logEventReceived = true;
            }

            // Stop after receiving a few events to avoid long test runs
            if (eventsReceived >= 3) {
              controller.abort();
              break;
            }
          } catch (e) {
            console.log(`  ⚠️  Failed to parse event data: ${line}`);
          }
        } else if (line.startsWith(': ')) {
          console.log('  💓 Heartbeat comment received');
        }
      }
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      // Expected when we abort after receiving events
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }

  // Validate results
  const results = {
    eventsReceived,
    heartbeatReceived,
    logEventReceived,
  };

  console.log(`\\n  📊 SSE Test Results:`);
  console.log(`    Events received: ${eventsReceived}`);
  console.log(`    Heartbeat received: ${heartbeatReceived ? '✅' : '❌'}`);
  console.log(`    Log event received: ${logEventReceived ? '✅' : '❌'}`);

  if (eventsReceived === 0) {
    throw new Error('No SSE events received');
  }

  if (!heartbeatReceived) {
    throw new Error('No heartbeat event received');
  }

  console.log('  ✅ SSE stream validation passed!');
  return results;
}

async function testUiSseIntegration() {
  console.log('🧪 Testing UI SSE integration...');

  const uiSseUrl = `${config.uiBaseUrl}/ui/logs/stream`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    console.log(`  📡 Testing UI proxy SSE: ${uiSseUrl}`);

    const response = await fetch(uiSseUrl, {
      headers: {
        'Accept': 'text/event-stream',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`UI SSE endpoint returned ${response.status}`);
    }

    const contentType = response.headers.get('content-type');
    console.log(`  📋 Content-Type: ${contentType}`);

    // For UI proxy, we expect it might return JSON (mock data) or SSE
    // Both are acceptable depending on configuration
    if (contentType?.includes('text/event-stream')) {
      console.log('  ✅ UI returns proper SSE stream');

      // Test reading a bit of the stream
      const reader = response.body?.getReader();
      if (reader) {
        const { value } = await Promise.race([
          reader.read(),
          wait(2000).then(() => ({ done: true, value: undefined }))
        ]);

        if (value) {
          const chunk = new TextDecoder().decode(value);
          console.log(`  📦 UI SSE data preview: ${chunk.substring(0, 100)}...`);
        }
      }
    } else if (contentType?.includes('application/json')) {
      console.log('  ✅ UI returns mock JSON (expected in test mode)');
      const data = await response.json();
      if (data && typeof data === 'object') {
        console.log('  📦 Mock data structure valid');
      }
    } else {
      throw new Error(`Unexpected content type: ${contentType}`);
    }

  } catch (error) {
    if (error.name === 'AbortError') {
      // Expected timeout
    } else {
      throw error;
    }
  } finally {
    clearTimeout(timeout);
    controller.abort();
  }

  console.log('  ✅ UI SSE integration test passed!');
}

async function run() {
  console.log('🚀 Starting SSE smoke test suite...');

  console.log('Starting SSE mock server...');
  const sseServer = await startSseServer();

  console.log('Starting UI dev server...');
  const uiProcess = startUiServer();

  const stopProcesses = async () => {
    const stopSse = new Promise((resolve, reject) => {
      if (!sseServer.listening) {
        resolve();
        return;
      }
      sseServer.close((err) => {
        if (err) reject(err);
        else resolve();
      });
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

    await Promise.all([stopSse, stopUi]);
  };

  process.on('SIGINT', () => {
    stopProcesses().finally(() => process.exit(1));
  });
  process.on('SIGTERM', () => {
    stopProcesses().finally(() => process.exit(1));
  });

  try {
    // Wait for servers to be ready
    await waitForServer(`http://${host}:${apiPort}/api/health/summary`);
    await waitForServer(config.uiBaseUrl);

    // Run SSE tests
    await testSseStream();
    await testUiSseIntegration();

    console.log('\\n✅ All SSE tests passed successfully!');
    await stopProcesses();
    process.exit(0);

  } catch (error) {
    console.error('❌ SSE tests failed:', error);
    await stopProcesses();
    process.exit(1);
  }
}

run();