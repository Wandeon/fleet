<script lang="ts">
  import { onMount } from 'svelte';

  let iframeHeight = '100%';

  onMount(() => {
    // Calculate iframe height to fill available space
    const updateHeight = () => {
      const header = document.querySelector('.top-bar');
      const nav = document.querySelector('.primary-nav');
      const headerHeight = (header?.clientHeight || 0) + (nav?.clientHeight || 0);
      iframeHeight = `calc(100vh - ${headerHeight}px)`;
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);

    return () => {
      window.removeEventListener('resize', updateHeight);
    };
  });
</script>

<div class="files-container">
  <iframe
    src="/files/api/"
    title="File Browser"
    style="height: {iframeHeight}"
    sandbox="allow-same-origin allow-scripts allow-forms allow-downloads"
  ></iframe>
</div>

<style>
  .files-container {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 1;
  }

  iframe {
    width: 100%;
    border: none;
    display: block;
  }
</style>
