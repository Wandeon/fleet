<script lang="ts">
  export let title: string | undefined = undefined;
  export let subtitle: string | undefined = undefined;
  export let padded = true;

  let className = '';
  let restProps: Record<string, unknown> = {};
  $: ({ class: className = '', ...restProps } = $$restProps);

  const hasHeaderSlot = !!$$slots.header;
  const hasFooterSlot = !!$$slots.footer;
  const showHeader = () => Boolean(title || subtitle || hasHeaderSlot);
</script>

<article class={`card ${padded ? 'padded' : ''} ${className}`.trim()} {...restProps}>
  {#if showHeader()}
    <header>
      <div class="heading">
        {#if title}
          <h2>{title}</h2>
        {/if}
        {#if subtitle}
          <p class="subtitle">{subtitle}</p>
        {/if}
      </div>
      <slot name="header" />
    </header>
  {/if}
  <div class={`body ${padded ? 'with-padding' : ''}`}>
    <slot />
  </div>
  {#if hasFooterSlot}
    <footer>
      <slot name="footer" />
    </footer>
  {/if}
</article>

<style>
  article.card {
    background: linear-gradient(180deg, rgba(18, 33, 63, 0.92), rgba(18, 33, 63, 0.82));
    border: 1px solid rgba(148, 163, 184, 0.1);
    border-radius: var(--radius-lg);
    box-shadow: var(--shadow-sm);
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
    min-width: 0;
    position: relative;
    overflow: hidden;
  }

  article.card.padded {
    padding: var(--spacing-4);
  }

  article.card header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--spacing-3);
  }

  .heading h2 {
    margin: 0;
    font-size: var(--font-size-lg);
    letter-spacing: 0.01em;
  }

  .heading .subtitle {
    margin: 0.35rem 0 0;
    color: var(--color-text-muted);
    font-size: var(--font-size-sm);
  }

  .body.with-padding {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  footer {
    margin-top: auto;
    padding-top: var(--spacing-3);
    border-top: 1px solid var(--color-divider);
  }
</style>
