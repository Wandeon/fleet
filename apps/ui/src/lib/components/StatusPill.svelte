<script lang="ts">
  import type { StatusLevel } from './types';
  export let status: StatusLevel = 'ok';
  export let label: string | undefined = undefined;

  const statusCopy: Record<StatusLevel, string> = {
    ok: 'Online',
    warn: 'Degraded',
    error: 'Fault',
    offline: 'Offline'
  };
</script>

<span class={`status ${status}`} data-status={status} role="status" aria-live="polite">
  <span class="dot" aria-hidden="true"></span>
  <span class="text">{label ?? statusCopy[status]}</span>
</span>

<style>
  .status {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    padding: 0.25rem 0.6rem;
    border-radius: 999px;
    font-size: var(--font-size-xs);
    font-weight: 600;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    background: rgba(148, 163, 184, 0.14);
    color: var(--color-text-muted);
  }

  .status.ok {
    background: var(--color-success-soft);
    color: var(--color-success);
  }

  .status.warn {
    background: var(--color-warning-soft);
    color: var(--color-warning);
  }

  .status.error {
    background: var(--color-error-soft);
    color: var(--color-error);
  }

  .status.offline {
    background: rgba(71, 85, 105, 0.18);
    color: var(--color-offline);
  }

  .dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: currentColor;
  }

  .status.warn .dot {
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.35;
    }
    100% {
      opacity: 1;
    }
  }
</style>
