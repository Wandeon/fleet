<script lang="ts">
  import { fly } from 'svelte/transition';
  import { toasts, removeToast } from '$lib/stores/app';

  const icons = {
    default: 'ℹ️',
    success: '✅',
    warning: '⚠️',
    error: '⛔️'
  } as const;
</script>

<div class="toast-container" aria-live="polite">
  {#each $toasts as toast (toast.id)}
    <div
      class={`toast ${toast.variant ?? 'default'}`}
      role="status"
      in:fly={{ y: 12, duration: 180 }}
      out:fly={{ y: -12, duration: 140 }}
    >
      <span class="icon" aria-hidden="true">{icons[toast.variant ?? 'default']}</span>
      <div class="message">
        <p>{toast.message}</p>
        {#if toast.actionLabel}
          <button
            type="button"
            class="action"
            on:click={() => {
              toast.action?.();
              removeToast(toast.id);
            }}
          >
            {toast.actionLabel}
          </button>
        {/if}
      </div>
      <button
        type="button"
        class="dismiss"
        aria-label="Dismiss notification"
        on:click={() => removeToast(toast.id)}
      >
        ×
      </button>
    </div>
  {/each}
</div>

<style>
  .toast-container {
    position: fixed;
    bottom: var(--spacing-5);
    right: var(--spacing-5);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    z-index: 2000;
    pointer-events: none;
  }

  .toast {
    pointer-events: auto;
    display: grid;
    grid-template-columns: auto 1fr auto;
    gap: var(--spacing-3);
    align-items: center;
    min-width: 18rem;
    padding: var(--spacing-3);
    border-radius: var(--radius-md);
    border: 1px solid rgba(148, 163, 184, 0.2);
    background: rgba(8, 16, 32, 0.95);
    box-shadow: var(--shadow-md);
  }

  .toast.success {
    border-color: rgba(34, 197, 94, 0.4);
  }

  .toast.warning {
    border-color: rgba(250, 204, 21, 0.45);
  }

  .toast.error {
    border-color: rgba(248, 113, 113, 0.45);
  }

  .icon {
    font-size: 1.2rem;
  }

  .message {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
  }

  .message p {
    margin: 0;
    font-size: var(--font-size-sm);
  }

  .action {
    align-self: flex-start;
    background: none;
    border: none;
    color: var(--color-brand);
    cursor: pointer;
    font-size: var(--font-size-xs);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .action:hover,
  .action:focus-visible {
    text-decoration: underline;
  }

  .dismiss {
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    font-size: 1.25rem;
    line-height: 1;
  }

  .dismiss:hover,
  .dismiss:focus-visible {
    color: var(--color-text);
  }
</style>
