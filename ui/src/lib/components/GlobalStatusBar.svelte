<script lang="ts">
  export let health: { overall: string, components: Record<string,string> } | null = null;
</script>

<div class="flex gap-3 items-center p-2 rounded-lg border bg-white">
  <span class="text-sm">Overall:</span>
  {#if health}
    <span class="font-semibold">{health.overall}</span>
  {:else}
    <span class="text-neutral-500">loading…</span>
  {/if}
</div>

