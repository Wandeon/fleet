<script lang="ts">
  import Card from '$lib/components/Card.svelte';
  import Button from '$lib/components/Button.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let searchQuery = '';
  let selectedSeverity = 'all';
  let selectedTimeRange = '24h';
  let showAdvancedFilters = false;

  $: filteredLogs = data.logs?.entries.filter(entry => {
    // Search filter
    const matchesSearch = !searchQuery ||
      entry.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
      entry.id.toLowerCase().includes(searchQuery.toLowerCase());

    // Severity filter
    const matchesSeverity = selectedSeverity === 'all' || entry.severity === selectedSeverity;

    // Time range filter
    const entryTime = new Date(entry.timestamp);
    const now = new Date();
    const timeThreshold = getTimeThreshold(selectedTimeRange);
    const matchesTime = timeThreshold === null || (now.getTime() - entryTime.getTime()) <= timeThreshold;

    return matchesSearch && matchesSeverity && matchesTime;
  }) || [];

  function getTimeThreshold(range: string): number | null {
    switch (range) {
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
      case '7d': return 7 * 24 * 60 * 60 * 1000;
      case '30d': return 30 * 24 * 60 * 60 * 1000;
      case 'all': return null;
      default: return 24 * 60 * 60 * 1000;
    }
  }

  function clearFilters() {
    searchQuery = '';
    selectedSeverity = 'all';
    selectedTimeRange = '24h';
  }

  function exportLogs() {
    const logsText = filteredLogs.map(entry =>
      `[${entry.timestamp}] ${entry.severity.toUpperCase()}: ${entry.message}`
    ).join('\n');

    const blob = new Blob([logsText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fleet-logs-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="logs-container">
  <Card title="Event log" subtitle="Audit trail of recent actions">
    <!-- Filters and Search -->
    <div class="filters-section">
      <div class="search-bar">
        <input
          type="text"
          placeholder="Search logs by message or ID..."
          bind:value={searchQuery}
          class="search-input"
        />
        <div class="filter-controls">
          <select bind:value={selectedSeverity} class="filter-select">
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
            <option value="debug">Debug</option>
          </select>

          <select bind:value={selectedTimeRange} class="filter-select">
            <option value="1h">Last Hour</option>
            <option value="6h">Last 6 Hours</option>
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      <div class="filter-actions">
        <Button variant="ghost" on:click={clearFilters}>Clear Filters</Button>
        <Button variant="secondary" on:click={exportLogs}>Export Logs</Button>
      </div>
    </div>

    <!-- Results Summary -->
    <div class="results-summary">
      <span class="count">Showing {filteredLogs.length} of {data.logs?.entries.length || 0} entries</span>
      {#if searchQuery || selectedSeverity !== 'all' || selectedTimeRange !== '24h'}
        <span class="filter-indicator">Filters active</span>
      {/if}
    </div>

    <!-- Log Entries -->
    {#if data.error && !data.logs}
      <p role="alert" class="error-message">{data.error}</p>
    {:else if filteredLogs.length > 0}
      <ul class="log-list">
        {#each filteredLogs as entry (entry.id)}
          <li class="log-entry">
            <div class="log-content">
              <time class="log-timestamp">{new Date(entry.timestamp).toLocaleString()}</time>
              <p class="log-message">{entry.message}</p>
              {#if entry.id}
                <span class="log-id">ID: {entry.id}</span>
              {/if}
            </div>
            <StatusPill
              status={entry.severity === 'error' ? 'error' : entry.severity === 'warning' ? 'warn' : 'ok'}
              label={entry.severity}
            />
          </li>
        {/each}
      </ul>
    {:else if data.logs?.entries.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📝</div>
        <p>No log entries available.</p>
        <small>Events will appear here as they occur.</small>
      </div>
    {:else}
      <div class="empty-state">
        <div class="empty-icon">🔍</div>
        <p>No entries match your filters.</p>
        <small>Try adjusting your search criteria.</small>
      </div>
    {/if}
  </Card>
</div>

<style>
  .logs-container {
    max-width: 100%;
    margin: 0 auto;
  }

  .filters-section {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
    margin-bottom: var(--spacing-4);
    padding-bottom: var(--spacing-4);
    border-bottom: 1px solid rgba(148, 163, 184, 0.1);
  }

  .search-bar {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .search-input {
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    width: 100%;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--color-brand);
  }

  .filter-controls {
    display: flex;
    gap: var(--spacing-3);
    flex-wrap: wrap;
  }

  .filter-select {
    padding: var(--spacing-2) var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.4);
    color: var(--color-text);
    font-size: var(--font-size-sm);
    cursor: pointer;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--color-brand);
  }

  .filter-actions {
    display: flex;
    gap: var(--spacing-3);
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
  }

  .results-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    padding: var(--spacing-2) 0;
  }

  .count {
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .filter-indicator {
    background: rgba(59, 130, 246, 0.1);
    color: rgb(59, 130, 246);
    padding: var(--spacing-1) var(--spacing-2);
    border-radius: var(--radius-sm);
    font-size: var(--font-size-xs);
    font-weight: 500;
  }

  .log-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: var(--spacing-3);
  }

  .log-entry {
    display: flex;
    justify-content: space-between;
    gap: var(--spacing-3);
    align-items: flex-start;
    padding: var(--spacing-3);
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: var(--radius-md);
    background: rgba(11, 23, 45, 0.2);
  }

  .log-content {
    flex: 1;
    min-width: 0;
  }

  .log-timestamp {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--spacing-1);
  }

  .log-message {
    margin: 0;
    font-size: var(--font-size-sm);
    color: var(--color-text);
    line-height: 1.5;
  }

  .log-id {
    display: block;
    font-size: var(--font-size-xs);
    color: var(--color-text-muted);
    margin-top: var(--spacing-1);
    font-family: 'Courier New', monospace;
  }

  .empty-state {
    text-align: center;
    padding: var(--spacing-8) var(--spacing-4);
    color: var(--color-text-muted);
  }

  .empty-icon {
    font-size: 3rem;
    margin-bottom: var(--spacing-3);
  }

  .empty-state p {
    margin: 0 0 var(--spacing-2);
    font-size: var(--font-size-lg);
    color: var(--color-text);
  }

  .empty-state small {
    font-size: var(--font-size-sm);
  }

  .error-message {
    color: var(--color-red-500);
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: var(--radius-md);
    padding: var(--spacing-3);
  }

  @media (min-width: 48rem) {
    .search-bar {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }

    .search-input {
      flex: 1;
      max-width: 24rem;
    }

    .filters-section {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }
</style>
