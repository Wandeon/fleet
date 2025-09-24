<script lang="ts">
  import type { PageData } from './$types';
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';

  export let data: PageData;
  const { device } = data;

  let actionStatus = '';

  async function performAction(action: string) {
    actionStatus = `${action}...`;

    // Mock action - in real implementation, this would call the API
    await new Promise(resolve => setTimeout(resolve, 2000));

    actionStatus = `${action} completed`;
    setTimeout(() => {
      actionStatus = '';
    }, 3000);
  }

  function downloadLogs() {
    // Mock log download - in real implementation, this would fetch and download logs
    const logData = device.logs.map(log =>
      `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`
    ).join('\n');

    const blob = new Blob([logData], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${device.id}-logs.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function formatTimestamp(isoString: string): string {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffMins < 1440) {
      return `${Math.floor(diffMins / 60)}h ago`;
    } else {
      return `${Math.floor(diffMins / 1440)}d ago`;
    }
  }

  function getLogLevelColor(level: string): string {
    switch (level) {
      case 'error': return 'var(--color-red-500)';
      case 'warn': return 'var(--color-yellow-500)';
      case 'info': return 'var(--color-blue-500)';
      default: return 'var(--color-gray-500)';
    }
  }

  const statusToLevel = (status: string) => {
    if (status === 'online') return 'ok';
    if (status === 'error') return 'error';
    return 'offline';
  };
</script>

<svelte:head>
  <title>{device.name} - Device Details</title>
</svelte:head>

<div class="device-detail">
  <div class="header">
    <div class="breadcrumb">
      <a href="/fleet">Fleet</a>
      <span class="separator">›</span>
      <span class="current">{device.name}</span>
    </div>

    <div class="device-header">
      <div class="device-info">
        <h1>{device.name}</h1>
        <div class="device-meta">
          <StatusPill status={statusToLevel(device.status)} />
          <span class="device-id">{device.id}</span>
          <span class="device-role">{device.role}</span>
        </div>
      </div>

      <div class="actions">
        {#if actionStatus}
          <div class="action-status">
            {actionStatus}
          </div>
        {/if}

        <button
          class="btn primary"
          on:click={() => performAction('Restart')}
          disabled={actionStatus !== ''}
        >
          Restart Device
        </button>

        <button
          class="btn secondary"
          on:click={() => performAction('Resync')}
          disabled={actionStatus !== ''}
        >
          Resync
        </button>

        <button
          class="btn secondary"
          on:click={downloadLogs}
        >
          Download Logs
        </button>
      </div>
    </div>
  </div>

  <div class="content-grid">
    <div class="main-content">
      <Card title="Device Status" subtitle="Current operational status and metrics">
        <div class="status-grid">
          <div class="status-item">
            <strong>Connection</strong>
            <span class={device.status === 'online' ? 'status-online' : 'status-offline'}>
              {device.status === 'online' ? 'Connected' : 'Disconnected'}
            </span>
          </div>

          <div class="status-item">
            <strong>Last Seen</strong>
            <span>{formatTimestamp(device.lastSeen)}</span>
          </div>

          <div class="status-item">
            <strong>IP Address</strong>
            <span>{device.ipAddress}</span>
          </div>

          <div class="status-item">
            <strong>Uptime</strong>
            <span>{device.uptime}</span>
          </div>

          <div class="status-item">
            <strong>Version</strong>
            <span>{device.version}</span>
          </div>

          <div class="status-item">
            <strong>Module</strong>
            <span class="module-badge">{device.module}</span>
          </div>
        </div>
      </Card>

      {#if device.capabilities.length > 0}
        <Card title="Capabilities" subtitle="Available device functionality">
          <div class="capabilities">
            {#each device.capabilities as capability}
              <span class="capability-badge">{capability}</span>
            {/each}
          </div>
        </Card>
      {/if}

      <Card title="Recent Logs" subtitle="Latest device activity and events">
        <div class="logs">
          {#each device.logs as log}
            <div class="log-entry">
              <div class="log-meta">
                <span
                  class="log-level"
                  style="color: {getLogLevelColor(log.level)}"
                >
                  {log.level.toUpperCase()}
                </span>
                <span class="log-timestamp">{formatTimestamp(log.timestamp)}</span>
              </div>
              <div class="log-message">{log.message}</div>
            </div>
          {/each}
        </div>
      </Card>
    </div>

    <div class="sidebar">
      <Card title="Quick Actions" subtitle="Common device operations">
        <div class="quick-actions">
          <button
            class="action-btn"
            on:click={() => performAction('Health Check')}
            disabled={actionStatus !== ''}
          >
            🩺 Health Check
          </button>

          <button
            class="action-btn"
            on:click={() => performAction('Update')}
            disabled={actionStatus !== ''}
          >
            🔄 Update Firmware
          </button>

          <button
            class="action-btn"
            on:click={() => performAction('Reset Config')}
            disabled={actionStatus !== ''}
          >
            ⚙️ Reset Config
          </button>

          <button
            class="action-btn"
            on:click={() => performAction('Factory Reset')}
            disabled={actionStatus !== ''}
          >
            🏭 Factory Reset
          </button>
        </div>
      </Card>

      <Card title="Device Information" subtitle="Hardware and configuration details">
        <div class="device-details">
          <div class="detail-item">
            <strong>Hardware</strong>
            <span>Raspberry Pi 4</span>
          </div>

          <div class="detail-item">
            <strong>Location</strong>
            <span>Living Room</span>
          </div>

          <div class="detail-item">
            <strong>Network</strong>
            <span>Tailscale VPN</span>
          </div>

          <div class="detail-item">
            <strong>Added</strong>
            <span>2025-09-20</span>
          </div>
        </div>
      </Card>
    </div>
  </div>
</div>

<style>
  .device-detail {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .header {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .breadcrumb {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .breadcrumb a {
    color: var(--color-brand);
    text-decoration: none;
  }

  .breadcrumb a:hover {
    text-decoration: underline;
  }

  .separator {
    color: var(--color-text-muted);
  }

  .current {
    color: var(--color-text);
    font-weight: 500;
  }

  .device-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);
  }

  .device-info h1 {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-size-2xl);
  }

  .device-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .device-id {
    font-family: 'Courier New', monospace;
    background: rgba(148, 163, 184, 0.1);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
  }

  .device-role {
    background: var(--color-brand);
    color: white;
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-sm);
    text-transform: capitalize;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .action-status {
    padding: var(--spacing-2) var(--spacing-3);
    background: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: var(--radius-md);
    color: rgb(59, 130, 246);
    font-size: var(--font-size-sm);
  }

  .btn {
    padding: var(--spacing-2) var(--spacing-4);
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

  .btn.secondary:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.2);
  }

  .content-grid {
    display: grid;
    gap: var(--spacing-6);
    grid-template-columns: 1fr;
  }

  @media (min-width: 64rem) {
    .content-grid {
      grid-template-columns: 2fr 1fr;
    }
  }

  .main-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .status-grid {
    display: grid;
    gap: var(--spacing-4);
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
  }

  .status-item {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
  }

  .status-item strong {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .status-item span {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .status-online {
    color: var(--color-green-500) !important;
  }

  .status-offline {
    color: var(--color-red-500) !important;
  }

  .module-badge {
    background: rgba(147, 51, 234, 0.1);
    color: rgb(147, 51, 234);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
  }

  .capabilities {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-2);
  }

  .capability-badge {
    background: rgba(34, 197, 94, 0.1);
    color: rgb(34, 197, 94);
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    font-size: var(--font-size-sm);
  }

  .logs {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .log-entry {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-1);
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.2);
  }

  .log-meta {
    display: flex;
    align-items: center;
    gap: var(--spacing-3);
  }

  .log-level {
    font-size: var(--font-size-xs);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }

  .log-timestamp {
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .log-message {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  .quick-actions {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .action-btn {
    padding: var(--spacing-3);
    text-align: left;
    background: rgba(148, 163, 184, 0.05);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-md);
    color: var(--color-text);
    cursor: pointer;
    transition: all 0.2s ease;
    font-size: var(--font-size-sm);
  }

  .action-btn:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.1);
  }

  .action-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .device-details {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .detail-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .detail-item:last-child {
    border-bottom: none;
  }

  .detail-item strong {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .detail-item span {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  @media (max-width: 48rem) {
    .device-header {
      flex-direction: column;
      align-items: stretch;
    }

    .actions {
      justify-content: flex-start;
    }
  }
</style>
