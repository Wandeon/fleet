<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { fetchLogsSnapshot } from '$lib/api/logs-operations';
  import type { LogEntry } from '$lib/types';

  export let expanded = true;

  let logs: LogEntry[] = [];
  let loading = true;
  let error: string | null = null;
  let autoScroll = true;
  let logContainer: HTMLElement;
  let logInterval: ReturnType<typeof setInterval>;

  const fetchLogs = async () => {
    try {
      const response = await fetchLogsSnapshot({ limit: 100 });
      logs = response.entries || [];
      error = null;
    } catch (err) {
      console.error('Failed to fetch logs:', err);
      error = 'Failed to fetch logs';
    } finally {
      loading = false;
    }
  };

  const scrollToBottom = () => {
    if (autoScroll && logContainer) {
      logContainer.scrollTop = logContainer.scrollHeight;
    }
  };

  onMount(async () => {
    await fetchLogs();
    logInterval = setInterval(fetchLogs, 5000);
    scrollToBottom();
  });

  onDestroy(() => {
    if (logInterval) {
      clearInterval(logInterval);
    }
  });

  $: if (logs.length && autoScroll) {
    setTimeout(scrollToBottom, 50);
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString();
  };

  const getLogLevelClass = (level: string | undefined) => {
    switch (level?.toLowerCase()) {
      case 'error': return 'log-error';
      case 'warn': return 'log-warn';
      case 'info': return 'log-info';
      case 'debug': return 'log-debug';
      default: return 'log-default';
    }
  };
</script>

<div class="logs-panel" class:expanded>
  <div class="logs-header">
    <h2>System Logs</h2>
    <div class="controls">
      <label class="auto-scroll">
        <input type="checkbox" bind:checked={autoScroll} />
        Auto-scroll
      </label>
      <button on:click={fetchLogs} disabled={loading}>
        {loading ? 'Loading...' : 'Refresh'}
      </button>
    </div>
  </div>

  {#if loading && logs.length === 0}
    <div class="loading">
      <p>Loading logs...</p>
    </div>
  {:else if error}
    <div class="error">
      <p>{error}</p>
      <button on:click={fetchLogs}>Retry</button>
    </div>
  {:else if logs.length > 0}
    <div class="logs-container" bind:this={logContainer}>
      {#each logs as log (log.timestamp + log.message)}
        <div class="log-entry {getLogLevelClass(log.level)}">
          <span class="timestamp">{formatTimestamp(log.timestamp)}</span>
          <span class="level">{log.level?.toUpperCase() || 'INFO'}</span>
          <span class="source">{log.correlationId || 'system'}</span>
          <span class="message">{log.message}</span>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty-state">
      <p>No logs available</p>
      <small>System logs will appear here</small>
    </div>
  {/if}
</div>

<style>
  .logs-panel {
    padding: var(--spacing-4);
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .logs-header {
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

  .controls {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
  }

  .auto-scroll {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    font-size: 0.875rem;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  button {
    padding: var(--spacing-2) var(--spacing-3);
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: var(--radius-sm);
    font-size: 0.875rem;
    cursor: pointer;
    transition: background-color 0.2s ease;
  }

  button:hover:not(:disabled) {
    background: var(--color-primary-dark);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .loading, .error, .empty-state {
    flex: 1;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    text-align: center;
    color: var(--color-text-muted);
  }

  .error {
    color: var(--color-error);
  }

  .logs-container {
    flex: 1;
    overflow-y: auto;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--spacing-3);
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
  }

  .log-entry {
    display: grid;
    grid-template-columns: auto auto auto 1fr;
    gap: var(--spacing-3);
    padding: var(--spacing-2) 0;
    border-bottom: 1px solid var(--color-border);
  }

  .log-entry:last-child {
    border-bottom: none;
  }

  .timestamp {
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .level {
    font-weight: 600;
    white-space: nowrap;
    padding: 0 var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: 0.75rem;
  }

  .source {
    color: var(--color-text-muted);
    white-space: nowrap;
  }

  .message {
    color: var(--color-text);
    word-break: break-word;
  }

  .log-error .level {
    background: var(--color-error-light);
    color: var(--color-error-dark);
  }

  .log-warn .level {
    background: var(--color-warning-light);
    color: var(--color-warning-dark);
  }

  .log-info .level {
    background: var(--color-info-light);
    color: var(--color-info-dark);
  }

  .log-debug .level {
    background: var(--color-surface);
    color: var(--color-text-muted);
  }

  .log-default .level {
    background: var(--color-surface);
    color: var(--color-text);
  }
</style>