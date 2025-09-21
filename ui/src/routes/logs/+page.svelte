<script lang="ts">
  import LogConsole from '$lib/components/LogConsole.svelte';
</script>

<div class="space-y-4">
  <header class="space-y-1">
    <h1 class="text-2xl font-semibold">Logs</h1>
    <p class="text-sm text-neutral-500">Inspect device and VPS logs streamed from Loki.</p>
  </header>
  <LogConsole />
</div>
