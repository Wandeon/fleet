<script lang="ts">
  export let data: Record<string, unknown>;
</script>

<div class="console-layout">
  <slot />
</div>

<style>
  .console-layout {
    min-height: 100%;
    display: flex;
    flex-direction: column;
    padding: 1.5rem clamp(1rem, 2vw, 2.5rem);
    background: var(--surface-default, #0d1117);
    color: var(--text-primary, #f0f6fc);
  }
</style>
