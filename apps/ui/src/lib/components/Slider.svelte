<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let value = 0;
  export let min = 0;
  export let max = 100;
  export let step = 1;
  export let label: string | undefined = undefined;
  export let displayValue = true;
  export let unit: string | undefined = undefined;
  export let disabled = false;
  export let id: string | undefined = undefined;

  const dispatch = createEventDispatcher<{ change: number; input: number }>();
  const generatedId =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `slider-${Math.random().toString(36).slice(2, 9)}`;

  $: inputId = id ?? generatedId;
  $: clampedValue = Math.min(max, Math.max(min, value));

  const handleInput = (event: Event) => {
    const next = Number((event.target as HTMLInputElement).value);
    value = next;
    dispatch('input', next);
    dispatch('change', next);
  };
</script>

<div class={`slider ${disabled ? 'disabled' : ''}`}>
  {#if label}
    <label for={inputId}>
      <span>{label}</span>
      {#if displayValue}
        <strong aria-live="polite">{Math.round(clampedValue)}{unit}</strong>
      {/if}
    </label>
  {/if}
  <input
    id={inputId}
    type="range"
    min={min}
    max={max}
    step={step}
    value={clampedValue}
    on:input={handleInput}
    disabled={disabled}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={Math.round(clampedValue)}
    aria-valuetext={unit ? `${Math.round(clampedValue)} ${unit}` : undefined}
  />
</div>

<style>
  .slider {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-2);
  }

  .slider label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--font-size-sm);
    color: var(--color-text-muted);
  }

  .slider label strong {
    font-size: var(--font-size-sm);
    color: var(--color-text);
  }

  input[type='range'] {
    appearance: none;
    height: 0.6rem;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, var(--color-brand) 0%, rgba(56, 189, 248, 0.35) 100%);
    outline: none;
  }

  input[type='range']::-webkit-slider-thumb {
    appearance: none;
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--color-surface-elevated);
    border: 2px solid var(--color-brand);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35);
    transition: transform var(--transition-fast);
  }

  input[type='range']::-moz-range-thumb {
    width: 1.1rem;
    height: 1.1rem;
    border-radius: 50%;
    background: var(--color-surface-elevated);
    border: 2px solid var(--color-brand);
    box-shadow: 0 0 0 2px rgba(56, 189, 248, 0.35);
    transition: transform var(--transition-fast);
  }

  input[type='range']:focus-visible::-webkit-slider-thumb,
  input[type='range']:active::-webkit-slider-thumb,
  input[type='range']:focus-visible::-moz-range-thumb,
  input[type='range']:active::-moz-range-thumb {
    transform: scale(1.05);
  }

  .slider.disabled {
    opacity: 0.6;
  }
</style>
