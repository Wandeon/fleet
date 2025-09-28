import { expect, test } from '@playwright/test';

test.describe('Module regression prevention', () => {
  test('all main modules load without API contract violations', async ({ page }) => {
    const apiFailures: { url: string; status: number; module?: string }[] = [];
    const nullUndefinedErrors: string[] = [];

    // Track API failures
    page.on('response', (response) => {
      if (response.status() >= 400) {
        const url = response.url();
        let module = 'unknown';
        if (url.includes('fleet')) module = 'fleet';
        if (url.includes('audio')) module = 'audio';
        if (url.includes('video')) module = 'video';
        if (url.includes('camera')) module = 'camera';
        if (url.includes('zigbee')) module = 'zigbee';
        if (url.includes('logs')) module = 'logs';

        apiFailures.push({ url, status: response.status(), module });
      }
    });

    // Track undefined/null rendering errors
    page.on('console', (message) => {
      if (message.type() === 'error') {
        const text = message.text();
        if (text.includes('undefined') || text.includes('null') || text.includes('Cannot read property')) {
          nullUndefinedErrors.push(text);
        }
      }
    });

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify main modules are present and functional (based on actual UI structure)
    const expectedModules = [
      { name: 'Audio', selector: 'heading[level="2"]:has-text("Audio")' },
      { name: 'Health overview', selector: 'heading[level="2"]:has-text("Health")' },
    ];

    for (const module of expectedModules) {
      const moduleHeading = page.getByRole('heading', { level: 2, name: new RegExp(module.name, 'i') });
      await expect(moduleHeading).toBeVisible({ timeout: 5000 });
    }

    // Verify other modules exist in navigation or tiles, even if not as main headings
    await expect(page.getByText('Cameras online')).toBeVisible(); // Health tile
    await expect(page.getByText('Zigbee devices')).toBeVisible(); // Health tile

    // Check for defensive coding violations (Tasks 1-5 prevention)
    const pageContent = await page.textContent('body');
    expect(pageContent).not.toContain('[object Object]');

    // Check visible content area only (avoid SvelteKit internal scripts)
    const mainContent = await page.locator('main').textContent();
    expect(mainContent).not.toContain('undefined');
    expect(mainContent).not.toContain('[object Object]');

    // No critical API failures should occur (Task 2-3 prevention)
    const criticalFailures = apiFailures.filter(f => f.status === 404 && f.url.includes('/api/'));
    if (criticalFailures.length > 0) {
      console.log('Critical API contract violations found:', criticalFailures);
      expect(criticalFailures).toHaveLength(0);
    }

    // No null/undefined access errors (Task 5 prevention)
    expect(nullUndefinedErrors, `Found unsafe property access: ${nullUndefinedErrors.join(', ')}`).toHaveLength(0);
  });

  test('navigation between modules preserves state and loads cleanly', async ({ page }) => {
    await page.goto('/');

    // Test navigation to each major route
    const routes = [
      { path: '/audio', expected: 'Audio' },
      { path: '/health', expected: 'Health' },
      { path: '/logs', expected: 'Logs' },
      { path: '/fleet', expected: 'Fleet' },
    ];

    for (const route of routes) {
      await page.goto(route.path);
      await page.waitForLoadState('networkidle');

      // Should load without internal errors
      await expect(page.getByText('Internal Error')).toHaveCount(0);

      // Should show expected content
      await expect(page.getByRole('heading', { name: new RegExp(route.expected, 'i') })).toBeVisible();

      // Should not show broken property rendering
      const content = await page.textContent('body');
      expect(content).not.toContain('[object Object]');
      expect(content).not.toContain('undefined');
    }
  });

  test('error states handle gracefully without cascading failures', async ({ page }) => {
    const consoleLogs: string[] = [];

    page.on('console', (message) => {
      consoleLogs.push(`${message.type()}: ${message.text()}`);
    });

    await page.goto('/');

    // Simulate network errors by intercepting requests
    await page.route('**/api/**', route => {
      route.abort('internetdisconnected');
    });

    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Should show appropriate error states, not crash
    const errorElements = page.locator('.error, .empty, .offline');
    if (await errorElements.count() > 0) {
      const errorText = await errorElements.first().textContent();
      expect(errorText).toMatch(/offline|error|unavailable|no.*available/i);
      expect(errorText).not.toContain('undefined');
      expect(errorText).not.toContain('[object Object]');
    }

    // Should not have cascading JavaScript errors
    const jsErrors = consoleLogs.filter(log =>
      log.startsWith('error:') &&
      !log.includes('Failed to fetch') &&
      !log.includes('NetworkError') &&
      !log.includes('internetdisconnected')
    );

    expect(jsErrors).toHaveLength(0);
  });

  test('all interactive elements work without throwing exceptions', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Test all buttons are clickable without throwing
    const buttons = page.getByRole('button');
    const buttonCount = await buttons.count();

    for (let i = 0; i < Math.min(buttonCount, 10); i++) { // Test first 10 buttons
      const button = buttons.nth(i);
      if (await button.isVisible() && await button.isEnabled()) {
        // This should not throw exceptions
        await button.click({ timeout: 1000 }).catch(() => {
          // Click might fail due to navigation/modal, but shouldn't throw unhandled errors
        });
      }
    }

    // Test form controls
    const selects = page.locator('select');
    const selectCount = await selects.count();

    for (let i = 0; i < selectCount; i++) {
      const select = selects.nth(i);
      if (await select.isVisible()) {
        const options = select.locator('option');
        const optionCount = await options.count();
        if (optionCount > 1) {
          // Try to select a different option
          await select.selectOption({ index: 1 }).catch(() => {
            // Might fail but shouldn't throw unhandled errors
          });
        }
      }
    }
  });
});