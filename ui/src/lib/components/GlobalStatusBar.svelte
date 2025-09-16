<script>
  export let health = null;

  $: statusCounts = (() => {
    const counts = { UP: 0, DEGRADED: 0, DOWN: 0, UNKNOWN: 0 };
    if (!health || !health.components) return counts;
    for (const status of Object.values(health.components)) {
      if (status in counts) counts[status] += 1;
      else counts.UNKNOWN += 1;
    }
    return counts;
  })();

  function badgeClass(overall) {
    switch (overall) {
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
</script>

<div class="flex flex-wrap gap-4 items-center p-3 rounded-lg border bg-white shadow-sm">
  <div class={`text-xs px-3 py-1 rounded-full uppercase tracking-wide ${badgeClass(health?.overall)}`}>
    Overall: {health?.overall ?? 'LOADING'}
  </div>
  <div class="flex gap-3 text-xs text-neutral-600">
    <span>Up: {statusCounts.UP}</span>
    <span>Degraded: {statusCounts.DEGRADED}</span>
    <span>Down: {statusCounts.DOWN}</span>
  </div>
  {#if health?.timestamp}
    <span class="text-xs text-neutral-400">Updated {new Date(health.timestamp).toLocaleTimeString()}</span>
  {/if}
</div>

