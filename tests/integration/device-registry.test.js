const { test, expect } = require('@playwright/test');

test.describe('Device Registry Integration', () => {
  test('fleet API loads all devices from devices.json', async ({ request }) => {
    // Test fleet layout includes video devices
    const layoutResponse = await request.get('/api/fleet/layout');
    expect(layoutResponse.ok()).toBeTruthy();

    const layout = await layoutResponse.json();

    // Should include video module
    const videoModule = layout.modules.find(m => m.module === 'video');
    expect(videoModule).toBeDefined();
    expect(videoModule.devices).toContainEqual(
      expect.objectContaining({
        id: 'pi-video-01',
        name: 'HDMI Pi 01',
        role: 'video'
      })
    );
  });

  test('video devices API returns configured devices', async ({ request }) => {
    const response = await request.get('/api/video/devices', {
      headers: {
        'Authorization': 'Bearer 3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc'
      }
    });

    expect(response.ok()).toBeTruthy();
    const devices = await response.json();

    expect(devices).toContainEqual(
      expect.objectContaining({
        id: 'pi-video-01',
        name: 'HDMI Pi 01',
        capabilities: expect.arrayContaining(['hdmi-cec', 'display-control'])
      })
    );
  });

  test('API should not fall back to hardcoded DEVICE_REGISTRY_JSON', async ({ request }) => {
    // Verify that more than just audio devices are loaded
    const overviewResponse = await request.get('/api/fleet/overview');
    expect(overviewResponse.ok()).toBeTruthy();

    const overview = await overviewResponse.json();

    // Should have multiple device types, not just audio
    expect(overview.modules.length).toBeGreaterThan(1);
    expect(overview.devices.length).toBeGreaterThan(1);
  });
});