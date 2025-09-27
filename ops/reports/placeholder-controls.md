# Placeholder Control Audit

| Page | Control | Expected action | Actual result | Priority | Backend |
| --- | --- | --- | --- | --- | --- |
| Audio | Library → “Upload track” primary action in modal | Add the selected audio file into the shared library. | POST `/audio/library` returns 501 “Audio uploads are mocked only in UI,” so no track is added and the modal shows an error. | High | Mock-only response | 
| Camera | Sidebar camera buttons | Switch the active camera feed and preview to the selected device. | `selectCamera` logs `TODO(backlog): implement /camera/active endpoint` and simply reloads the existing overview, leaving the active camera unchanged. | High | Not implemented | 
| Camera | Events list → “Acknowledge” | Mark an event as acknowledged so it disappears from the untriaged list. | The handler warns `TODO(backlog): implement /camera/events/{id}/ack endpoint`, then reloads the overview without mutating the event, so acknowledgements never stick. | Medium | Not implemented | 
| Camera | Live preview → “Refresh preview” | Force a fresh still/stream for the current camera. | Refresh calls `/camera/{id}/refresh`, but the API warns `TODO(backlog): implement …` and falls back to the stale overview, so the preview never updates. | Medium | Not implemented | 
| Zigbee | Toolbar → “Pair Device” | Start discovery mode and return discovered devices. | `startPairing` warns `TODO(backlog): implement zigbee pairing endpoint` and returns an empty placeholder session, so no hardware ever shows up. | High | Not implemented | 
| Zigbee | Toolbar quick action buttons | Send the selected quick action (open/close/etc.) to devices. | `runZigbeeAction` warns `TODO(backlog): implement zigbee action endpoint` and just reloads the overview with no state change. | Medium | Not implemented | 
| Zigbee | Pairing modal → “Pair” | Approve a discovered device and add it to the fleet. | `confirmPairing` warns `TODO(backlog): implement pairing confirm endpoint` and reloads the overview, so the device never appears. | High | Not implemented |

