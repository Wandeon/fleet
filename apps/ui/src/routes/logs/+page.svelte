<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import { onDestroy, onMount } from 'svelte';
  import { createLogsStream, fetchLogsSnapshot, type LogsStream } from '$lib/api/logs-operations';
  import type { LogEntry, LogLevel } from '$lib/types';
  import type { PageData } from './$types';

  export let data: PageData;

  type LevelFilter = LogLevel | 'all';

  const levelPriority = new Map<LogLevel, number>([
    ['trace', 0],
    ['debug', 1],
    ['info', 2],
    ['warn', 3],
    ['error', 4],
    ['fatal', 5]
  ]);

  const levelOptions: { value: LevelFilter; label: string }[] = [
    { value: 'all', label: 'All levels' },
    { value: 'debug', label: 'Debug and above' },
    { value: 'info', label: 'Info and above' },
    { value: 'warn', label: 'Warnings and errors' },
    { value: 'error', label: 'Errors only' },
    { value: 'fatal', label: 'Fatal only' }
  ];

  let entries: LogEntry[] = [...data.snapshot.entries].sort((a, b) => a.ts.localeCompare(b.ts));
  let searchTerm = '';
  let selectedLevel: LevelFilter = data.level ?? 'info';
  let stream: LogsStream | null = null;
  let streamPaused = false;
  let streamError: string | null = null;
  let loading = false;
  let lastUpdated = new Date().toISOString();

  const ensureCapacity = (list: LogEntry[], max = 500) => (list.length > max ? list.slice(list.length - max) : list);

  const mergeEntry = (list: LogEntry[], entry: LogEntry): LogEntry[] => {
    const filtered = list.filter((item) => !(item.id === entry.id && item.ts === entry.ts));
    const next = [...filtered, entry].sort((a, b) => a.ts.localeCompare(b.ts));
    return ensureCapacity(next);
  };

  const matchesLevel = (entry: LogEntry, level: LevelFilter): boolean => {
    if (level === 'all') return true;
    const entryPriority = levelPriority.get(entry.level) ?? 0;
    const filterPriority = levelPriority.get(level) ?? 0;
    return entryPriority >= filterPriority;
  };

  const matchesSearch = (entry: LogEntry, query: string): boolean => {
    if (!query.trim()) return true;
    const term = query.trim().toLowerCase();
    return (
      entry.msg.toLowerCase().includes(term) ||
      entry.service.toLowerCase().includes(term) ||
      entry.host.toLowerCase().includes(term) ||
      (entry.correlationId ?? '').toLowerCase().includes(term) ||
      entry.id.toLowerCase().includes(term)
    );
  };

  const formatTimestamp = (iso: string): string => {
    try {
      const date = new Date(iso);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch {
      return iso;
    }
  };

  const formatRelative = (iso: string): string => {
    const now = Date.now();
    const then = Date.parse(iso);
    if (Number.isNaN(then)) return iso;
    const diff = Math.max(0, now - then);
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  const maxDisplayed = 200;

  $: filteredEntries = ensureCapacity(
    entries.filter((entry) => matchesLevel(entry, selectedLevel) && matchesSearch(entry, searchTerm))
  )
    .slice(-maxDisplayed)
    .sort((a, b) => b.ts.localeCompare(a.ts));

  $: totalEntries = entries.length;

  function connectStream(): void {
    stream?.close();
    streamError = null;
    const level = selectedLevel === 'all' ? 'trace' : (selectedLevel as LogLevel);
    stream = createLogsStream({
      level,
      onError: (error) => {
        streamError = error.message;
      }
    });
    streamPaused = false;
    stream?.subscribe((entry) => {
      entries = mergeEntry(entries, entry);
      lastUpdated = entry.ts;
    });
  }

  async function refreshSnapshot(): Promise<void> {
    loading = true;
    try {
      const snapshot = await fetchLogsSnapshot({ level: selectedLevel === 'all' ? undefined : (selectedLevel as LogLevel) });
      entries = [...snapshot.entries].sort((a, b) => a.ts.localeCompare(b.ts));
      lastUpdated = new Date().toISOString();
      streamError = null;
    } catch (error) {
      streamError = error instanceof Error ? error.message : String(error);
    } finally {
      loading = false;
    }
  }

  function toggleStream(): void {
    if (!stream) {
      connectStream();
      return;
    }
    if (streamPaused) {
      stream.resume();
      streamPaused = false;
    } else {
      stream.pause();
      streamPaused = true;
    }
  }

  function clearFilters(): void {
    searchTerm = '';
    if (selectedLevel !== 'all') {
      selectedLevel = 'all';
      refreshSnapshot().then(connectStream);
    }
  }

  function onLevelChange(event: Event): void {
    const target = event.currentTarget as HTMLSelectElement;
    selectedLevel = (target.value as LevelFilter) ?? 'all';
    refreshSnapshot().then(connectStream);
  }

  onMount(() => {
    connectStream();
    return () => {
      stream?.close();
    };
  });

  onDestroy(() => {
    stream?.close();
  });
</script>

<div class="logs-page">
  <Card title="Fleet logs" subtitle="Live stream of structured log entries">
    <div class="toolbar">
      <div class="filters">
        <label class="search">
          <span class="sr-only">Search logs</span>
          <input
            type="search"
            placeholder="Search message, host, or correlation ID"
            bind:value={searchTerm}
            autocomplete="off"
          />
        </label>
        <label class="level">
          <span>Level</span>
          <select bind:value={selectedLevel} on:change={onLevelChange}>
            {#each levelOptions as option (option.value)}
              <option value={option.value}>{option.label}</option>
            {/each}
          </select>
        </label>
      </div>
      <div class="actions">
        <Button variant="secondary" on:click={toggleStream}>
          {streamPaused ? 'Resume stream' : 'Pause stream'}
        </Button>
        <Button variant="secondary" on:click={refreshSnapshot} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh snapshot'}
        </Button>
        <Button variant="ghost" on:click={clearFilters} disabled={!searchTerm && selectedLevel === 'all'}>
          Clear filters
        </Button>
      </div>
    </div>

    {#if data.error}
      <p class="error" role="alert">{data.error}</p>
    {/if}
    {#if streamError}
      <p class="warning" role="status">Stream warning: {streamError}</p>
    {/if}

    <div class="summary" role="status" aria-live="polite">
      <span>{filteredEntries.length} of {totalEntries} entries</span>
      <span>Stream {streamPaused ? 'paused' : 'live'}</span>
      <span>Last update {formatRelative(lastUpdated)}</span>
    </div>

    {#if filteredEntries.length === 0}
      <div class="empty">
        <p>No log entries match the current filters.</p>
        <small>Adjust the level filter or clear your search to see more events.</small>
      </div>
    {:else}
      <div class="log-table" role="table" aria-label="Structured log entries">
        <div class="log-row header" role="row">
          <div class="cell timestamp" role="columnheader">Timestamp</div>
          <div class="cell level" role="columnheader">Level</div>
          <div class="cell message" role="columnheader">Message</div>
          <div class="cell service" role="columnheader">Service / Host</div>
          <div class="cell correlation" role="columnheader">Correlation ID</div>
        </div>
        <div class="log-body" role="rowgroup">
          {#each filteredEntries as entry (entry.id + entry.ts)}
            <div class="log-row" role="row">
              <div class="cell timestamp" role="cell" data-label="Timestamp">
                <time datetime={entry.ts}>{formatTimestamp(entry.ts)}</time>
              </div>
              <div class="cell level" role="cell" data-label="Level">
                <span class={`level-badge ${entry.level}`}>
                  <span class="dot" aria-hidden="true"></span>
                  {entry.level.toUpperCase()}
                </span>
              </div>
              <div class="cell message" role="cell" data-label="Message">{entry.msg}</div>
              <div class="cell service" role="cell" data-label="Service / Host">
                <span class="service-name">{entry.service}</span>
                <span class="host">{entry.host}</span>
              </div>
              <div class="cell correlation" role="cell" data-label="Correlation ID">
                {entry.correlationId ?? '—'}
              </div>
            </div>
          {/each}
        </div>
      </div>
    {/if}
  </Card>
</div>

<style>
  .logs-page {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .toolbar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    margin-bottom: var(--spacing-4);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
    padding-bottom: var(--spacing-4);
  }

  .filters {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .search {
    flex: 1 1 18rem;
  }

  .search input {
    width: 100%;
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.5);
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }

  .search input:focus {
    outline: none;
    border-color: var(--color-brand);
    box-shadow: 0 0 0 1px var(--color-brand-transparent);
  }

  .level {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .level select {
    min-width: 14rem;
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.3);
    background: rgba(11, 23, 45, 0.5);
    color: var(--color-text);
    font-size: var(--font-size-sm);
  }

  .actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .summary {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-3);
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-3);
  }

  .error,
  .warning {
    padding: var(--spacing-2) var(--spacing-3);
    border-radius: var(--radius-md);
    margin-bottom: var(--spacing-3);
    font-size: var(--font-size-sm);
  }

  .error {
    background: rgba(239, 68, 68, 0.12);
    color: rgb(248, 113, 113);
  }

  .warning {
    background: rgba(251, 191, 36, 0.12);
    color: rgb(251, 191, 36);
  }

  .empty {
    padding: var(--spacing-6);
    border: 1px dashed rgba(148, 163, 184, 0.2);
    border-radius: var(--radius-lg);
    text-align: center;
    display: grid;
    gap: var(--spacing-2);
    color: var(--color-text-muted);
  }

  .log-table {
    border: 1px solid rgba(148, 163, 184, 0.12);
    border-radius: var(--radius-lg);
    overflow: hidden;
    background: rgba(11, 23, 45, 0.4);
  }

  .log-row {
    display: grid;
    grid-template-columns: minmax(10rem, 1.4fr) minmax(7rem, 0.9fr) minmax(16rem, 3fr) minmax(12rem, 1.8fr) minmax(10rem, 1.5fr);
    gap: var(--spacing-2);
    padding: var(--spacing-3) var(--spacing-4);
    align-items: center;
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }

  .log-row.header {
    background: rgba(15, 32, 60, 0.6);
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-text-muted);
    border-top: none;
  }

  .log-body .log-row:nth-child(odd) {
    background: rgba(15, 32, 60, 0.35);
  }

  .cell {
    font-size: var(--font-size-sm);
    color: var(--color-text);
    overflow-wrap: anywhere;
  }

  .cell.timestamp time {
    font-family: 'JetBrains Mono', Menlo, Consolas, monospace;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .level-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.2rem 0.65rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    letter-spacing: 0.04em;
    font-weight: 600;
    text-transform: uppercase;
    background: rgba(148, 163, 184, 0.18);
  }

  .level-badge .dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 50%;
    background: currentColor;
  }

  .level-badge.trace,
  .level-badge.debug {
    color: rgb(94, 234, 212);
    background: rgba(94, 234, 212, 0.16);
  }

  .level-badge.info {
    color: rgb(96, 165, 250);
    background: rgba(96, 165, 250, 0.18);
  }

  .level-badge.warn {
    color: rgb(250, 204, 21);
    background: rgba(250, 204, 21, 0.18);
  }

  .level-badge.error,
  .level-badge.fatal {
    color: rgb(248, 113, 113);
    background: rgba(248, 113, 113, 0.18);
  }

  .service-name {
    display: block;
    font-weight: 600;
  }

  .host {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }

  @media (max-width: 920px) {
    .log-row,
    .log-row.header {
      grid-template-columns: minmax(0, 1fr);
      gap: var(--spacing-2);
    }

    .log-row.header {
      display: none;
    }

    .cell {
      display: grid;
      grid-template-columns: minmax(7rem, 1fr) minmax(0, 1.5fr);
      gap: var(--spacing-1);
      align-items: baseline;
    }

    .cell::before {
      content: attr(data-label);
      font-size: var(--font-size-xs);
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .log-body .log-row {
      border-top: 1px solid rgba(148, 163, 184, 0.1);
    }

    .log-row .timestamp {
      order: -2;
    }

    .log-row .level {
      order: -1;
    }

    .log-row .message {
      order: 0;
    }
  }
</style>
