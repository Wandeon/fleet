<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { apiClient } from '$lib/api/client';
  import type { FleetStateDevice } from '$lib/types';

  export let expanded = true;

  let devices: FleetStateDevice[] = [];
  let loading = true;
  let error: string | null = null;
  let refreshInterval: ReturnType<typeof setInterval>;

  onMount(async () => {
    await fetchDevices();
    // Auto-refresh every 10 seconds
    refreshInterval = setInterval(fetchDevices, 10000);
  });

  onDestroy(() => {
    if (refreshInterval) {
      clearInterval(refreshInterval);
    }
  });

  async function fetchDevices() {
    try {
      const response = await apiClient.fetchState();
      devices = response.audio?.devices || [];
      error = null;
    } catch (err) {
      console.error('Failed to fetch fleet state:', err);
      error = 'Failed to load devices';
    } finally {
      loading = false;
    }
  }

  async function controlDevice(device: FleetStateDevice, action: string) {
    if (!device.online) return;

    try {
      // Different endpoints based on device role
      let endpoint = '';
      if (device.role === 'audio-player') {
        endpoint = `/ui/audio/devices/${device.id}/${action}`;
      } else if (device.role === 'hdmi-media') {
        endpoint = `/ui/video/devices/${device.id}/${action}`;
      } else if (device.role === 'camera-node') {
        endpoint = `/ui/camera/devices/${device.id}/${action}`;
      } else {
        // Generic fleet endpoint
        endpoint = `/ui/fleet/devices/${device.id}/${action}`;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Failed to ${action} ${device.name || device.id}`);
      }

      // Refresh device state after action
      await fetchDevices();
    } catch (err) {
      console.error(`Failed to ${action} device ${device.id}:`, err);
      error = err instanceof Error ? err.message : `Failed to ${action} device`;
      setTimeout(() => error = null, 5000);
    }
  }

  function getDeviceIcon(role: string): string {
    switch(role) {
      case 'audio-player': return '🔊';
      case 'hdmi-media': return '📺';
      case 'camera-node': return '📹';
      case 'zigbee-coordinator': return '📡';
      default: return '📟';
    }
  }

  function formatStatus(online: boolean): string {
    return online ? 'Online' : 'Offline';
  }
</script>

<div class="fleet-panel" class:expanded>
  <div class="panel-header">
    <h2>Fleet Overview</h2>
    <button class="refresh-btn" on:click={fetchDevices} disabled={loading} title="Refresh devices">
      {loading ? '⟳' : '↻'} Refresh
    </button>
  </div>

  {#if error}
    <div class="error-message" role="alert">{error}</div>
  {/if}

  {#if loading && devices.length === 0}
    <div class="loading">
      <p>Loading devices...</p>
    </div>
  {:else if devices.length > 0}
    <div class="device-grid">
      {#each devices as device (device.id)}
        <div class="device-card" class:online={device.online} class:offline={!device.online}>
          <div class="device-header">
            <span class="device-icon">{getDeviceIcon(device.role || 'unknown')}</span>
            <div class="device-title">
              <h3>{device.name || device.id}</h3>
              <span class="device-role">{device.role || 'unknown'}</span>
            </div>
          </div>

          <div class="device-status">
            <span class="status-pill {device.online ? 'online' : 'offline'}">
              {formatStatus(device.online)}
            </span>
            {#if device.module}
              <span class="module-badge">{device.module}</span>
            {/if}
          </div>

          {#if device.reason}
            <div class="device-reason">
              <small>Status: {device.reason}</small>
            </div>
          {/if}

          {#if device.online}
            <div class="device-controls">
              {#if device.role === 'audio-player'}
                <button class="control-btn play" on:click={() => controlDevice(device, 'play')} title="Play">
                  ▶️
                </button>
                <button class="control-btn pause" on:click={() => controlDevice(device, 'pause')} title="Pause">
                  ⏸️
                </button>
                <button class="control-btn stop" on:click={() => controlDevice(device, 'stop')} title="Stop">
                  ⏹️
                </button>
              {:else if device.role === 'hdmi-media'}
                <button class="control-btn power" on:click={() => controlDevice(device, 'power')} title="Toggle Power">
                  ⚡
                </button>
                <button class="control-btn input" on:click={() => controlDevice(device, 'input')} title="Switch Input">
                  📺
                </button>
              {:else if device.role === 'camera-node'}
                <button class="control-btn snapshot" on:click={() => controlDevice(device, 'snapshot')} title="Take Snapshot">
                  📷
                </button>
                <button class="control-btn refresh" on:click={() => controlDevice(device, 'refresh')} title="Refresh Feed">
                  🔄
                </button>
              {/if}
            </div>
          {:else}
            <div class="offline-notice">
              <small>Device offline - controls disabled</small>
            </div>
          {/if}
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <p>No devices found</p>
      <small>Check device inventory and connectivity</small>
    </div>
  {/if}
</div>

<style>
  .fleet-panel {
    padding: var(--spacing-4);
    height: 100%;
    overflow-y: auto;
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
  }

  h2 {
    margin: 0;
    color: var(--color-text);
    font-size: 1.5rem;
    font-weight: 600;
  }

  .refresh-btn {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: var(--spacing-1);
  }

  .refresh-btn:hover:not(:disabled) {
    background: var(--color-primary-dark);
    transform: translateY(-1px);
  }

  .refresh-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .error-message {
    color: var(--color-error);
    padding: var(--spacing-3);
    background: var(--color-error-light);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-3);
    font-size: 0.875rem;
  }

  .loading, .empty-state {
    text-align: center;
    padding: var(--spacing-8);
    color: var(--color-text-muted);
  }

  .device-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--spacing-4);
  }

  .device-card {
    padding: var(--spacing-4);
    background: var(--color-surface);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-lg);
    transition: all 0.2s ease;
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .device-card.online {
    border-color: var(--color-success);
    background: rgba(34, 197, 94, 0.05);
  }

  .device-card.offline {
    border-color: var(--color-error);
    background: rgba(239, 68, 68, 0.05);
    opacity: 0.8;
  }

  .device-header {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .device-icon {
    font-size: 2rem;
    opacity: 0.8;
  }

  .device-title h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .device-role {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .device-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .status-pill {
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-pill.online {
    background: var(--color-success);
    color: white;
  }

  .status-pill.offline {
    background: var(--color-error);
    color: white;
  }

  .module-badge {
    padding: var(--spacing-1) var(--spacing-2);
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .device-reason {
    padding: var(--spacing-2);
    background: var(--color-warning-light);
    border-radius: var(--radius-sm);
    color: var(--color-warning-dark);
  }

  .device-controls {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .control-btn {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-surface-dark);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.2s ease;
    min-width: 2.5rem;
  }

  .control-btn:hover {
    background: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    transform: translateY(-1px);
  }

  .offline-notice {
    color: var(--color-text-muted);
    font-style: italic;
  }

  /* Responsive adjustments */
  @media (max-width: 768px) {
    .device-grid {
      grid-template-columns: 1fr;
    }

    .device-controls {
      justify-content: center;
    }
  }
</style>