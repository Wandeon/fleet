<script lang="ts">
  import type { PageData } from './$types';
  import { resolve } from '$app/paths';

  export let data: PageData;

  const baseUrl = resolve('/files/api/');
  $: folderSegment = data.folder ? `#/files/${encodeURIComponent(data.folder)}` : '';
  $: iframeSrc = `${baseUrl}${folderSegment}`;
</script>

<div class="files-container">
  <iframe
    src={iframeSrc}
    title="File Browser"
    sandbox="allow-same-origin allow-scripts allow-forms allow-downloads"
  ></iframe>
</div>

<style>
  .files-container {
    width: 100%;
    height: 100%;
    min-height: 600px;
    display: flex;
  }

  iframe {
    width: 100%;
    height: 100%;
    min-height: 600px;
    border: none;
    flex: 1;
  }
</style>
