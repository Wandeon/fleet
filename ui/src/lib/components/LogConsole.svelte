<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { apiFetch } from '$lib/api';

  type ApiLogEntry = {
    id: string;
    timestamp: string;
    timestampNs?: string;
    message: string;
    severity?: string;
    source?: string;
    labels?: Record<string, string>;
  };

  type ApiLogSource = {
    id: string;
    label: string;
    kind?: string;
    hosts?: string[];
  };

  type ApiResponse = {
    entries?: ApiLogEntry[];
    source?: string;
    sources?: ApiLogSource[];
    query?: string;
    range?: { start?: string; end?: string };
    limit?: number;
    stats?: unknown;
  };

  type LogEntry = Required<ApiLogEntry> & {
    severity: string;
    source: string;
    labels: Record<string, string>;
  };

  const DEFAULT_LIMIT = 200;
  const POLL_INTERVAL_MS = 5000;

  let entries: LogEntry[] = [];
  let sources: ApiLogSource[] = [];
  let selectedSource = 'all';
  let isPlaying = true;
  let isLoading = false;
  let error: string | null = null;
  let lastUpdated: string | null = null;
  let query = '';
  let range: { start: string; end: string } | null = null;

  let pollTimer: ReturnType<typeof setInterval> | null = null;
  let expanded = new Set<string>();

  function severityLabel(severity: string) {
    return severity.toUpperCase();
  }

  function severityBadgeClass(severity: string) {
    const lookup: Record<string, string> = {
      emergency: 'bg-rose-100 text-rose-800 border border-rose-200',
      alert: 'bg-rose-100 text-rose-800 border border-rose-200',
      critical: 'bg-rose-100 text-rose-800 border border-rose-200',
      error: 'bg-rose-100 text-rose-700 border border-rose-200',
      warning: 'bg-amber-100 text-amber-800 border border-amber-200',
      notice: 'bg-sky-100 text-sky-800 border border-sky-200',
      info: 'bg-neutral-100 text-neutral-600 border border-neutral-200',
      debug: 'bg-neutral-100 text-neutral-500 border border-neutral-200',
    };
    return lookup[severity] || 'bg-neutral-100 text-neutral-600 border border-neutral-200';
  }

  function formatTimestamp(timestamp: string) {
    try {
      return new Date(timestamp).toLocaleString();
    } catch (err) {
      return timestamp;
    }
  }

  function isMultiline(message: string) {
    return message.includes('\n');
  }

  function collapsedMessage(message: string) {
    const [firstLine, ...rest] = message.split('\n');
    if (!rest.length) return firstLine;
    return `${firstLine} … (+${rest.length} more line${rest.length === 1 ? '' : 's'})`;
  }

  function toggleExpand(id: string) {
    const next = new Set(expanded);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    expanded = next;
  }

  function isExpanded(id: string) {
    return expanded.has(id);
  }

  function updateEntries(data: ApiResponse) {
    const rawEntries = Array.isArray(data.entries) ? data.entries : [];
    entries = rawEntries.map((entry) => ({
      id: entry.id,
      timestamp: entry.timestamp,
      timestampNs: entry.timestampNs ?? entry.timestamp,
      message: entry.message ?? '',
      severity: (entry.severity ?? 'info').toLowerCase(),
      source: entry.source ?? 'unknown',
      labels: entry.labels ?? {},
    }));
    const valid = new Set(entries.map((entry) => entry.id));
    const filtered = new Set<string>();
    for (const id of expanded) {
      if (valid.has(id)) filtered.add(id);
    }
    expanded = filtered;
  }

  async function fetchLogs(opts: { sourceOverride?: string } = {}) {
    if (isLoading) return;
    isLoading = true;
    error = null;
    try {
      const params = new URLSearchParams();
      const sourceId = opts.sourceOverride ?? selectedSource;
      if (sourceId) params.set('source', sourceId);
      params.set('limit', String(DEFAULT_LIMIT));
      const response = await apiFetch(`/logs?${params.toString()}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch logs (${response.status})`);
      }
      const data = (await response.json()) as ApiResponse;
      if (Array.isArray(data.sources)) {
        sources = data.sources;
      }
      if (typeof data.source === 'string' && data.source.length) {
        selectedSource = data.source;
      } else if (sources.length && !sources.find((source) => source.id === selectedSource)) {
        selectedSource = sources[0]?.id ?? selectedSource;
      }
      updateEntries(data);
      query = typeof data.query === 'string' ? data.query : '';
      if (data.range?.start && data.range?.end) {
        range = { start: data.range.start, end: data.range.end };
      } else {
        range = null;
      }
      lastUpdated = new Date().toISOString();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      isLoading = false;
    }
  }

  function togglePlay() {
    isPlaying = !isPlaying;
    if (isPlaying) {
      fetchLogs();
    }
  }

  function clearLogs() {
    entries = [];
    expanded = new Set();
  }

  function downloadLogs() {
    const lines = entries.map((entry) => {
      const ts = formatTimestamp(entry.timestamp);
      const sev = severityLabel(entry.severity);
      return `[${ts}] [${entry.source}] [${sev}] ${entry.message}`;
    });
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    const suffix = selectedSource || 'all';
    link.href = url;
    link.download = `logs-${suffix}-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function selectSource(id: string) {
    if (selectedSource === id) return;
    selectedSource = id;
    fetchLogs({ sourceOverride: id });
  }

  onMount(() => {
    fetchLogs();
    pollTimer = setInterval(() => {
      if (isPlaying) {
        fetchLogs();
      }
    }, POLL_INTERVAL_MS);
  });

  onDestroy(() => {
    if (pollTimer) {
      clearInterval(pollTimer);
    }
  });

  function formatRange() {
    if (!range) return '';
    const start = formatTimestamp(range.start);
    const end = formatTimestamp(range.end);
    return `${start} – ${end}`;
  }

  function formatLastUpdated() {
    if (!lastUpdated) return 'Never';
    try {
      return new Date(lastUpdated).toLocaleTimeString();
    } catch (err) {
      return lastUpdated;
    }
  }
</script>

<div class="border rounded-lg overflow-hidden bg-white shadow-sm">
  <header class="px-3 py-2 border-b bg-neutral-50 flex items-center justify-between gap-2">
    <div>
      <strong class="block text-sm">Troubleshooting Log</strong>
      <div class="text-xs text-neutral-500 flex flex-wrap gap-3">
        <span>Last updated: {formatLastUpdated()}</span>
        {#if query}
          <span>Query: <code>{query}</code></span>
        {/if}
        {#if range}
          <span>Range: {formatRange()}</span>
        {/if}
      </div>
    </div>
    <div class="flex items-center gap-2 text-xs">
      <button
        class={`px-3 py-1 border rounded ${isPlaying ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-neutral-300 text-neutral-600 hover:bg-neutral-100'}`}
        type="button"
        on:click={togglePlay}
      >
        {isPlaying ? 'Pause' : 'Play'}
      </button>
      <button
        class="px-3 py-1 border border-neutral-300 rounded text-neutral-600 hover:bg-neutral-100"
        type="button"
        on:click={clearLogs}
      >
        Clear
      </button>
      <button
        class="px-3 py-1 border border-neutral-300 rounded text-neutral-600 hover:bg-neutral-100"
        type="button"
        on:click={downloadLogs}
      >
        Download
      </button>
    </div>
  </header>

  <div class="px-3 py-2 border-b bg-white flex flex-wrap gap-2 text-xs">
    {#if sources.length}
      {#each sources as source}
        <button
          class={`px-3 py-1 border rounded-full transition ${selectedSource === source.id ? 'bg-emerald-100 border-emerald-300 text-emerald-700' : 'border-neutral-200 text-neutral-600 hover:bg-neutral-100'}`}
          type="button"
          on:click={() => selectSource(source.id)}
        >
          {source.label}
        </button>
      {/each}
    {:else}
      <span class="text-neutral-500">No sources configured.</span>
    {/if}
  </div>

  {#if error}
    <div class="px-3 py-2 text-sm text-rose-700 bg-rose-50 border-b border-rose-200">{error}</div>
  {/if}

  {#if isLoading && !entries.length}
    <div class="p-4 text-sm text-neutral-500">Loading logs…</div>
  {:else if entries.length === 0}
    <div class="p-4 text-sm text-neutral-500">No log entries available for the selected source.</div>
  {:else}
    <div class="max-h-[32rem] overflow-y-auto divide-y">
      {#each entries as entry (entry.id)}
        <article class="px-3 py-2 text-sm bg-white">
          <div class="flex items-start justify-between gap-2">
            <div class="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
              <span class="font-medium text-neutral-700">{formatTimestamp(entry.timestamp)}</span>
              <span class={`px-2 py-0.5 rounded-full uppercase tracking-wide ${severityBadgeClass(entry.severity)}`}>
                {severityLabel(entry.severity)}
              </span>
              <span class="text-neutral-500">Host: {entry.source}</span>
              {#if entry.labels.service}
                <span class="text-neutral-500">Service: {entry.labels.service}</span>
              {/if}
              {#if entry.labels.container}
                <span class="text-neutral-500">Container: {entry.labels.container}</span>
              {/if}
              {#if entry.labels.unit}
                <span class="text-neutral-500">Unit: {entry.labels.unit}</span>
              {/if}
            </div>
            {#if isMultiline(entry.message)}
              <button class="text-xs underline" type="button" on:click={() => toggleExpand(entry.id)}>
                {isExpanded(entry.id) ? 'Collapse' : 'Expand'}
              </button>
            {/if}
          </div>
          <pre class="mt-1 text-xs whitespace-pre-wrap bg-neutral-50 border border-neutral-200 rounded p-2">{isExpanded(entry.id) ? entry.message : collapsedMessage(entry.message)}</pre>
        </article>
      {/each}
    </div>
  {/if}
</div>
