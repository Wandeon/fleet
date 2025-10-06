<script lang="ts">
  // Zigbee2MQTT UI is proxied by Caddy at /zigbee/
  // This page embeds the external UI in an iframe
  const zigbeeUrl = '/zigbee/';
</script>

<div class="zigbee-container">
  <iframe
    src={zigbeeUrl}
    title="Zigbee2MQTT UI"
    sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-downloads"
  ></iframe>
</div>

<style>
  .zigbee-container {
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
