<script lang="ts">
  // File Browser embedded in iframe to preserve app navigation
</script>

<div class="files-container">
  <iframe
    src="/files/api/"
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
