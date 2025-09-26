# Operator Jobs & Stories

This document enumerates the primary operator goals for the fleet control surfaces. Each story records the expected context, UI controls, success criteria, and edge considerations that engineering will fulfill.

## Audio

### Story: Play a single audio file on a selected device
- **Goal:** Play a specific audio asset on an individual device on demand.
- **Actor:** Fleet operator with playback permissions.
- **Preconditions:** Operator is authenticated, device is online and associated with the account, audio file exists in the library.
- **Steps / Expected Controls:** Select device from fleet list → open file picker → choose file → click “play on device”. UI shows device panel with play/pause, seek bar, and volume slider.
- **Success Criteria:** API call `POST /device/:id/play` returns 202/200 and UI shows playing state within 2 seconds with elapsed/remaining time updating.
- **Failure Modes:** Device offline, file unsupported, playback command rejected. UI surfaces toast with actionable retry or diagnostics.
- **Security Considerations:** Enforce RBAC for playback commands; audit log contains operator, device, and asset identifiers.
- **Status:** ✅ Implemented (Phase D1). UI now issues `/ui/audio/devices/{id}` commands via the generated OpenAPI client, shows busy states while awaiting D1 confirmation, and renders inline error banners on rejection.
- **D1 Notes:** Seek, pause, resume, stop, and master volume controls all return refreshed snapshots so the tile stays in sync with backend telemetry.

### Story: Play different tracks on two audio Pis
- **Goal:** Stage unique tracks on multiple audio devices without conflict.
- **Actor:** Operations specialist orchestrating zone-specific music.
- **Preconditions:** Both devices are online; required files uploaded; operator has zone-level permissions.
- **Expected Controls:** Multi-select devices → assign track per device via modal → optional schedule start time.
- **Success Criteria:** Separate `/device/:id/play` commands succeed for each target. UI displays independent playback cards with correct track metadata.
- **Failure Modes:** Resource contention (device busy), missing assets, network timeout. Provide per-device error banners and option to queue retry.
- **Security Considerations:** Validate that operator cannot control devices outside assigned groups; encrypt asset paths in transit.
- **Status:** ✅ Implemented (Phase D1). “Per device” mode packages assignments into a single `/ui/audio/playback` request with `syncMode=independent`, and validation prevents missing track mappings before dispatch.
- **D1 Notes:** The orchestrator keeps device selections sticky, supports resume/loop toggles, and surfaces toast feedback from the D1 API.

### Story: Create a playlist and play it across multiple devices (same track or different)
- **Goal:** Arrange a playlist and deploy it across multiple audio endpoints with optional sync.
- **Actor:** Audio curator.
- **Preconditions:** Library populated, devices online, operator granted playlist management rights.
- **Steps / Expected Controls:** Create playlist → add files → select devices (checkbox) → choose play mode (independent / synced / grouped) → start. Provide scheduling, loop toggles, per-device volume, and per-track routing controls.
- **Success Criteria:** Playlist starts and UI shows per-device playback position; if “synced” selected, per-device drift under 100 ms with sync indicator.
- **Failure Modes:** Sync negotiation fails, missing devices mid-playback, playlist validation errors. UI flags drift beyond threshold and offers re-sync.
- **Security Considerations:** Playlist modifications logged; enforce write permissions; protect sync tokens.
- **Status:** ✅ Implemented (Phase D1). Playlist CRUD flows call `/ui/audio/playlists` endpoints directly and refresh lists without page reloads.
- **D1 Notes:** Operators can deploy playlists across cohorts with loop/resume controls, and sync group badges render on device tiles for quick validation.

### Story: Sync-check and drift measurement
- **Goal:** Verify synchronization state and correct drift across the fleet.
- **Actor:** Reliability engineer.
- **Preconditions:** Sync-capable devices online and part of group playback session.
- **Expected Controls:** Display last sync timestamp, measured delay to master (ms), and controls to re-sync or nudge (temporary playback speed adjustments).
- **Success Criteria:** Drift metrics update in real time; re-sync command produces confirmation within 5 seconds.
- **Failure Modes:** Device fails to report clock, re-sync command rejected. UI highlights device in error with remediation tips.
- **Security Considerations:** Ensure diagnostics endpoints are read-only for view-only roles; protect nudge commands behind elevated permissions.
- **Status:** ✅ Implemented (Phase D1). Device tiles expose drift alerts from `playback.lastError` and provide a “Re-sync” button that replays the active source through `/ui/audio/playback` with `syncMode=synced`.
- **D1 Notes:** Toasts confirm both successful and failed re-sync attempts, and sync group identifiers remain visible beside each device.
- **D2 Notes:** The UI now records drift reports through `/ui/audio/playback/sessions/{sessionId}/sync`, keeping the session list (`/ui/audio/playback/sessions`) fresh without reloading.

### Story: Manage library assets
- **Goal:** Maintain audio assets and metadata for deployment.
- **Actor:** Content manager.
- **Preconditions:** Operator authenticated with library management role.
- **Expected Controls:** Upload flow with metadata form (title, artist, tags), library assignment, soft delete with trash bin, playlist reorder drag handles, import/export actions.
- **Success Criteria:** Upload API returns 201 with asset ID; UI reflects metadata instantly and playlists reorder without full refresh.
- **Failure Modes:** Upload fails (size, format), metadata validation errors, conflicting edits. Present inline form errors and rollback partial uploads.
- **Security Considerations:** Virus scan uploads; permission gate delete/restore; audit asset changes.
- **Status:** ✅ Implemented (Phase D1). The upload modal now posts multipart payloads to `/ui/audio/library` with inline validation and error handling.
- **D1 Notes:** Newly uploaded tracks appear immediately in the library table and can be slotted into playlists without refreshing the page.
- **D2 Notes:** Upload registration now begins with `/ui/audio/library/uploads` so the UI can request signed parameters before streaming large assets, and playlist drag handles persist order via `/ui/audio/playlists/{id}/reorder`.

## Video

### Story: Stream a live video feed to a control station
- **Goal:** View real-time feed from a selected video device with minimal latency.
- **Actor:** Security operator.
- **Preconditions:** Device registered with streaming endpoint, operator on secure network segment, video codecs supported by browser.
- **Expected Controls:** Device dropdown, quality selector, play/pause, screenshot capture, fullscreen toggle.
- **Success Criteria:** Player initializes <3 seconds, maintains <500 ms latency, and surfaces resolution/bitrate telemetry.
- **Failure Modes:** Stream unavailable, network congestion, codec mismatch. Provide reconnect options and diagnostics overlay.
- **Security Considerations:** Enforce TLS, tokenized stream URLs, hide stream URLs from DOM inspection where possible.

### Story: Review recorded footage with timeline scrubbing
- **Goal:** Investigate recorded video events with precise timeline control.
- **Actor:** Incident responder.
- **Preconditions:** Recording retention available for device, operator has incident review permissions.
- **Expected Controls:** Calendar/date picker, timeline scrubber with markers, playback speed options, export clip button.
- **Success Criteria:** Fetch of `/video/:id/recordings` returns segments; scrubbing updates playback within 1 second; exports produce downloadable file.
- **Failure Modes:** Missing segments, expired retention, export failure. UI shows gap indicators and error notifications.
- **Security Considerations:** Restrict exports to authorized roles; watermark downloads; log access events.
- **D2 Notes:** Operators can stage preview sessions on demand with `/ui/video/preview`, adjust TV state via `/ui/video/devices/{id}/power`, `/mute`, `/input`, and export clips through `/ui/video/recordings/{recordingId}/export` with real-time status toasts.

## Zigbee

### Story: Commission a new Zigbee sensor
- **Goal:** Pair a new Zigbee sensor with the fleet hub and verify telemetry.
- **Actor:** Field technician.
- **Preconditions:** Technician on-site with pairing code; hub online in commissioning mode.
- **Expected Controls:** “Add device” wizard requesting sensor type, ID, pairing key; status indicator for pairing progress.
- **Success Criteria:** Hub pairing API returns success; sensor appears in device list with healthy telemetry within 30 seconds.
- **Failure Modes:** Pairing timeout, invalid key, firmware mismatch. Provide retry instructions and link to troubleshooting guide.
- **Security Considerations:** Rotate pairing keys post-onboarding; limit commissioning rights; record device provenance.

### Story: Configure Zigbee automation rule
- **Goal:** Define a rule linking sensor events to actuator responses.
- **Actor:** Automation engineer.
- **Preconditions:** Relevant sensors/actuators online; user has automation edit rights.
- **Expected Controls:** Rule builder with trigger selection, condition editors, action selection, enable toggle.
- **Success Criteria:** Rule saves via `/zigbee/rules` API; simulation test returns expected actuator preview.
- **Failure Modes:** Invalid conditions, conflicting rules, offline actuators. UI highlights conflicts and offers resolution suggestions.
- **Security Considerations:** Validate rule scopes; prevent privilege escalation through actuator selection; audit rule changes.
- **D2 Notes:** The pairing wizard now coordinates with `/ui/zigbee/pairing` lifecycle endpoints and polls `/ui/zigbee/pairing/discovered`, while rule validation POSTs to `/ui/zigbee/rules/validate` before persisting.

## Camera (AI)

### Story: View last 24h AI camera detections and open associated video
- **Goal:** Triage camera events and inspect associated video evidence.
- **Actor:** Security analyst.
- **Preconditions:** AI detections generated and stored; user has camera review permissions.
- **Expected Controls:** Event feed listing detections with timestamp, thumbnail, confidence, location, optional video clip; filter by confidence, device, tag.
- **Success Criteria:** Feed loads last 24h within 2 seconds; selecting event opens video modal at detection timestamp.
- **Failure Modes:** Missing clip, stale metadata, network errors. UI surfaces fallback image, offers retry, and logs issue.
- **Security Considerations:** Obfuscate PII in thumbnails; restrict event data export; audit all event views.

### Story: Configure night mode escalation
- **Goal:** Adjust detection handling during night mode windows.
- **Actor:** Security operations lead.
- **Preconditions:** Night mode schedules defined; integrations (Slack, email) configured.
- **Expected Controls:** Schedule editor, escalation channel selection, toggle for alert severity, acknowledgement workflow.
- **Success Criteria:** Night mode rule updates propagate to AI pipeline; escalated events route to alert channel with metadata.
- **Failure Modes:** Integration failure, overlapping schedules, missing permissions. UI flags integration health and prevents invalid overlaps.
- **Security Considerations:** Secure webhooks with signatures; restrict access to escalation settings; log acknowledgements.

### Story: Acknowledge & archive events
- **Goal:** Confirm review of events and remove them from active queue.
- **Actor:** Monitoring specialist.
- **Preconditions:** Event feed accessible; operator has acknowledgement rights.
- **Expected Controls:** Bulk select events, acknowledge button with comment box, archive toggle, search.
- **Success Criteria:** Acknowledge API returns 200; events leave active queue and appear in archive with reviewer stamp.
- **Failure Modes:** Concurrent updates, permission errors. Provide optimistic UI with rollback if API fails.
- **Security Considerations:** Require comment for high severity events; store audit trail.

## Fleet Management

### Story: View fleet health dashboard
- **Goal:** Understand overall device status at a glance.
- **Actor:** Fleet manager.
- **Preconditions:** Telemetry aggregator operational; operator has dashboard access.
- **Expected Controls:** Status widgets (online/offline counts), alerts panel, map/list toggle, maintenance window indicator.
- **Success Criteria:** Dashboard data refreshes every 30 seconds; alerts link to device details.
- **Failure Modes:** Telemetry lag, permissions revoked, data source offline. Display stale data warnings and fallback message.
- **Security Considerations:** Restrict sensitive metadata; enforce least privilege on alert acknowledgements.

### Story: Acknowledge device offline and requeue retry
- **Goal:** Track incident response for offline devices and schedule reconnect attempts.
- **Actor:** Support engineer.
- **Preconditions:** Device flagged offline; operator in incident response role.
- **Expected Controls:** Device alert banner, “acknowledge” action with note, “requeue retry” scheduling modal.
- **Success Criteria:** Acknowledgement recorded with timestamp and user; retry job enqueued and visible in activity log.
- **Failure Modes:** Device returns online mid-process, job scheduler failure, API timeout. UI updates status gracefully and reports scheduler issues.
- **Security Considerations:** Prevent unauthorized retry scheduling; log acknowledgements and changes.

### Story: Deploy firmware update to cohort
- **Goal:** Roll out firmware updates safely to selected devices.
- **Actor:** Release engineer.
- **Preconditions:** Firmware artifact uploaded; devices meet prerequisites; maintenance window set.
- **Expected Controls:** Cohort selection, staged rollout sliders, progress tracker, rollback button.
- **Success Criteria:** Update job dispatches with confirmation; progress updates streamed; rollback command available while rollout active.
- **Failure Modes:** Version incompatibility, download failure, battery threshold low. UI halts rollout and reports affected devices.
- **Security Considerations:** Verify artifact signatures; restrict firmware actions to trusted roles; log version changes.

## Logs

### Story: Monitor real-time logs with filters
- **Goal:** Observe live log stream with the ability to isolate noise.
- **Actor:** Support engineer.
- **Preconditions:** Log ingestion service connected; operator has log viewing permissions.
- **Expected Controls:** Streaming log table showing last 1000 entries, level filters (error/warn/info), search by device or correlation ID, pause stream toggle.
- **Success Criteria:** Stream updates within 1 second; filters apply instantly; selecting log entry opens context pane with related metadata and link to device page.
- **Failure Modes:** Stream disconnects, filter syntax errors. Provide reconnection prompt and filter validation messages.
- **Security Considerations:** Mask sensitive fields; respect data retention policies; restrict export.

### Story: Export filtered logs for audit
- **Goal:** Provide auditors with scoped log data.
- **Actor:** Compliance officer.
- **Preconditions:** Saved filters defined; export permissions granted.
- **Expected Controls:** Export button (CSV/JSON), date range selector, anonymization toggle.
- **Success Criteria:** Export job returns download link; data matches current filters.
- **Failure Modes:** Large export timeouts, anonymization conflicts. UI shows progress indicator and warnings.
- **Security Considerations:** Require MFA for export; encrypt files at rest; log download events.

## Settings

### Story: Manage device pairing and network info
- **Goal:** Configure device connectivity parameters.
- **Actor:** Network administrator.
- **Preconditions:** Operator authenticated with admin role; devices reachable.
- **Expected Controls:** Device pairing wizard, token rotation controls, network configuration forms, restart/resync buttons.
- **Success Criteria:** Pairing updates succeed; token rotation API returns 200; network changes apply with confirmation.
- **Failure Modes:** Invalid network settings, token rotation failure, device unreachable. UI validates inputs and provides rollback instructions.
- **Security Considerations:** Mask sensitive fields; enforce confirmation dialogs; audit network changes.

### Story: Configure user access and roles
- **Goal:** Manage operator permissions for the platform.
- **Actor:** System administrator.
- **Preconditions:** Admin authenticated; role definitions available.
- **Expected Controls:** User list, role assignment dropdowns, invitation workflow, audit log view.
- **Success Criteria:** Permission changes propagate immediately; invitations send email with activation link.
- **Failure Modes:** Duplicate invitations, role conflicts, directory sync failures. UI surfaces errors and suggests corrective actions.
- **Security Considerations:** Enforce least privilege; require MFA for role elevation; track changes in immutable audit log.

