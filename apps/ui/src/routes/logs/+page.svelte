<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import Button from '$lib/components/Button.svelte';
  import Card from '$lib/components/Card.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { PageData } from './$types';
  import type { LogEntry, LogSeverity, LogsSnapshot } from '$lib/types';
  import {
    exportLogs,
    fetchLogSnapshot,
    subscribeToLogStream,
    type LogQueryOptions,
    type LogStreamSubscription
  } from '$lib/api/logs-operations';

  export let data: PageData;

  let snapshot: LogsSnapshot | null = data.snapshot ?? null;
  let error: string | null = data.error ?? null;

  let sourceId = snapshot?.sources[0]?.id ?? 'all';
  let severity: LogSeverity | 'all' = 'all';
  let search = '';
  let limit = 200;
  let autoRefresh = true;
  let loading = false;
  let downloading = false;

  let entries: LogEntry[] = snapshot?.entries ?? [];
  let subscription: LogStreamSubscription | null = null;
  let searchDebounce: ReturnType<typeof setTimeout> | null = null;

  const severityOptions: Array<{ value: LogSeverity | 'all'; label: string }> = [
    { value: 'all', label: 'All severities' },
    { value: 'critical', label: 'Critical' },
    { value: 'error', label: 'Errors' },
    { value: 'warning', label: 'Warnings' },
    { value: 'info', label: 'Info' },
    { value: 'debug', label: 'Debug' }
  ];

  $: sources = snapshot?.sources ?? [];

  const applySnapshot = (value: LogsSnapshot) => {
    snapshot = value;
    entries = value.entries;
    if (!sources.find((item) => item.id === sourceId)) {
      sourceId = value.sources[0]?.id ?? 'all';
    }
  };

  const loadLogs = async (options: Partial<LogQueryOptions> = {}) => {
    loading = true;
    error = null;
    try {
      const result = await fetchLogSnapshot({
        fetch,
        sourceId,
        severity,
        search: search.trim(),
        limit,
        ...options
      });
      applySnapshot(result);
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to load logs';
    } finally {
      loading = false;
    }
  };

  const handleStreamEvent = (entry: LogEntry) => {
    entries = [entry, ...entries].slice(0, limit);
    snapshot = snapshot
      ? {
          ...snapshot,
          entries,
          lastUpdated: new Date().toISOString()
        }
      : {
          entries,
          sources,
          cursor: entry.id,
          lastUpdated: new Date().toISOString()
        } satisfies LogsSnapshot;
  };

  const stopStream = () => {
    subscription?.stop();
    subscription = null;
  };

  const startStream = () => {
    stopStream();
    subscription = subscribeToLogStream({
      filters: {
        sourceId,
        severity,
        search: search.trim()
      },
      onEvent: handleStreamEvent,
      onError: (streamError) => {
        console.warn('Log stream error', streamError);
        error = streamError.message;
        autoRefresh = false;
        stopStream();
      }
    });
  };

  const refresh = async () => {
    await loadLogs();
    if (autoRefresh) updateStream();
  };

  const updateStream = () => {
    stopStream();
    if (autoRefresh) {
      startStream();
    }
  };

  const applyFilters = async () => {
    await loadLogs();
    updateStream();
  };

  const handleSourceChange = async (event: Event) => {
    sourceId = (event.target as HTMLSelectElement).value;
    await applyFilters();
  };

  const handleSeverityChange = async (event: Event) => {
    severity = (event.target as HTMLSelectElement).value as typeof severity;
    await applyFilters();
  };

  const handleLimitChange = async (event: Event) => {
    limit = Number((event.target as HTMLSelectElement).value);
    await applyFilters();
  };

  const handleSearchInput = (event: Event) => {
    const value = (event.target as HTMLInputElement).value;
    search = value;
    if (searchDebounce) clearTimeout(searchDebounce);
    searchDebounce = setTimeout(applyFilters, 250);
  };

  onMount(async () => {
    if (!snapshot) {
      await loadLogs();
    }
    updateStream();
  });

  onDestroy(() => {
    stopStream();
    if (searchDebounce) {
      clearTimeout(searchDebounce);
    }
  });

  const download = async (format: 'json' | 'text') => {
    downloading = true;
    try {
      const blob = await exportLogs({ fetch, sourceId, severity, search: search.trim(), limit, format });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `fleet-logs-${new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19)}.${format === 'json' ? 'json' : 'log'}`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } finally {
      downloading = false;
    }
  };

  const formatTimestamp = (timestamp: string) => new Date(timestamp).toLocaleString();
  const maxContextPreview = 240;

  const severityToStatus = (value: LogSeverity): 'ok' | 'warn' | 'error' => {
    if (value === 'critical' || value === 'error') return 'error';
    if (value === 'warning') return 'warn';
    return 'ok';
  };

  const toggleAutoRefresh = async () => {
    autoRefresh = !autoRefresh;
    if (autoRefresh) {
      await applyFilters();
    } else {
      stopStream();
    }
  };
</script>

<svelte:head>
  <title>Logs – Fleet Control</title>
</svelte:head>

<div class="logs-page">
  <div class="toolbar">
    <div class="filters">
      <label>
        <span>Source</span>
        <select bind:value={sourceId} on:change={handleSourceChange}>
          {#each sources as source}
            <option value={source.id}>{source.label}</option>
          {/each}
          <option value="all">All sources</option>
        </select>
      </label>
      <label>
        <span>Severity</span>
        <select bind:value={severity} on:change={handleSeverityChange}>
          {#each severityOptions as option}
            <option value={option.value}>{option.label}</option>
          {/each}
        </select>
      </label>
      <label>
        <span>Rows</span>
        <select bind:value={limit} on:change={handleLimitChange}>
          <option value={50}>50</option>
          <option value={100}>100</option>
          <option value={200}>200</option>
          <option value={500}>500</option>
        </select>
      </label>
      <label class="search">
        <span>Search</span>
        <input
          type="search"
          placeholder="Message, device, correlation ID"
          value={search}
          on:input={handleSearchInput}
        />
      </label>
    </div>
    <div class="actions">
      <Button variant="ghost" on:click={toggleAutoRefresh}>
        {autoRefresh ? '⏸ Pause stream' : '▶ Resume stream'}
      </Button>
      <Button variant="secondary" on:click={() => download('text')} disabled={downloading}>
        Export TXT
      </Button>
      <Button variant="secondary" on:click={() => download('json')} disabled={downloading}>
        Export JSON
      </Button>
      <Button variant="primary" on:click={refresh} disabled={loading}>
        Refresh
      </Button>
    </div>
  </div>

  {#if error}
    <div class="error" role="alert">
      <strong>Log stream unavailable:</strong> {error}
    </div>
  {/if}

  <Card title="Live log stream" subtitle={`Last updated ${snapshot?.lastUpdated ? formatTimestamp(snapshot.lastUpdated) : '–'}`}>
    {#if loading && !entries.length}
      <p class="loading">Loading log entries…</p>
    {:else if !entries.length}
      <div class="empty">
        <p>No log entries match the current filters.</p>
        <Button variant="ghost" on:click={() => { search = ''; severity = 'all'; sourceId = 'all'; }}>Reset filters</Button>
      </div>
    {:else}
      <ul class="log-list">
        {#each entries as entry (entry.id)}
          <li class="log-entry">
            <div class="meta">
              <time datetime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
              <StatusPill status={severityToStatus(entry.severity)} label={entry.severity} />
              <span class="source">{entry.source}</span>
              {#if entry.deviceId}
                <a class="device" href={`/fleet/${entry.deviceId}`}>{entry.deviceId}</a>
              {/if}
              {#if entry.correlationId}
                <span class="correlation">{entry.correlationId}</span>
              {/if}
            </div>
            <pre class="message">{entry.message.length > maxContextPreview ? `${entry.message.slice(0, maxContextPreview)}…` : entry.message}</pre>
            {#if entry.context}
              <details class="context">
                <summary>Context</summary>
                <pre>{JSON.stringify(entry.context, null, 2)}</pre>
              </details>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
</div>

<style>
  .logs-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-6);
  }

  .toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-end;
    justify-content: space-between;
  }

  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-4);
    align-items: flex-end;
  }

  label {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  select,
  input[type='search'] {
    min-width: 12rem;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
  }

  .search input {
    min-width: 18rem;
  }

  .actions {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
  }

  .error {
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    background: rgba(239, 68, 68, 0.15);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: var(--color-red-200);
  }

  .loading {
    margin: 0;
    padding: var(--spacing-4);
    text-align: center;
  }

  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--spacing-3);
    padding: var(--spacing-6) var(--spacing-4);
    color: var(--color-text-muted);
  }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .log-entry {
    border: 1px solid rgba(148, 163, 184, 0.15);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
    background: rgba(11, 23, 45, 0.25);
    display: grid;
    gap: var(--spacing-2);
  }

  .meta {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    align-items: center;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  time {
    font-variant-numeric: tabular-nums;
  }

  .source {
    font-weight: 600;
    color: var(--color-text);
  }

  .device {
    color: var(--color-brand);
    text-decoration: none;
  }

  .device:hover {
    text-decoration: underline;
  }

  .message {
    margin: 0;
    white-space: pre-wrap;
    font-size: var(--font-size-sm);
    line-height: 1.5;
    color: var(--color-text);
  }

  .context {
    background: rgba(15, 23, 42, 0.45);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }

  .context summary {
    padding: var(--spacing-2) var(--spacing-3);
    cursor: pointer;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .context pre {
    margin: 0;
    padding: var(--spacing-3);
    font-size: var(--font-size-xs);
    background: rgba(15, 23, 42, 0.7);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  @media (max-width: 768px) {
    .filters {
      width: 100%;
      justify-content: stretch;
    }

    .filters label,
    .filters select,
    .filters input {
      width: 100%;
    }

    .actions {
      width: 100%;
      justify-content: flex-end;
      flex-wrap: wrap;
    }

    .actions :global(button) {
      flex: 1 1 auto;
    }
  }
</style>
