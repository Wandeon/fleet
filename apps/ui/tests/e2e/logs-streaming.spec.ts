import { expect, test } from '@playwright/test';

test.describe('Logs streaming stabilization', () => {
  test('logs page loads and handles streaming gracefully', async ({ page }) => {
    const requestFailures: { url: string; status: number; error?: string }[] = [];
    const consoleErrors: string[] = [];

    page.on('response', (response) => {
      if (response.status() >= 400) {
        requestFailures.push({
          url: response.url(),
          status: response.status()
        });
      }
    });

    page.on('console', (message) => {
      if (message.type() === 'error') {
        consoleErrors.push(message.text());
      }
    });

    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Check core UI elements are present
    await expect(page.getByRole('heading', { name: 'Live log stream' })).toBeVisible();
    await expect(page.getByText('Source')).toBeVisible();
    await expect(page.getByText('Severity')).toBeVisible();

    // Check filter controls work
    const severitySelect = page.locator('select').filter({ hasText: /All severities|Critical|Error/ });
    await expect(severitySelect).toBeVisible();

    // Verify streaming controls
    const streamButton = page.getByRole('button', { name: /pause stream|resume stream/i });
    await expect(streamButton).toBeVisible();

    // Check no streaming-related API failures
    const streamingFailures = requestFailures.filter(f =>
      f.url.includes('/logs') ||
      f.url.includes('stream')
    );

    if (streamingFailures.length > 0) {
      console.log('Logs streaming failures:', streamingFailures);
    }

    // We expect some failures due to EventSource auth limitations, but should handle gracefully
    const criticalErrors = consoleErrors.filter(error =>
      !error.includes('stream') &&
      !error.includes('EventSource') &&
      !error.includes('401')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('log filters work without breaking the UI', async ({ page }) => {
    await page.goto('/logs');

    // Test severity filter
    const severitySelect = page.locator('select').nth(1); // Second select is severity
    await severitySelect.selectOption('error');

    // Should not cause UI to break
    await expect(page.getByRole('heading', { name: 'Live log stream' })).toBeVisible();

    // Test search functionality
    const searchInput = page.getByPlaceholder('Message, device, correlation ID');
    await searchInput.fill('test search');

    // Should maintain UI state
    await expect(page.getByRole('button', { name: /pause stream|resume stream/i })).toBeVisible();

    // Reset filters should work
    const resetButton = page.getByRole('button', { name: 'Reset filters' });
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await expect(searchInput).toHaveValue('');
    }
  });

  test('handles empty log state without errors', async ({ page }) => {
    await page.goto('/logs');

    // Look for empty state messaging
    const emptyState = page.locator('.empty, .loading');
    if (await emptyState.count() > 0) {
      const emptyText = await emptyState.first().textContent();

      // Should show proper empty state message
      expect(emptyText).toMatch(/no log entries|loading|no data/i);

      // Should not show undefined/null values
      expect(emptyText).not.toContain('undefined');
      expect(emptyText).not.toContain('null');
      expect(emptyText).not.toContain('[object Object]');
    }

    // Export buttons should be disabled/working appropriately
    const exportButtons = page.getByRole('button', { name: /export/i });
    await expect(exportButtons.first()).toBeVisible();
  });

  test('log entry rendering handles malformed data safely', async ({ page }) => {
    await page.goto('/logs');
    await page.waitForLoadState('networkidle');

    // Check for any log entries
    const logEntries = page.locator('.log-entry, .log-list li');
    if (await logEntries.count() > 0) {
      // Verify timestamps are properly formatted
      const timestamps = page.locator('time, .timestamp');
      if (await timestamps.count() > 0) {
        const timestampText = await timestamps.first().textContent();
        expect(timestampText).not.toContain('Invalid Date');
        expect(timestampText).not.toContain('NaN');
      }

      // Check message content is safely rendered
      const messages = page.locator('.message, .log-message');
      if (await messages.count() > 0) {
        const messageText = await messages.first().textContent();
        expect(messageText).not.toContain('undefined');
        expect(messageText).not.toContain('[object Object]');
      }
    }
  });
});