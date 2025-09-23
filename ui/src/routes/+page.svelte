<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import { stateToHealth, formatIso } from '$lib/status';

  type Device = {
    id: string;
    name: string;
    kind: string;
    role?: string;
    capabilities?: Record<string, unknown>;
  };

  let devices: Device[] = [];
  let loading = true;
  let error: string | null = null;
  let lastUpdated: string | null = null;

  $: stateMap = $deviceStates;
  $: jobMap = $jobs;

  function normalizeDevices(raw: Device[]): Device[] {
    return raw.map((device) => ({
      ...device,
      capabilities: device.capabilities ?? {},
    }));
  }

  function statusFor(deviceId: string) {
    const state = stateMap?.[deviceId];
    return stateToHealth(state);
  }

  function kindLabel(kind: string) {
    if (!kind) return 'Devices';
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  function operationsCount(device: Device) {
    const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
    const list = Array.isArray((capabilities as any).operations)
      ? ((capabilities as any).operations as any[])
      : [];
    return list.length;
  }

  function endpointsCount(device: Device) {
    const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
    const list = Array.isArray((capabilities as any).endpoints)
      ? ((capabilities as any).endpoints as any[])
      : [];
    return list.length;
  }

  function managementSummary(device: Device) {
    const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
    const management = (capabilities as any).management;
    if (typeof management === 'string') return management;
    if (management && typeof management === 'object') {
      const summary = (management as any).summary;
      if (typeof summary === 'string' && summary.trim().length) {
        return summary;
      }
    }
    return null;
  }

  async function load() {
    loading = true;
    error = null;
    try {
      const [devicesRes, statesRes] = await Promise.all([
        apiFetch('/devices'),
        apiFetch('/device_states'),
      ]);
      if (!devicesRes.ok) throw new Error(`Failed to load devices (${devicesRes.status})`);
      if (!statesRes.ok) throw new Error(`Failed to load device states (${statesRes.status})`);

      const devicesJson = await devicesRes.json();
      const statesJson = await statesRes.json();
      devices = normalizeDevices(devicesJson.devices ?? []);
      const map = Object.fromEntries(
        (statesJson.states ?? []).map((entry: any) => [entry.deviceId, entry]),
      );
      deviceStates.set(map);
      lastUpdated = new Date().toISOString();
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
  });

  function summaryCounts() {
    const counts = { total: devices.length, up: 0, degraded: 0, down: 0, unknown: 0 };
    for (const device of devices) {
      const status = statusFor(device.id);
      if (status === 'UP') counts.up += 1;
      else if (status === 'DEGRADED') counts.degraded += 1;
      else if (status === 'DOWN') counts.down += 1;
      else counts.unknown += 1;
    }
    return counts;
  }

  $: summary = summaryCounts();

  $: grouped = (() => {
    const map = new Map<string, Device[]>();
    for (const device of devices) {
      const list = map.get(device.kind) ?? [];
      list.push(device);
      map.set(device.kind, list);
    }
    return Array.from(map.entries()).map(([kind, entries]) => ({ kind, devices: entries }));
  })();

  $: jobSummary = (() => {
    const values = Object.values(jobMap ?? {});
    const running = values.filter((job) => job.status === 'running').length;
    const pending = values.filter((job) => job.status === 'pending').length;
    const failed = values.filter((job) => job.status === 'failed').length;
    return { running, pending, failed, total: values.length };
  })();
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Operations overview</h1>
      <p class="text-sm text-neutral-500">
        Watch live device health, active jobs, and quick stats before drilling into controls.
      </p>
    </div>
    <div class="flex items-center gap-2 text-sm">
      <button
        class="px-3 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100"
        type="button"
        on:click={load}
        disabled={loading}
      >
        {loading ? 'Refreshing…' : 'Refresh now'}
      </button>
      <span class="text-neutral-400">
        Last sync: {lastUpdated ? formatIso(lastUpdated) : '—'}
      </span>
    </div>
  </header>

  {#if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4">{error}</div>
  {/if}

  <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <div class="text-xs text-neutral-500">Total devices</div>
      <div class="text-3xl font-semibold">{summary.total}</div>
      <div class="text-xs text-neutral-400 mt-1">{summary.unknown} awaiting first poll</div>
    </div>
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <div class="text-xs text-emerald-600">Healthy</div>
      <div class="text-3xl font-semibold text-emerald-700">{summary.up}</div>
      <div class="text-xs text-neutral-400 mt-1">Devices reporting online</div>
    </div>
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <div class="text-xs text-amber-600">Degraded</div>
      <div class="text-3xl font-semibold text-amber-700">{summary.degraded}</div>
      <div class="text-xs text-neutral-400 mt-1">Requires follow-up checks</div>
    </div>
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <div class="text-xs text-rose-600">Down</div>
      <div class="text-3xl font-semibold text-rose-700">{summary.down}</div>
      <div class="text-xs text-neutral-400 mt-1">Offline or unresponsive</div>
    </div>
  </div>

  <div class="grid gap-4 md:grid-cols-2">
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-2">Live command queue</h2>
      <div class="grid grid-cols-3 gap-3 text-center">
        <div>
          <div class="text-2xl font-semibold text-emerald-700">{jobSummary.running}</div>
          <div class="text-xs text-neutral-500">Running</div>
        </div>
        <div>
          <div class="text-2xl font-semibold text-neutral-700">{jobSummary.pending}</div>
          <div class="text-xs text-neutral-500">Pending</div>
        </div>
        <div>
          <div class="text-2xl font-semibold text-rose-700">{jobSummary.failed}</div>
          <div class="text-xs text-neutral-500">Failed</div>
        </div>
      </div>
      <p class="text-xs text-neutral-400 mt-3">
        The queue updates in real time. Use the Operations view to resend or inspect responses.
      </p>
    </div>
    <div class="bg-white border rounded-xl p-4 shadow-sm">
      <h2 class="text-lg font-semibold mb-2">Quick links</h2>
      <ul class="space-y-2 text-sm">
        <li>
          <a class="flex items-center gap-2 text-emerald-700 hover:underline" href="/operations">
            <span class="font-medium">Execute device operations</span>
            <span class="text-xs text-neutral-500">Audio, video, and camera controls</span>
          </a>
        </li>
        <li>
          <a class="flex items-center gap-2 text-neutral-700 hover:underline" href="/logs">
            <span class="font-medium">Troubleshoot with logs</span>
            <span class="text-xs text-neutral-500">Loki-backed viewer with download support</span>
          </a>
        </li>
        <li>
          <a class="flex items-center gap-2 text-neutral-700 hover:underline" href="/about">
            <span class="font-medium">Deployment notes</span>
            <span class="text-xs text-neutral-500">API configuration & build info</span>
          </a>
        </li>
      </ul>
    </div>
  </div>
</section>

<section class="space-y-4">
  <h2 class="text-2xl font-semibold tracking-tight">Fleet by capability</h2>
  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">Loading devices…</div>
  {:else if devices.length === 0}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">
      No devices registered yet. Seed <code>inventory/device-interfaces.yaml</code> and rerun the API seed script.
    </div>
  {:else}
    <div class="space-y-6">
      {#each grouped as group}
        <div class="space-y-3">
          <header class="flex items-center justify-between">
            <div>
              <h3 class="text-xl font-semibold">{kindLabel(group.kind)}</h3>
              <p class="text-sm text-neutral-500">{group.devices.length} device{group.devices.length === 1 ? '' : 's'}</p>
            </div>
          </header>
          <div class="grid gap-4 md:grid-cols-2">
            {#each group.devices as device}
              {@const state = stateMap?.[device.id]}
              {@const health = statusFor(device.id)}
              {@const summaryText = managementSummary(device)}
              <article class="bg-white border rounded-xl p-4 shadow-sm space-y-3">
                <div class="flex items-start justify-between gap-3">
                  <div>
                    <h4 class="text-lg font-semibold">{device.name}</h4>
                    <p class="text-xs text-neutral-500 uppercase tracking-wide">{device.role ?? device.kind}</p>
                  </div>
                  <span
                    class={`text-xs px-3 py-1 rounded-full uppercase tracking-wide ${
                      health === 'UP'
                        ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                        : health === 'DEGRADED'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : health === 'DOWN'
                            ? 'bg-rose-100 text-rose-700 border border-rose-200'
                            : 'bg-neutral-100 text-neutral-600 border border-neutral-200'
                    }`}
                  >
                    {health}
                  </span>
                </div>
                {#if summaryText}
                  <p class="text-sm text-neutral-600">{summaryText}</p>
                {/if}
                <dl class="grid grid-cols-2 gap-2 text-xs text-neutral-500">
                  <div>
                    <dt class="font-medium text-neutral-600">Last updated</dt>
                    <dd>{state?.updatedAt ? formatIso(state.updatedAt) : '—'}</dd>
                  </div>
                  <div>
                    <dt class="font-medium text-neutral-600">Last seen</dt>
                    <dd>{state?.lastSeen ? formatIso(state.lastSeen) : '—'}</dd>
                  </div>
                  <div>
                    <dt class="font-medium text-neutral-600">Operations</dt>
                    <dd>{operationsCount(device)}</dd>
                  </div>
                  <div>
                    <dt class="font-medium text-neutral-600">Endpoints</dt>
                    <dd>{endpointsCount(device)}</dd>
                  </div>
                </dl>
                <div class="flex gap-2 text-sm">
                  <a class="px-3 py-2 border rounded-lg hover:bg-neutral-100" href={`/operations?device=${device.id}`}>
                    Open controls
                  </a>
                  <a class="px-3 py-2 border rounded-lg hover:bg-neutral-100" href={`/logs?source=${device.id}`}>
                    View logs
                  </a>
                </div>
              </article>
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
