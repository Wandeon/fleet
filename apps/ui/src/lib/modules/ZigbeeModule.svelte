<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import EmptyState from '$lib/components/EmptyState.svelte';
  import Skeleton from '$lib/components/Skeleton.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { StatusLevel } from '$lib/components/types';
  import type { PanelState } from '$lib/stores/app';
  import type { ZigbeeState } from '$lib/types';
  import { createEventDispatcher } from 'svelte';

  export let data: ZigbeeState | null = null;
  export let state: PanelState = 'success';
  export let onRetry: (() => void) | undefined;
  export let title = 'Zigbee';

  const dispatch = createEventDispatcher();

  let showPairingModal = false;
  let isPairing = false;
  let pairingStatus = '';
  let discoveredDevices: Array<{ id: string; name: string; type: string; signal: number }> = [];
  let pairingTimeLeft = 0;
  let pairingTimer: ReturnType<typeof setInterval> | null = null;

  function retry() {
    dispatch('retry');
    onRetry?.();
  }

  const formatStateLabel = (state: ZigbeeState['devices'][number]['state']) =>
    state.replace(/(^|\s)\S/g, (segment) => segment.toUpperCase());

  const toStatus = (state: ZigbeeState['devices'][number]['state']): StatusLevel => {
    if (state === 'active' || state === 'closed') return 'ok';
    if (state === 'open') return 'warn';
    return 'offline';
  };

  async function startPairing() {
    if (isPairing) return;

    showPairingModal = true;
    isPairing = true;
    pairingStatus = 'Starting pairing mode...';
    discoveredDevices = [];
    pairingTimeLeft = 60;

    try {
      const response = await fetch('/api/zigbee/pair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enable: true })
      });

      if (response.ok) {
        pairingStatus = 'Pairing mode active. Press the pairing button on your device.';
        startPairingTimer();
        startDeviceDiscovery();
      } else {
        const error = await response.json();
        pairingStatus = `Pairing failed: ${error.error || 'Unknown error'}`;
        isPairing = false;
      }
    } catch (error) {
      pairingStatus = `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`;
      isPairing = false;
    }
  }

  function startPairingTimer() {
    pairingTimer = setInterval(() => {
      pairingTimeLeft--;
      if (pairingTimeLeft <= 0) {
        stopPairing();
      }
    }, 1000);
  }

  async function stopPairing() {
    if (pairingTimer) {
      clearInterval(pairingTimer);
      pairingTimer = null;
    }

    if (isPairing) {
      try {
        await fetch('/api/zigbee/pair', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enable: false })
        });
      } catch (error) {
        console.error('Error stopping pairing:', error);
      }
    }

    isPairing = false;
    pairingTimeLeft = 0;
    pairingStatus = discoveredDevices.length > 0
      ? `Found ${discoveredDevices.length} device(s)`
      : 'No devices found';
  }

  async function startDeviceDiscovery() {
    const discoveryInterval = setInterval(async () => {
      if (!isPairing) {
        clearInterval(discoveryInterval);
        return;
      }

      try {
        const response = await fetch('/api/zigbee/discover');
        if (response.ok) {
          const newDevices = await response.json();
          if (newDevices.devices && newDevices.devices.length > discoveredDevices.length) {
            discoveredDevices = newDevices.devices;
            pairingStatus = `Found ${discoveredDevices.length} device(s)...`;
          }
        }
      } catch (error) {
        console.error('Discovery error:', error);
      }
    }, 2000);
  }

  async function pairDevice(deviceId: string) {
    try {
      const response = await fetch('/api/zigbee/pair/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId })
      });

      if (response.ok) {
        const result = await response.json();
        pairingStatus = `Successfully paired ${result.name}!`;
        discoveredDevices = discoveredDevices.filter(d => d.id !== deviceId);

        setTimeout(() => {
          closePairingModal();
          dispatch('refresh');
        }, 2000);
      } else {
        const error = await response.json();
        pairingStatus = `Pairing failed: ${error.error || 'Unknown error'}`;
      }
    } catch (error) {
      pairingStatus = `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}`;
    }
  }

  function closePairingModal() {
    if (isPairing) {
      stopPairing();
    }
    showPairingModal = false;
    discoveredDevices = [];
    pairingStatus = '';
  }
</script>

<Card title={title} subtitle="Mesh network status">
  {#if state === 'loading'}
    <div class="stack">
      <Skeleton variant="line" />
      <Skeleton variant="block" height="10rem" />
    </div>
  {:else if state === 'error'}
    <div class="error-state" role="alert">
      <p>Zigbee controller unreachable. Try again?</p>
      <Button variant="primary" on:click={retry}>Retry</Button>
    </div>
  {:else if state === 'empty'}
    <EmptyState title="No Zigbee devices" description="Pair a sensor or dimmer to populate the table.">
      <svelte:fragment slot="icon">🕸️</svelte:fragment>
    </EmptyState>
  {:else if data}
    <div class="zigbee-grid">
      <div class="actions">
        <Button variant="primary" on:click={startPairing} disabled={isPairing}>
          {isPairing ? 'Pairing...' : 'Pair Device'}
        </Button>
        {#each data.quickActions as action (action.id)}
          <Button variant="secondary">{action.label}</Button>
        {/each}
      </div>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Type</th>
              <th scope="col">State</th>
              <th scope="col">Last seen</th>
            </tr>
          </thead>
          <tbody>
            {#each data.devices as device (device.id)}
              <tr>
                <th scope="row">{device.name}</th>
                <td>{device.type}</td>
                <td>
                  <StatusPill status={toStatus(device.state)} label={formatStateLabel(device.state)} />
                </td>
                <td>{new Date(device.lastSeen).toLocaleTimeString()}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {:else}
    <EmptyState title="Zigbee data missing" description="Unable to read Zigbee telemetry." />
  {/if}
</Card>

{#if showPairingModal}
  <div class="modal-backdrop" on:click|self={closePairingModal}>
    <div class="modal">
      <div class="modal-header">
        <h3>Pair Zigbee Device</h3>
        <button type="button" class="close-btn" on:click={closePairingModal}>&times;</button>
      </div>

      <div class="modal-body">
        <div class="pairing-status">
          <div class="status-icon" class:active={isPairing}>
            {#if isPairing}
              <div class="spinner"></div>
            {:else}
              📡
            {/if}
          </div>
          <p>{pairingStatus}</p>
          {#if isPairing && pairingTimeLeft > 0}
            <div class="timer">Time remaining: {pairingTimeLeft}s</div>
            <div class="progress-bar">
              <div class="progress" style="width: {(pairingTimeLeft / 60) * 100}%"></div>
            </div>
          {/if}
        </div>

        {#if discoveredDevices.length > 0}
          <div class="discovered-devices">
            <h4>Discovered Devices</h4>
            <ul class="device-list">
              {#each discoveredDevices as device (device.id)}
                <li class="device-item">
                  <div class="device-info">
                    <strong>{device.name}</strong>
                    <span class="device-type">{device.type}</span>
                    <span class="signal-strength">Signal: {device.signal}%</span>
                  </div>
                  <Button variant="primary" on:click={() => pairDevice(device.id)}>
                    Pair
                  </Button>
                </li>
              {/each}
            </ul>
          </div>
        {:else if !isPairing}
          <div class="instructions">
            <h4>Pairing Instructions</h4>
            <ol>
              <li>Put your Zigbee device in pairing mode</li>
              <li>Press the "Start Pairing" button</li>
              <li>Wait for the device to be discovered</li>
              <li>Select the device to complete pairing</li>
            </ol>
          </div>
        {/if}
      </div>

      <div class="modal-footer">
        {#if isPairing}
          <Button variant="secondary" on:click={stopPairing}>Stop Pairing</Button>
        {:else}
          <Button variant="secondary" on:click={closePairingModal}>Close</Button>
          <Button variant="primary" on:click={startPairing}>Start Pairing</Button>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .stack {
    display: grid;
    gap: var(--spacing-3);
  }

  .error-state {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .zigbee-grid {
    display: grid;
    gap: var(--spacing-3);
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .table-wrapper {
    border: 1px solid rgba(148, 163, 184, 0.25);
    border-radius: var(--radius-md);
    overflow-x: auto;
  }

  table {
    width: 100%;
    border-collapse: collapse;
    min-width: 32rem;
  }

  th,
  td {
    padding: 0.75rem;
    text-align: left;
  }

  thead {
    background: rgba(15, 23, 42, 0.6);
  }

  tbody tr:nth-child(even) {
    background: rgba(148, 163, 184, 0.05);
  }

  tbody tr:hover {
    background: rgba(56, 189, 248, 0.12);
  }

  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.75);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--spacing-4);
  }

  .modal {
    background: var(--color-bg-primary);
    border-radius: var(--radius-lg);
    border: 1px solid rgba(148, 163, 184, 0.25);
    max-width: 36rem;
    width: 100%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-4);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .modal-header h3 {
    margin: 0;
    color: var(--color-text);
    font-size: var(--font-size-lg);
  }

  .close-btn {
    background: none;
    border: none;
    color: var(--color-text-muted);
    font-size: var(--font-size-xl);
    cursor: pointer;
    padding: 0;
    width: 2rem;
    height: 2rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-sm);
  }

  .close-btn:hover {
    background: rgba(148, 163, 184, 0.1);
    color: var(--color-text);
  }

  .modal-body {
    padding: var(--spacing-4);
    display: grid;
    gap: var(--spacing-4);
  }

  .pairing-status {
    text-align: center;
    padding: var(--spacing-4);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.4);
  }

  .status-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-3);
  }

  .spinner {
    width: 2rem;
    height: 2rem;
    border: 3px solid rgba(59, 130, 246, 0.3);
    border-top-color: rgb(59, 130, 246);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }

  .timer {
    font-weight: 500;
    color: var(--color-text);
    margin-top: var(--spacing-2);
  }

  .progress-bar {
    width: 100%;
    height: 0.5rem;
    background: rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-sm);
    margin-top: var(--spacing-2);
    overflow: hidden;
  }

  .progress {
    height: 100%;
    background: linear-gradient(90deg, rgb(59, 130, 246), rgb(37, 99, 235));
    transition: width 1s ease;
  }

  .discovered-devices h4,
  .instructions h4 {
    margin: 0 0 var(--spacing-3);
    color: var(--color-text);
    font-size: var(--font-size-md);
  }

  .device-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .device-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.2);
  }

  .device-info {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .device-info strong {
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }

  .device-type,
  .signal-strength {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .instructions ol {
    margin: 0;
    padding-left: var(--spacing-4);
    color: var(--color-text-muted);
  }

  .instructions li {
    margin-bottom: var(--spacing-2);
    line-height: 1.5;
  }

  .modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-3);
    padding: var(--spacing-4);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }
</style>
