# UI Alignment Notes for Full Stack Group-Intent Architecture

## New API Endpoints (Available)

### Core Fleet Management
- `GET /api/fleet/layout` - Replaces hardcoded device lists
- `GET /api/fleet/state` - Real-time device state aggregation
- `GET /stream` - Server-sent events for real-time updates

### Group Commands (All Device Types)
- `POST /api/groups/{groupId}/play` - Audio playback
- `POST /api/groups/{groupId}/pause` - Audio pause
- `POST /api/groups/{groupId}/stop` - Audio stop
- `POST /api/groups/{groupId}/volume` - Audio volume control
- `POST /api/groups/{groupId}/power_on` - Video power on
- `POST /api/groups/{groupId}/power_off` - Video power off
- `POST /api/groups/{groupId}/input` - Video input switching
- `POST /api/groups/{groupId}/reboot` - Camera reboot
- `POST /api/groups/{groupId}/probe` - Camera stream probe
- `POST /api/groups/{groupId}/permit_join` - Zigbee permit join
- `POST /api/groups/{groupId}/reset` - Zigbee coordinator reset
- `POST /api/groups/{groupId}/publish` - Zigbee MQTT publish

### Device Status (Kind-Specific Namespaces)
- `GET /api/audio/devices/{id}/status` - Audio device status
- `GET /api/video/devices/{id}/status` - Video device status
- `GET /api/camera/devices/{id}/status` - Camera device status
- `GET /api/zigbee/hubs/{id}/status` - Zigbee coordinator status

## Deprecated Patterns (Remove)

### Hardcoded Device Lists
```javascript
// OLD - Remove these hardcoded arrays
const AUDIO_DEVICES = ['pi-audio-01', 'pi-audio-02'];
const VIDEO_DEVICES = ['pi-video-01'];

// NEW - Use dynamic fleet layout
const { groups, devices } = await fetch('/api/fleet/layout').then(r => r.json());
```

### Direct Device Polling
```javascript
// OLD - Remove manual polling loops
setInterval(() => {
  devices.forEach(device => {
    fetch(`/api/audio/devices/${device.id}/status`);
  });
}, 5000);

// NEW - Use SSE stream for real-time updates
const eventSource = new EventSource('/stream');
eventSource.onmessage = (event) => {
  const update = JSON.parse(event.data);
  // Handle DEVICE_STATE_UPDATE and JOB_UPDATE events
};
```

### Single Device Type Assumptions
```javascript
// OLD - Audio-only UI components
function AudioControls({ devices }) { ... }

// NEW - Multi-device-type components
function DeviceControls({ group }) {
  switch (group.kind) {
    case 'audio': return <AudioControls group={group} />;
    case 'video': return <VideoControls group={group} />;
    case 'camera': return <CameraControls group={group} />;
    case 'zigbee': return <ZigbeeControls group={group} />;
  }
}
```

## Migration Strategy

1. **Phase 1**: Replace hardcoded device lists with `/api/fleet/layout`
2. **Phase 2**: Implement SSE stream for real-time updates
3. **Phase 3**: Add UI components for video, camera, and Zigbee groups
4. **Phase 4**: Remove old polling and hardcoded patterns

## Event Stream Integration

```javascript
// Subscribe to real-time updates
const eventSource = new EventSource('/stream', {
  headers: { 'Authorization': `Bearer ${bearerToken}` }
});

eventSource.addEventListener('message', (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'DEVICE_STATE_UPDATE':
      updateDeviceState(data.deviceId, data.state);
      break;
    case 'JOB_UPDATE':
      updateJobStatus(data.jobId, data.status);
      break;
  }
});
```

## Known Limitations

- **Library Upload**: `/api/library/upload` requires multer dependency
- **Real Device Tokens**: Mock mode works without device network access
- **Authentication**: All endpoints require Bearer token authentication

## Testing in Mock Mode

```bash
# Test new endpoints
curl -H "Authorization: Bearer test-token" http://localhost:3005/api/fleet/layout
curl -H "Authorization: Bearer test-token" http://localhost:3005/api/video/devices/pi-video-01/status
curl -X POST -H "Authorization: Bearer test-token" http://localhost:3005/api/groups/all-displays/power_on
```