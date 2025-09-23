<script lang="ts">
  export let title: string;
  export let description: string;
</script>

<div class="empty-state" role="status">
  <div class="icon" aria-hidden="true">
    <slot name="icon">📭</slot>
  </div>
  <h3>{title}</h3>
  <p>{description}</p>
  <slot name="action" />
</div>

<style>
  .empty-state {
    text-align: center;
    border: 1px dashed rgba(148, 163, 184, 0.3);
    border-radius: var(--radius-md);
    padding: var(--spacing-5) var(--spacing-4);
    display: grid;
    gap: var(--spacing-3);
    justify-items: center;
    background: rgba(15, 23, 42, 0.35);
  }

  .icon {
    font-size: 2.25rem;
  }

  h3 {
    margin: 0;
    font-size: var(--font-size-lg);
  }

  p {
    margin: 0;
    max-width: 32ch;
    color: var(--color-text-muted);
  }
</style>
