<script lang="ts">
  import type { SkeletonVariant } from './types';
  export let variant: SkeletonVariant = 'block';
  export let width = '100%';
  export let height: string | undefined = undefined;
  export let rounded = true;

  $: computedHeight = height ?? (variant === 'line' ? '0.75rem' : '6rem');
</script>

<div
  class={`skeleton ${variant} ${rounded ? 'rounded' : ''}`}
  style={`width:${width};height:${computedHeight};`}
  aria-hidden="true"
></div>

<style>
  .skeleton {
    background: linear-gradient(
      90deg,
      rgba(148, 163, 184, 0.15) 0%,
      rgba(148, 163, 184, 0.3) 50%,
      rgba(148, 163, 184, 0.15) 100%
    );
    background-size: 200% 100%;
    animation: shimmer 1.4s ease-in-out infinite;
  }

  .skeleton.rounded {
    border-radius: var(--radius-md);
  }

  .skeleton.line {
    height: 0.8rem;
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }
</style>
