<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import { onMount } from 'svelte';

  // Settings state
  let apiKey = '';
  let proxyTimeout = '5000';
  let enableDebugLogs = false;
  let restartRequired = false;
  let saveStatus = '';

  // Mock current settings - in real implementation, these would come from API
  onMount(() => {
    apiKey = 'sk-************************************';
    proxyTimeout = '5000';
    enableDebugLogs = false;
  });

  async function saveSettings() {
    try {
      saveStatus = 'saving';

      // Mock API call - in real implementation, this would save to env/compose
      await new Promise(resolve => setTimeout(resolve, 1000));

      saveStatus = 'saved';
      restartRequired = true;

      setTimeout(() => {
        saveStatus = '';
      }, 3000);
    } catch (error) {
      console.error('Failed to save settings', error);
      saveStatus = 'error';
      setTimeout(() => {
        saveStatus = '';
      }, 3000);
    }
  }

  function resetToDefaults() {
    if (confirm('Reset all settings to defaults? This will require a restart.')) {
      apiKey = '';
      proxyTimeout = '5000';
      enableDebugLogs = false;
      restartRequired = true;
    }
  }
</script>

<svelte:head>
  <title>Settings - Head Spa Control</title>
</svelte:head>

<div class="settings-page">
  <div class="header">
    <h1>Settings</h1>
    <p>Configure system behavior and API connections</p>
  </div>

  {#if restartRequired}
    <div class="alert warning">
      <span class="icon">⚠️</span>
      <div>
        <strong>Restart Required</strong>
        <p>Settings changes will take effect after the next system restart.</p>
      </div>
    </div>
  {/if}

  <div class="settings-grid">
    <Card title="API Configuration" subtitle="Configure external API connections">
      <form class="settings-form" on:submit|preventDefault={saveSettings}>
        <div class="field">
          <label for="api-key">API Bearer Token</label>
          <input
            id="api-key"
            type="password"
            bind:value={apiKey}
            placeholder="Enter API bearer token"
          />
          <small>Used for authentication with backend services</small>
        </div>

        <div class="field">
          <label for="proxy-timeout">Proxy Timeout (ms)</label>
          <input
            id="proxy-timeout"
            type="number"
            min="1000"
            max="30000"
            step="1000"
            bind:value={proxyTimeout}
          />
          <small>Request timeout for proxy operations</small>
        </div>

        <div class="field checkbox">
          <label>
            <input
              type="checkbox"
              bind:checked={enableDebugLogs}
            />
            Enable debug logging
          </label>
          <small>Include detailed debug information in application logs</small>
        </div>
      </form>
    </Card>

    <Card title="Device Management" subtitle="Configure device discovery and connectivity">
      <div class="settings-form">
        <div class="field">
          <label for="device-scan-interval">Device Scan Interval (seconds)</label>
          <input
            id="device-scan-interval"
            type="number"
            value="30"
            min="10"
            max="300"
            readonly
          />
          <small>How often to check device availability</small>
        </div>

        <div class="field">
          <label for="max-retries">Connection Max Retries</label>
          <input
            id="max-retries"
            type="number"
            value="3"
            min="1"
            max="10"
            readonly
          />
          <small>Maximum attempts before marking device as offline</small>
        </div>

        <div class="info">
          <span class="icon">ℹ️</span>
          <p>Device management settings are currently read-only. Changes require configuration file updates.</p>
        </div>
      </div>
    </Card>

    <Card title="System Information" subtitle="Current system status and versions">
      <div class="info-grid">
        <div class="info-item">
          <strong>Version</strong>
          <span>v1.0.0</span>
        </div>
        <div class="info-item">
          <strong>Build</strong>
          <span>61b50db</span>
        </div>
        <div class="info-item">
          <strong>Environment</strong>
          <span>Production</span>
        </div>
        <div class="info-item">
          <strong>Uptime</strong>
          <span>2d 14h 32m</span>
        </div>
      </div>
    </Card>
  </div>

  <div class="actions">
    <button
      type="button"
      class="btn secondary"
      on:click={resetToDefaults}
    >
      Reset to Defaults
    </button>

    <button
      type="button"
      class="btn primary"
      on:click={saveSettings}
      disabled={saveStatus === 'saving'}
    >
      {#if saveStatus === 'saving'}
        Saving...
      {:else if saveStatus === 'saved'}
        ✅ Saved
      {:else if saveStatus === 'error'}
        ❌ Error
      {:else}
        Save Settings
      {/if}
    </button>
  </div>
</div>

<style>
  .settings-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
    max-width: 64rem;
    margin: 0 auto;
  }

  .header h1 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-size-2xl);
  }

  .header p {
    margin: 0;
    color: var(--color-text-muted);
  }

  .alert {
    padding: var(--spacing-4);
    border-radius: var(--radius-md);
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-3);
  }

  .alert.warning {
    background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    color: rgb(245, 158, 11);
  }

  .alert .icon {
    font-size: var(--font-size-lg);
    flex-shrink: 0;
  }

  .alert strong {
    display: block;
    margin-bottom: var(--spacing-1);
  }

  .alert p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .settings-grid {
    display: grid;
    gap: var(--spacing-6);
    grid-template-columns: 1fr;
  }

  .settings-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .field {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .field.checkbox {
    flex-direction: row;
    align-items: flex-start;
    gap: var(--spacing-3);
  }

  .field.checkbox label {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    cursor: pointer;
  }

  .field label {
    font-weight: 500;
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .field input[type="password"],
  .field input[type="number"] {
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }

  .field input:focus {
    outline: none;
    border-color: var(--color-brand);
  }

  .field input:read-only {
    background: rgba(148, 163, 184, 0.1);
    cursor: not-allowed;
  }

  .field input[type="checkbox"] {
    width: 1rem;
    height: 1rem;
  }

  .field small {
    color: var(--color-text-muted);
    font-size: var(--font-size-xs);
  }

  .info {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    display: flex;
    align-items: flex-start;
    gap: var(--spacing-2);
  }

  .info .icon {
    color: rgb(59, 130, 246);
    flex-shrink: 0;
  }

  .info p {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .info-grid {
    display: grid;
    gap: var(--spacing-3);
    grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
  }

  .info-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .info-item strong {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .info-item span {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding-top: var(--spacing-4);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .btn {
    padding: var(--spacing-3) var(--spacing-6);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    border: 1px solid transparent;
  }

  .btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn.primary {
    background: var(--color-brand);
    color: white;
  }

  .btn.primary:hover:not(:disabled) {
    background: rgb(37, 99, 235);
  }

  .btn.secondary {
    background: rgba(148, 163, 184, 0.1);
    color: var(--color-text);
    border-color: rgba(148, 163, 184, 0.3);
  }

  .btn.secondary:hover {
    background: rgba(148, 163, 184, 0.2);
  }

  @media (min-width: 48rem) {
    .settings-grid {
      grid-template-columns: 2fr 1fr;
    }
  }
</style>