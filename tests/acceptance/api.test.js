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
});
