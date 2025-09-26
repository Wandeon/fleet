<script lang="ts">
  import type { ButtonVariant } from './types';

  export let variant: ButtonVariant = 'primary';
  export let loading = false;
  export let type: 'button' | 'submit' | 'reset' = 'button';
  export let fullWidth = false;
  export let disabled = false;

  let className = '';
  let restProps: Record<string, unknown> = {};
  $: ({ class: className = '', ...restProps } = $$restProps);
</script>

<button
  {...restProps}
  {type}
  class={`button ${variant} ${loading ? 'is-loading' : ''} ${fullWidth ? 'full' : ''} ${className}`.trim()}
  disabled={disabled || loading}
  aria-busy={loading}
  data-variant={variant}
>
  {#if loading}
    <span class="spinner" aria-hidden="true"></span>
  {/if}
  <span class="content"><slot /></span>
</button>

<style>
  button.button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: var(--spacing-2);
    padding: 0.5rem 1rem;
    border-radius: var(--radius-md);
    border: 1px solid transparent;
    font-size: var(--font-size-sm);
    font-weight: 600;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition:
      transform var(--transition-fast),
      box-shadow var(--transition-fast),
      background var(--transition-fast);
    background: var(--color-panel);
    color: var(--color-text);
    min-height: 2.5rem;
  }

  button.button.full {
    width: 100%;
  }

  button.button.primary {
    background: linear-gradient(135deg, var(--color-brand-strong), var(--color-brand));
    box-shadow: var(--shadow-sm);
    border-color: transparent;
  }

  button.button.primary:hover:not(:disabled) {
    box-shadow: var(--shadow-md);
    transform: translateY(-1px);
  }

  button.button.secondary {
    background: var(--color-panel-muted);
    border-color: rgba(148, 163, 184, 0.25);
  }

  button.button.secondary:hover:not(:disabled) {
    border-color: rgba(148, 163, 184, 0.4);
  }

  button.button.ghost {
    background: transparent;
    border-color: transparent;
    color: var(--color-text-muted);
  }

  button.button.ghost:hover:not(:disabled) {
    background: rgba(148, 163, 184, 0.1);
    color: var(--color-text);
  }

  button.button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  button.button.is-loading {
    position: relative;
  }

  .spinner {
    width: 1rem;
    height: 1rem;
    border-radius: 999px;
    border: 2px solid rgba(255, 255, 255, 0.2);
    border-top-color: rgba(255, 255, 255, 0.9);
    animation: spin 700ms linear infinite;
  }

  .content {
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-2);
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }

    to {
      transform: rotate(360deg);
    }
  }
</style>
