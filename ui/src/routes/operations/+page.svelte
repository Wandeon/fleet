<script lang="ts">
  import { onMount } from 'svelte';
  import DeviceCard from '$lib/components/DeviceCard.svelte';
  import { apiFetch } from '$lib/api';
  import { deviceStates } from '$lib/stores/deviceStates';
  import { stateToHealth } from '$lib/status';

  type DeviceRecord = {
    id: string;
    name: string;
    kind: string;
    role?: string;
    address?: Record<string, unknown>;
    capabilities?: Record<string, unknown>;
  };

  type NormalizedDevice = DeviceRecord & {
    operations: any[];
    endpoints: any[];
    management: any;
    api?: {
      base_url: string;
      health_url?: string;
      status_url?: string;
      metrics_url?: string;
    } | null;
  };

  let devices: NormalizedDevice[] = [];
  let loading = true;
  let error: string | null = null;

  $: stateMap = $deviceStates;

  function joinUrl(base: string, path?: string) {
    if (!base) return '';
    if (!path) return base;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${normalizedBase}${normalizedPath}`;
  }

  function normalizeDevice(raw: DeviceRecord): NormalizedDevice {
    const capabilities = (raw.capabilities ?? {}) as Record<string, unknown>;
    const operations = Array.isArray((capabilities as any).operations)
      ? ((capabilities as any).operations as any[])
      : [];
    const endpoints = Array.isArray((capabilities as any).endpoints)
      ? ((capabilities as any).endpoints as any[])
      : [];
    const management = (capabilities as any).management ?? null;

    const address = (raw.address ?? {}) as Record<string, unknown>;
    const baseUrl = (address.baseUrl ?? address.base_url) as string | undefined;
    const healthPath = (address.healthPath ?? address.health_path) as string | undefined;
    const statusPath = (address.statusPath ?? address.status_path) as string | undefined;
    const metricsPath = (address.metricsPath ?? address.metrics_path) as string | undefined;

    const api = baseUrl
      ? {
          base_url: baseUrl,
          health_url: joinUrl(baseUrl, healthPath ?? '/healthz'),
          status_url: joinUrl(baseUrl, statusPath ?? '/status'),
          metrics_url: metricsPath ? joinUrl(baseUrl, metricsPath) : undefined,
        }
      : null;

    return {
      ...raw,
      operations,
      endpoints,
      management,
      api,
    };
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
      devices = (devicesJson.devices ?? []).map((device: DeviceRecord) => normalizeDevice(device));
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

  function devicesWithOperations(list: NormalizedDevice[]) {
    return list.filter((device) => Array.isArray(device.operations) && device.operations.length > 0);
  }

  $: actionableDevices = devicesWithOperations(devices);

  $: grouped = (() => {
    const map = new Map<string, NormalizedDevice[]>();
    for (const device of actionableDevices) {
      const list = map.get(device.kind) ?? [];
      list.push(device);
      map.set(device.kind, list);
    }
    return Array.from(map.entries()).map(([kind, entries]) => ({ kind, devices: entries }));
  })();

  function kindLabel(kind: string) {
    if (!kind) return 'Devices';
    return kind.charAt(0).toUpperCase() + kind.slice(1);
  }

  function healthFor(id: string) {
    const state = stateMap?.[id];
    return stateToHealth(state);
  }
</script>

<section class="space-y-4">
  <header class="flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-3xl font-semibold tracking-tight">Device operations</h1>
      <p class="text-sm text-neutral-500">
        Execute control-plane actions defined in <code>inventory/device-interfaces.yaml</code>.
      </p>
    </div>
    <button
      class="px-3 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100"
      type="button"
      on:click={load}
      disabled={loading}
    >
      {loading ? 'Refreshing…' : 'Reload devices'}
    </button>
  </header>

  {#if error}
    <div class="border border-rose-200 bg-rose-50 text-rose-700 rounded-lg p-4">{error}</div>
  {/if}

  {#if loading}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">Loading operations…</div>
  {:else if actionableDevices.length === 0}
    <div class="border rounded-lg bg-white p-4 shadow-sm text-neutral-500">
      No actionable devices yet. Define <code>operations</code> entries in the device registry and rerun the API seed script.
    </div>
  {:else}
    <div class="space-y-6">
      {#each grouped as group}
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h2 class="text-xl font-semibold">{kindLabel(group.kind)} controls</h2>
              <p class="text-sm text-neutral-500">{group.devices.length} device{group.devices.length === 1 ? '' : 's'}</p>
            </div>
          </div>
          <div class="grid gap-4 md:grid-cols-2">
            {#each group.devices as device}
              <DeviceCard {device} healthStatus={healthFor(device.id)} />
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}
</section>
