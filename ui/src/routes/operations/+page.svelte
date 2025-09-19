<script lang="ts">
  import { onMount } from 'svelte';
  import { deviceStates, jobs } from '$lib/stores/deviceStates';
  import {
    loadSelected,
    rememberSelected,
    loadTvSource,
    rememberTvSource,
  } from '$lib/api';

  type Device = {
    id: string;
    name: string;
    kind: string;
    capabilities?: Record<string, any>;
    managed?: boolean;
  };

  let devices: Device[] = [];
  let loading = true;
  let error: string | null = null;
  let selectedIds: string[] = [];
  let tvDefaults: Record<string, string> = {};
  let fallbackSource = 'hdmi1';
  let lastJobForDevice: Record<string, string | null> = {};

  onMount(async () => {
    selectedIds = loadSelected();
    const defaultSource = loadTvSource();
    fallbackSource = defaultSource;
    try {
      const [devicesRes, statesRes] = await Promise.all([
        fetch('/api/devices'),
        fetch('/api/device_states'),
      ]);
      if (!devicesRes.ok) throw new Error(`Failed to load devices (${devicesRes.status})`);
      if (!statesRes.ok) throw new Error(`Failed to load states (${statesRes.status})`);
      const devicesJson = await devicesRes.json();
      const statesJson = await statesRes.json();
      devices = devicesJson.devices ?? [];
      const map = Object.fromEntries(
        (statesJson.states ?? []).map((state: any) => [state.deviceId, state]),
      );
      deviceStates.set(map);
      const inputs: Record<string, string> = {};
      for (const device of devices) {
        const state = map[device.id]?.state ?? {};
        inputs[device.id] = state.source || state.tv?.source || defaultSource;
      }
      tvDefaults = inputs;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  });

  function toggleSelection(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((x) => x !== id);
    } else {
      selectedIds = [...selectedIds, id];
    }
    rememberSelected(selectedIds);
  }

  function selectedClass(id: string) {
    return selectedIds.includes(id) ? 'ring-2 ring-emerald-400' : '';
  }

  async function sendCommand(deviceId: string, action: 'power_on' | 'power_off' | 'input', body?: any) {
    try {
      const response = await fetch(`/api/video/devices/${deviceId}/tv/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : null,
      });
      const data = await response.json();
      if (!response.ok || !data?.accepted) {
        throw new Error(data?.error || `Command failed (${response.status})`);
      }
      lastJobForDevice = { ...lastJobForDevice, [deviceId]: data.job_id };
    } catch (err) {
      console.error('Command error', err);
      lastJobForDevice = { ...lastJobForDevice, [deviceId]: null };
    }
  }

  function jobStatus(deviceId: string) {
    const jobId = lastJobForDevice[deviceId];
    if (!jobId) return 'Idle';
    const job = $jobs[jobId];
    if (!job) return 'Accepted…';
    if (job.status === 'failed') return job.error ? `Failed: ${job.error}` : 'Failed';
    if (job.status === 'succeeded') return 'Succeeded';
    return job.status.charAt(0).toUpperCase() + job.status.slice(1);
  }

  function deviceState(deviceId: string) {
    return $deviceStates[deviceId];
  }

  function statusBadge(state: any) {
    const status = state?.status ?? 'unknown';
    const lookup: Record<string, string> = {
      online: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
      offline: 'bg-rose-100 text-rose-700 border border-rose-200',
      degraded: 'bg-amber-100 text-amber-800 border border-amber-200',
    };
    return lookup[status] || 'bg-neutral-100 text-neutral-600 border border-neutral-200';
  }

  function formatUpdated(state: any) {
    if (!state?.updatedAt) return 'never';
    return new Date(state.updatedAt).toLocaleString();
  }

  function inputsFor(device: Device) {
    const fromCapabilities = device.capabilities?.tv?.inputs;
    if (Array.isArray(fromCapabilities) && fromCapabilities.length) {
      return fromCapabilities;
    }
    return ['hdmi1', 'hdmi2', 'chromecast'];
  }

  function handleInputChange(deviceId: string, event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    tvDefaults = { ...tvDefaults, [deviceId]: value };
    rememberTvSource(value);
    sendCommand(deviceId, 'input', { source: value });
  }
</script>

<div class="space-y-6">
  <header class="flex items-center justify-between">
    <div>
      <h1 class="text-2xl font-semibold">Video devices</h1>
      <p class="text-sm text-neutral-500">Commands fan out instantly; status updates stream in live.</p>
    </div>
    <div class="text-sm text-neutral-500">
      Selected devices are remembered per browser.
    </div>
  </header>

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm">Loading…</div>
  {:else if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4 shadow-sm">{error}</div>
  {:else if devices.length === 0}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
      No devices registered. Seed <code>config/device-interfaces.yaml</code> and rerun the worker.
    </div>
  {:else}
    {@const videoDevices = devices.filter((device) => device.kind === 'video')}
    {#if videoDevices.length === 0}
      <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-600">
        No video devices found. Confirm <code>kind: "video"</code> in your seed data.
      </div>
    {:else}
      <div class="grid gap-4 md:grid-cols-2">
        {#each videoDevices as device}
          {@const state = deviceState(device.id)}
          <article class={`bg-white border rounded-lg p-4 shadow-sm space-y-3 ${selectedClass(device.id)}`}>
          <div class="flex items-start justify-between gap-3">
            <div>
              <h2 class="text-lg font-semibold">{device.name}</h2>
              <p class="text-sm text-neutral-500">{device.kind}</p>
            </div>
            <button
              class={`text-xs px-3 py-1 border rounded-full uppercase tracking-wide ${statusBadge(state)}`}
              type="button"
            >
              {state?.status ?? 'unknown'}
            </button>
          </div>

          <div class="flex items-center justify-between text-xs text-neutral-500">
            <span>Last updated: {formatUpdated(state)}</span>
            <button
              class={`text-xs px-2 py-1 border rounded ${selectedIds.includes(device.id) ? 'bg-emerald-100 border-emerald-300' : 'border-neutral-200'}`}
              type="button"
              on:click={() => toggleSelection(device.id)}
            >
              {selectedIds.includes(device.id) ? 'Selected' : 'Select'}
            </button>
          </div>

          <div class="flex flex-wrap gap-2">
            <button
              class="px-3 py-2 text-sm border rounded hover:bg-emerald-50"
              type="button"
              on:click={() => sendCommand(device.id, 'power_on')}
            >
              Power on
            </button>
            <button
              class="px-3 py-2 text-sm border rounded hover:bg-rose-50"
              type="button"
              on:click={() => sendCommand(device.id, 'power_off')}
            >
              Power off
            </button>
            <div class="flex items-center gap-2 text-sm">
              <label for={`input-${device.id}`}>Input</label>
              <select
                id={`input-${device.id}`}
                class="border rounded px-2 py-1 text-sm"
                value={tvDefaults[device.id] ?? fallbackSource}
                on:change={(event) => handleInputChange(device.id, event)}
              >
                {#each inputsFor(device) as option}
                  <option value={option}>{option}</option>
                {/each}
              </select>
            </div>
          </div>

          <div class="text-xs text-neutral-500">
            Job status: {jobStatus(device.id)}
          </div>

          {#if state?.state?.snapshot}
            <div class="bg-neutral-50 border rounded p-2 text-xs text-neutral-600 whitespace-pre-wrap">
              {JSON.stringify(state.state.snapshot, null, 2)}
            </div>
          {/if}
        </article>
      {/each}
      </div>
    {/if}
  {/if}
</div>
