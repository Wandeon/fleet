# JTBD Coverage – Operator Jobs & Stories

## Audio
- [✅ Supported] **Play a single audio file on a selected device** – [/audio](/audio) — Gap: none; device tiles expose select/play/pause/seek controls and the orchestrator starts the chosen track on selected endpoints.【F:apps/ui/src/lib/modules/AudioModule.svelte†L580-L821】
- [✅ Supported] **Play different tracks on two audio Pis** – [/audio](/audio) — Gap: none; the "Per device" mode lets operators assign distinct tracks per selected device before dispatching playback.【F:apps/ui/src/lib/modules/AudioModule.svelte†L680-L734】
- [✅ Supported] **Create a playlist and play it across multiple devices** – [/audio](/audio) — Gap: none; playlist mode, modal editing, and quick deploy actions cover cross-device playback management.【F:apps/ui/src/lib/modules/AudioModule.svelte†L735-L989】
- [⚠️ Partial] **Sync-check and drift measurement** – [/audio](/audio) — Gap: UI only provides a Re-sync button and last-error pill without exposing drift metrics or nudge controls, and the playback model lacks fields for drift telemetry.【F:apps/ui/src/lib/modules/AudioModule.svelte†L628-L666】【F:apps/ui/src/lib/types.ts†L12-L32】
- [✅ Supported] **Manage library assets** – [/audio](/audio) — Gap: none; operators can upload tracks with metadata, manage playlists, and trigger playback directly from the library.【F:apps/ui/src/lib/modules/AudioModule.svelte†L784-L989】

## Video
- [✅ Supported] **Stream a live video feed to a control station** – [/video](/video) — Gap: none; live preview controls stream playback, latency, input selection, and display power/volume management.【F:apps/ui/src/lib/modules/VideoModule.svelte†L239-L327】
- [✅ Supported] **Review recorded footage with timeline scrubbing** – [/video](/video) — Gap: none; the recording timeline lists segments, enables playback selection, and offers a scrubber with elapsed time feedback.【F:apps/ui/src/lib/modules/VideoModule.svelte†L330-L360】

## Zigbee
- [✅ Supported] **Commission a new Zigbee sensor** – [/zigbee](/zigbee) — Gap: none; pairing workflow provides countdown status, discovery list, and confirmation actions tied to the controller state.【F:apps/ui/src/lib/modules/ZigbeeModule.svelte†L179-L290】
- [❌ Missing] **Configure Zigbee automation rule** – [/zigbee](/zigbee) — Gap: page only lists devices, quick actions, and pairing modal with no rule builder, simulation, or `/zigbee/rules` integrations described in the story.【F:apps/ui/src/lib/modules/ZigbeeModule.svelte†L179-L217】

## Camera (AI)
- [✅ Supported] **View last 24h AI camera detections and open associated video** – [/camera](/camera) — Gap: none; camera panel shows device list, live preview, recent recordings, and event feed with clip launch.【F:apps/ui/src/lib/modules/CameraModule.svelte†L153-L233】
- [❌ Missing] **Configure night mode escalation** – [/settings](/settings) — Gap: settings view covers API access, proxy tuning, device pairing, and operator management but lacks any night mode escalation editor or alert channel configuration.【F:apps/ui/src/routes/settings/+page.svelte†L240-L478】
- [⚠️ Partial] **Acknowledge & archive events** – [/camera](/camera) — Gap: operators can acknowledge events and open clips, but there is no comment box or archive toggle to clear detections from the queue.【F:apps/ui/src/lib/modules/CameraModule.svelte†L235-L283】

## Fleet Management
- [✅ Supported] **View fleet health dashboard** – [/fleet](/fleet) — Gap: none; overview page surfaces fleet totals, module coverage, filters, and device navigation cards.【F:apps/ui/src/routes/fleet/+page.svelte†L57-L170】
- [❌ Missing] **Acknowledge device offline and requeue retry** – [/fleet/:id](/fleet/device-id) — Gap: device detail only renders generic action buttons without acknowledgement notes or retry scheduling workflows for offline incidents.【F:apps/ui/src/routes/fleet/[id]/+page.svelte†L192-L208】
- [❌ Missing] **Deploy firmware update to cohort** – (no UI) — Gap: UI contains no firmware rollout flow; firmware appears only in mock log data with no dedicated page or controls.【374ba0†L1-L3】

## Logs
- [✅ Supported] **Monitor real-time logs with filters** – [/logs](/logs) — Gap: none; live console supports source/severity filters, search, streaming pause, and drill-ins to devices.【F:apps/ui/src/routes/logs/+page.svelte†L16-L136】
- [✅ Supported] **Export filtered logs for audit** – [/logs](/logs) — Gap: none; toolbar exposes filtered TXT/JSON export actions that reuse current stream filters.【F:apps/ui/src/routes/logs/+page.svelte†L16-L120】

## Settings
- [⚠️ Partial] **Manage device pairing and network info** – [/settings](/settings) — Gap: page covers token rotation, proxy endpoint tuning, and pairing lifecycle but lacks network restart/resync controls or per-device connectivity fields noted in the story.【F:apps/ui/src/routes/settings/+page.svelte†L240-L408】
- [✅ Supported] **Configure user access and roles** – [/settings](/settings) — Gap: none; operators table and invite workflow enable role assignment, invitations, and removals inline.【F:apps/ui/src/routes/settings/+page.svelte†L410-L477】
