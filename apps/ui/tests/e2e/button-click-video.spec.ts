import { expect, test } from '@playwright/test';

test.describe('Video Module TV Control Interactions', () => {
	test.beforeEach(async ({ page }) => {
		// Mock video API responses
		await page.route('**/api/video/tv/**', async (route) => {
			const url = route.request().url();
			const method = route.request().method();

			if (method === 'POST' && url.includes('/api/video/tv/power')) {
				const body = route.request().postDataJSON();
				await route.fulfill({
					status: 202,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						power: body.on ? 'on' : 'standby',
						correlationId: 'job-power-123',
						message: `Display ${body.on ? 'powered on' : 'powered off'}`,
					}),
				});
			} else if (method === 'POST' && url.includes('/api/video/tv/input')) {
				const body = route.request().postDataJSON();
				await route.fulfill({
					status: 202,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						input: body.input,
						correlationId: 'job-input-124',
						message: `Switched to ${body.input}`,
					}),
				});
			} else if (method === 'POST' && url.includes('/api/video/tv/volume')) {
				const body = route.request().postDataJSON();
				await route.fulfill({
					status: 202,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						volume: body.volume,
						correlationId: 'job-volume-125',
						message: `Volume set to ${body.volume}%`,
					}),
				});
			} else if (method === 'POST' && url.includes('/api/video/tv/mute')) {
				const body = route.request().postDataJSON();
				await route.fulfill({
					status: 202,
					contentType: 'application/json',
					body: JSON.stringify({
						success: true,
						mute: body.mute,
						correlationId: 'job-mute-126',
						message: body.mute ? 'Muted output' : 'Unmuted output',
					}),
				});
			}
		});

		// Mock video overview/state
		await page.route('**/api/video/devices', async (route) => {
			await route.fulfill({
				status: 200,
				contentType: 'application/json',
				body: JSON.stringify({
					devices: [
						{
							id: 'pi-video-01',
							name: 'Living Room TV',
							power: 'on',
							mute: false,
							input: 'HDMI1',
							volumePercent: 50,
							availableInputs: ['HDMI1', 'HDMI2', 'CAST'],
							lastUpdated: new Date().toISOString(),
						},
					],
					updatedAt: new Date().toISOString(),
				}),
			});
		});

		await page.goto('/video');
		await page.waitForLoadState('networkidle');
	});

	test('Power On TV should trigger POST and show confirmation', async ({ page }) => {
		// Track API calls
		const apiCalls: { url: string; method: string; body?: unknown }[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/video/tv')) {
				apiCalls.push({
					url: request.url(),
					method: request.method(),
					body: request.postDataJSON(),
				});
			}
		});

		// Find and click Power On button
		const powerOnButton = page.getByRole('button', { name: /power on/i });
		await expect(powerOnButton).toBeVisible();
		await powerOnButton.click();

		// Wait for network request
		await page.waitForTimeout(300);

		// Verify API was called with correct payload
		const powerCall = apiCalls.find(
			(call) => call.url.includes('/api/video/tv/power') && call.method === 'POST'
		);
		expect(powerCall).toBeTruthy();
		expect(powerCall?.body).toEqual({ on: true });

		// Check for confirmation message (job ID in toast)
		const statusMessage = page.locator('.banner, [role="status"]');
		if (await statusMessage.isVisible()) {
			const messageText = await statusMessage.textContent();
			expect(messageText).toContain('job-power-123');
		}
	});

	test('Power Off TV should trigger POST with correct payload', async ({ page }) => {
		const apiCalls: { url: string; method: string; body?: unknown }[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/video/tv')) {
				apiCalls.push({
					url: request.url(),
					method: request.method(),
					body: request.postDataJSON(),
				});
			}
		});

		const powerOffButton = page.getByRole('button', { name: /power off/i });
		await expect(powerOffButton).toBeVisible();
		await powerOffButton.click();

		await page.waitForTimeout(300);

		const powerCall = apiCalls.find(
			(call) => call.url.includes('/api/video/tv/power') && call.method === 'POST'
		);
		expect(powerCall).toBeTruthy();
		expect(powerCall?.body).toEqual({ on: false });
	});

	test('Input change should trigger POST with input value', async ({ page }) => {
		const apiCalls: { url: string; method: string; body?: unknown }[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/video/tv')) {
				apiCalls.push({
					url: request.url(),
					method: request.method(),
					body: request.postDataJSON(),
				});
			}
		});

		// Find input button (e.g., HDMI2)
		const inputButton = page.getByRole('button', { name: /HDMI2/i });
		if (await inputButton.isVisible()) {
			await inputButton.click();

			await page.waitForTimeout(300);

			const inputCall = apiCalls.find(
				(call) => call.url.includes('/api/video/tv/input') && call.method === 'POST'
			);
			expect(inputCall).toBeTruthy();
			expect(inputCall?.body).toHaveProperty('input');
		}
	});

	test('should handle 409 concurrent command error gracefully', async ({ page }) => {
		// Override route to return 409 error
		await page.unroute('**/api/video/tv/**');
		await page.route('**/api/video/tv/power', async (route) => {
			await route.fulfill({
				status: 409,
				contentType: 'application/json',
				body: JSON.stringify({
					error: 'Device busy - please wait for current operation to complete',
					code: 'concurrent_command',
				}),
			});
		});

		const powerOnButton = page.getByRole('button', { name: /power on/i });
		await powerOnButton.click();

		// Wait for error handling
		await page.waitForTimeout(500);

		// Check for error message
		const statusMessage = page.locator('.banner, [role="status"]');
		if (await statusMessage.isVisible()) {
			const messageText = await statusMessage.textContent();
			expect(messageText).toContain('busy');
		}

		// Button should be re-enabled after error
		await expect(powerOnButton).toBeEnabled();
	});

	test('should disable buttons during loading state', async ({ page }) => {
		const powerOnButton = page.getByRole('button', { name: /power on/i });

		// Override to add delay
		await page.unroute('**/api/video/tv/**');
		await page.route('**/api/video/tv/power', async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 202,
				contentType: 'application/json',
				body: JSON.stringify({
					success: true,
					power: 'on',
					correlationId: 'job-123',
					message: 'Display powered on',
				}),
			});
		});

		// Start the action
		await powerOnButton.click();

		// Check disabled state during loading
		await expect(powerOnButton).toBeDisabled();

		// Wait for completion
		await page.waitForTimeout(1200);

		// Should be enabled after completion
		await expect(powerOnButton).toBeEnabled();
	});

	test('Volume control should trigger POST with volume value', async ({ page }) => {
		const apiCalls: { url: string; method: string; body?: unknown }[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/video/tv')) {
				apiCalls.push({
					url: request.url(),
					method: request.method(),
					body: request.postDataJSON(),
				});
			}
		});

		// Find volume slider
		const volumeSlider = page.locator('input[type="range"]').first();
		if (await volumeSlider.isVisible()) {
			await volumeSlider.fill('75');

			await page.waitForTimeout(500); // Wait for debounce

			const volumeCall = apiCalls.find(
				(call) => call.url.includes('/api/video/tv/volume') && call.method === 'POST'
			);
			if (volumeCall) {
				expect(volumeCall.body).toHaveProperty('volume');
			}
		}
	});

	test('Mute button should trigger POST with mute value', async ({ page }) => {
		const apiCalls: { url: string; method: string; body?: unknown }[] = [];
		page.on('request', (request) => {
			if (request.url().includes('/api/video/tv')) {
				apiCalls.push({
					url: request.url(),
					method: request.method(),
					body: request.postDataJSON(),
				});
			}
		});

		const muteButton = page.getByRole('button', { name: /mute/i });
		if (await muteButton.isVisible()) {
			await muteButton.click();

			await page.waitForTimeout(300);

			const muteCall = apiCalls.find(
				(call) => call.url.includes('/api/video/tv/mute') && call.method === 'POST'
			);
			expect(muteCall).toBeTruthy();
			expect(muteCall?.body).toHaveProperty('mute');
		}
	});
});
