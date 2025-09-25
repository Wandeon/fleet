<script lang="ts">
  // eslint-disable-next-line svelte/valid-prop-names-in-kit-pages
  export let error: Error & { message?: string };
  const message = (error?.message ?? '').trim();
</script>

<svelte:head>
  <title>Head Spa Control – Error</title>
</svelte:head>

<main class="error-page" aria-labelledby="error-title">
  <h1 id="error-title">Something went wrong</h1>
  <p>We couldn&apos;t load the requested page. Try refreshing or navigate back to the dashboard.</p>

  {#if message}
    <p class="hint">{message}</p>
  {:else}
    <p class="hint">If the issue persists, share the request ID from the response headers with the ops team.</p>
  {/if}
</main>

<style>
  .error-page {
    max-width: 40rem;
    margin: 6rem auto;
    padding: 2rem;
    border-radius: 1rem;
    background: var(--surface-elevated, #101521);
    color: var(--text-primary, #f1f5ff);
    box-shadow: 0 2rem 4rem rgba(0, 0, 0, 0.2);
    text-align: left;
  }

  h1 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }

  p {
    line-height: 1.6;
    margin-bottom: 1rem;
  }

  .hint {
    margin-top: 1.5rem;
    font-size: 0.95rem;
    color: var(--text-secondary, #c4cbde);
  }
</style>
