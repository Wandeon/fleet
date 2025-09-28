import { test, expect } from '@playwright/test';

const apiBase = (process.env.API_BASE_URL || 'http://localhost:3000/api').replace(/\/$/, '');
const apiToken = process.env.API_BEARER || process.env.ACCEPTANCE_API_TOKEN || '';
const apiHeaders = apiToken ? { Authorization: `Bearer ${apiToken}` } : {};

async function requestJson(request, url) {
  const response = await request.get(url, { headers: apiHeaders });
  expect(response.ok(), `Expected 2xx for ${url} but received ${response.status()}`).toBeTruthy();
  const contentType = response.headers()['content-type'] || '';
  if (!contentType.includes('application/json')) {
    throw new Error(`Expected JSON response from ${url}, received Content-Type: ${contentType}`);
  }
  return response.json();
}

test.describe('Fleet API acceptance', () => {
  test('healthz endpoint responds', async ({ request }) => {
    const url = `${apiBase}/healthz`;
    const response = await request.get(url, { headers: apiHeaders });
    expect(response.ok(), `Expected 2xx for ${url} but received ${response.status()}`).toBeTruthy();
    const body = await response.text();
    expect(body.trim().length, 'Healthz response should not be empty').toBeGreaterThan(0);
  });

  test('fleet state endpoint returns JSON payload', async ({ request }) => {
    const json = await requestJson(request, `${apiBase}/fleet/state`);
    expect(json).toBeTruthy();
    expect(json).toHaveProperty('devices');
  });

  test('fleet layout endpoint returns JSON payload', async ({ request }) => {
    const json = await requestJson(request, `${apiBase}/fleet/layout`);
    expect(json).toBeTruthy();
    expect(json).toHaveProperty('layout');
  });

  test('video device power command enqueues job', async ({ request }) => {
    const url = `${apiBase}/video/devices/pi-video-01/power`;
    const response = await request.post(url, {
      headers: { ...apiHeaders, 'content-type': 'application/json' },
      data: { power: 'standby' },
    });
    expect(response.status(), `Expected 202 for ${url} but received ${response.status()}`).toBe(202);
    const body = await response.json();
    expect(body).toMatchObject({ deviceId: 'pi-video-01', power: 'standby', accepted: true });
    expect(typeof body.jobId).toBe('string');
    expect(body.jobId.length).toBeGreaterThan(0);
  });

  test('zigbee pairing window opens and closes', async ({ request }) => {
    const startUrl = `${apiBase}/zigbee/pairing`;
    const startResponse = await request.post(startUrl, {
      headers: { ...apiHeaders, 'content-type': 'application/json' },
      data: { durationSeconds: 45 },
    });
    expect(startResponse.ok(), `Pairing start failed with ${startResponse.status()}`).toBeTruthy();
    const startBody = await startResponse.json();
    expect(startBody).toMatchObject({ active: true });
    expect(startBody.discovered).toBeInstanceOf(Array);

    const stopUrl = `${apiBase}/zigbee/pairing`;
    const stopResponse = await request.delete(stopUrl, { headers: apiHeaders });
    expect(stopResponse.ok(), `Pairing stop failed with ${stopResponse.status()}`).toBeTruthy();
    const stopBody = await stopResponse.json();
    expect(stopBody).toMatchObject({ active: false });
  });

  test('camera summary reports offline readiness while hardware is absent', async ({ request }) => {
    const json = await requestJson(request, `${apiBase}/camera/summary`);
    expect(json).toBeTruthy();
    expect(json).toHaveProperty('status', 'offline');
    expect(Array.isArray(json.devices)).toBe(true);
  });

  test('camera events endpoint responds with offline placeholders', async ({ request }) => {
    const json = await requestJson(request, `${apiBase}/camera/events`);
    expect(json).toBeTruthy();
    expect(json).toHaveProperty('status', 'offline');
    expect(Array.isArray(json.events)).toBe(true);
    expect(json.pagination).toBeTruthy();
  });
});
