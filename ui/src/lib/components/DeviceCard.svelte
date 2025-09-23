<script>
  export let device;
  export let healthStatus = null;

  let sliderValues = {};
  let results = {};
  $: summaryText =
    typeof device?.management === 'string'
      ? device.management
      : typeof device?.management?.summary === 'string'
        ? device.management.summary
        : null;

  $: if (device && device.operations) {
    const defaults = {};
    for (const op of device.operations) {
      if (op.ui?.type === 'slider') {
        const initial = Number(op.ui?.default ?? 0);
        defaults[op.id] = sliderValues[op.id] ?? initial;
      }
    }
    sliderValues = { ...defaults, ...sliderValues };
  }

  function badgeClass(status) {
    switch (status) {
      case 'UP':
        return 'bg-emerald-100 text-emerald-700 border border-emerald-200';
      case 'DEGRADED':
        return 'bg-amber-100 text-amber-800 border border-amber-200';
      case 'DOWN':
        return 'bg-rose-100 text-rose-700 border border-rose-200';
      default:
        return 'bg-neutral-100 text-neutral-600 border border-neutral-200';
    }
  }

  async function runOperation(op, value) {
    const payload = {};
    if (op.ui?.type === 'slider') {
      const key = op.ui?.body_key || 'value';
      if (typeof value === 'number') {
        payload[key] = value;
        sliderValues = { ...sliderValues, [op.id]: value };
      }
    }
    try {
      const response = await fetch(`/api/operations/${device.id}/${op.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      let data = null;
      try {
        data = await response.json();
      } catch (err) {
        data = { ok: response.ok, status: response.status, data: null };
      }
      if (!response.ok) {
        alert(`Operation failed (${response.status})`);
      }
      results = {
        ...results,
        [op.id]: {
          timestamp: new Date().toISOString(),
          response: data,
        },
      };
    } catch (err) {
      alert(`Operation error: ${err instanceof Error ? err.message : err}`);
    }
  }

  function groups() {
    const grouped = {};
    if (!device?.operations) return grouped;
    for (const op of device.operations) {
      const group = op.ui?.group || 'controls';
      grouped[group] = grouped[group] || [];
      grouped[group].push(op);
    }
    return grouped;
  }

  function formatResult(result) {
    if (!result) return '';
    const data = result.response?.data ?? result.response;
    if (typeof data === 'string') return data;
    return JSON.stringify(data, null, 2);
  }
</script>

<div class="bg-white border rounded-xl p-4 space-y-4 shadow-sm">
  <div class="flex items-start justify-between gap-4">
    <div>
      <h2 class="text-lg font-semibold">{device.name}</h2>
      <p class="text-sm text-neutral-500">{device.kind} · {device.role}</p>
      {#if summaryText}
        <p class="text-xs text-neutral-500 mt-1">{summaryText}</p>
      {/if}
    </div>
    <span class={`text-xs px-3 py-1 rounded-full uppercase tracking-wide ${badgeClass(healthStatus)}`}>
      {healthStatus ?? 'UNKNOWN'}
    </span>
  </div>

  {#if Object.keys(groups()).length}
    <div class="space-y-3">
      {#each Object.entries(groups()) as [groupName, ops]}
        <div class="space-y-2">
          <h3 class="text-sm font-semibold text-neutral-600 uppercase tracking-wide">{groupName}</h3>
          <div class="space-y-2">
            {#each ops as op}
              {#if op.ui?.type === 'slider'}
                {@const sliderId = `${device.id}-${op.id}-slider`}
                <div class="flex items-center gap-3">
                  <label class="text-sm w-32" for={sliderId}>{op.label}</label>
                  <input
                    type="range"
                    min={op.ui?.min ?? 0}
                    max={op.ui?.max ?? 1}
                    step={op.ui?.step ?? 0.1}
                    id={sliderId}
                    value={sliderValues[op.id] ?? op.ui?.default ?? 0}
                    on:input={(e) => {
                      const value = Number(e.currentTarget.value);
                      sliderValues = { ...sliderValues, [op.id]: value };
                    }}
                    on:change={(e) => runOperation(op, Number(e.currentTarget.value))}
                  />
                  <span class="text-xs text-neutral-600 w-10">{Number(sliderValues[op.id] ?? op.ui?.default ?? 0).toFixed(2)}</span>
                </div>
              {:else}
                <button
                  class="px-3 py-2 border rounded text-sm hover:bg-neutral-50"
                  on:click={() => runOperation(op)}
                >
                  {op.label}
                </button>
              {/if}
            {/each}
          </div>
        </div>
      {/each}
    </div>
  {/if}

  {#if Object.keys(results).length}
    <div class="space-y-2">
      <h3 class="text-sm font-semibold text-neutral-600 uppercase tracking-wide">Last Responses</h3>
      {#each Object.entries(results) as [opId, result]}
        <div class="border rounded-lg p-2 bg-neutral-50">
          <div class="flex justify-between text-xs text-neutral-500">
            <span>{device.operations.find((op) => op.id === opId)?.label ?? opId}</span>
            <span>{result.timestamp}</span>
          </div>
          <pre class="text-xs whitespace-pre-wrap mt-1">{formatResult(result)}</pre>
        </div>
      {/each}
    </div>
  {/if}

  <div class="space-y-1">
    <h3 class="text-sm font-semibold text-neutral-600 uppercase tracking-wide">Key Endpoints</h3>
    <ul class="text-xs text-neutral-600 space-y-1">
      {#if device.api?.base_url}
        <li><span class="font-medium text-neutral-700">API Base:</span> <code>{device.api.base_url}</code></li>
      {/if}
      {#if device.api?.health_url}
        <li><span class="font-medium text-neutral-700">Health:</span> <code>{device.api.health_url}</code></li>
      {/if}
      {#if device.api?.status_url}
        <li><span class="font-medium text-neutral-700">Status:</span> <code>{device.api.status_url}</code></li>
      {/if}
      {#if device.api?.metrics_url}
        <li><span class="font-medium text-neutral-700">Metrics:</span> <code>{device.api.metrics_url}</code></li>
      {/if}
      {#if device.endpoints?.length}
        {#each device.endpoints as endpoint}
          <li><span class="font-medium text-neutral-700">{endpoint.label}:</span> <code>{endpoint.url}</code></li>
        {/each}
      {/if}
    </ul>
  </div>
</div>
