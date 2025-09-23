<script lang="ts">
  import { onMount } from 'svelte';
  import { apiFetch } from '$lib/api';
  import { deviceStates } from '$lib/stores/deviceStates';
  import { stateToHealth, formatIso } from '$lib/status';

  type Device = {
    id: string;
    name: string;
    kind: string;
    role?: string;
    address?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
  };

  let devices: Device[] = [];
  let loading = true;
  let error: string | null = null;

  $: stateMap = $deviceStates;

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
      devices = devicesJson.devices ?? [];
      const map = Object.fromEntries(
        (statesJson.states ?? []).map((state: any) => [state.deviceId, state]),
      );
      deviceStates.set(map);
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    load();
  });

  function statusFor(deviceId: string) {
    const state = stateMap?.[deviceId];
    return stateToHealth(state);
  }

  function stateStatus(deviceId: string) {
    return stateMap?.[deviceId]?.status ?? 'unknown';
  }

  function operationsCount(device: Device) {
    const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
    return Array.isArray((capabilities as any).operations) ? (capabilities as any).operations.length : 0;
  }

  function endpointsCount(device: Device) {
    const capabilities = (device.capabilities ?? {}) as Record<string, unknown>;
    return Array.isArray((capabilities as any).endpoints) ? (capabilities as any).endpoints.length : 0;
  }
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Device registry</h1>
      <p class="text-sm text-neutral-500">
        Live view of seeded devices, their last reported status, and available operations.
      </p>
    </div>
    <button
      class="px-3 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100"
      type="button"
      on:click={load}
      disabled={loading}
    >
      {loading ? 'Refreshing…' : 'Reload'}
    </button>
  </header>

  {#if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4">{error}</div>
  {/if}

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">Loading devices…</div>
  {:else if devices.length === 0}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">
      No devices found. Update <code>inventory/devices.yaml</code> and re-run the seed script.
    </div>
  {:else}
    <div class="overflow-x-auto">
      <table class="min-w-full text-sm">
        <thead class="text-xs uppercase text-neutral-500 bg-neutral-100">
          <tr>
            <th class="px-4 py-2 text-left">Device</th>
            <th class="px-4 py-2 text-left">Kind</th>
            <th class="px-4 py-2 text-left">Role</th>
            <th class="px-4 py-2 text-left">Status</th>
            <th class="px-4 py-2 text-left">Updated</th>
            <th class="px-4 py-2 text-left">Last seen</th>
            <th class="px-4 py-2 text-left">Operations</th>
            <th class="px-4 py-2 text-left">Endpoints</th>
          </tr>
        </thead>
        <tbody class="divide-y">
          {#each devices as device}
            {@const state = stateMap?.[device.id]}
            {@const health = statusFor(device.id)}
            <tr class="bg-white hover:bg-neutral-50">
              <td class="px-4 py-3">
                <div class="font-medium text-neutral-800">{device.name}</div>
                <div class="text-xs text-neutral-500">{device.id}</div>
              </td>
              <td class="px-4 py-3 text-neutral-600">{device.kind}</td>
              <td class="px-4 py-3 text-neutral-600">{device.role ?? '—'}</td>
              <td class="px-4 py-3">
                <span
                  class={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium uppercase tracking-wide ${
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
                <div class="text-xs text-neutral-400 mt-1">{stateStatus(device.id)}</div>
              </td>
              <td class="px-4 py-3 text-neutral-600">{state?.updatedAt ? formatIso(state.updatedAt) : '—'}</td>
              <td class="px-4 py-3 text-neutral-600">{state?.lastSeen ? formatIso(state.lastSeen) : '—'}</td>
              <td class="px-4 py-3 text-neutral-600">{operationsCount(device)}</td>
              <td class="px-4 py-3 text-neutral-600">{endpointsCount(device)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</section>
