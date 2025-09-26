# Firmware & Updates

Firmware updates are coordinated through GitOps role changes and planned orchestration jobs. This document captures current practices and future enhancements.

## Current state

- **Audio Pis** – Firmware primarily handled via Raspberry Pi OS updates; HiFiBerry overlay configured in `/boot/firmware/config.txt`. Use `docs/runbooks/provisioning.md` for initial setup and rely on OS-level package management for security updates. Reboot after applying kernel/firmware changes and rerun `role-agent.sh`.【F:docs/runbooks/audio.md†L31-L75】
- **HDMI/Zigbee node** – Zigbee coordinator firmware managed externally; ensure ConBee firmware updates happen during maintenance windows. After flashing, confirm `/dev/serial/by-id/...` remains stable and rerun Zigbee reset script. Document new firmware version in device detail notes.【F:roles/hdmi-media/README.md†L78-L146】
- **Camera** – Use `libcamera` updates via apt or container rebuilds. Adjust `CAMERA_*` env values after firmware changes affecting exposure/bitrate. Validate stream via `/probe` endpoint post-update.【F:roles/camera/README.md†L1-L40】

## Planned orchestration

UX stories call for firmware rollout workflows: select cohort, stage rollout, monitor progress, support rollback.【F:docs/ux/operator-jobs-and-stories.md†L328-L348】 Planned steps:

1. Build API endpoint to enqueue firmware jobs (`/devices/{id}/jobs/firmware`) processed by worker. Jobs should log `command.pending/succeeded/failed` events for `/health/events/recent`.
2. Store firmware metadata (version, checksum, compatible hardware) in control-plane database.
3. UI to present cohort selection, progress tracker, rollback button. Persist operator notes and require elevated permissions.
4. Implement health checks verifying new firmware (e.g., version endpoint on device) and rollback automatically if acceptance script fails.

## Safety guidelines

- Always capture current firmware version before upgrades (store in device detail record).
- Schedule maintenance windows and ensure acceptance tests cover affected modules (audio playback, Zigbee connectivity, camera streams).
- Maintain firmware artifacts in secure storage with checksums; consider signing firmware packages for integrity.
- Update Alertmanager escalation to notify Slack on firmware failures so support responds quickly.【F:infra/vps/README.md†L75-L115】

## Post-update validation

1. Run `scripts/acceptance.sh` for audio; extend with Zigbee/camera checks as automation matures.
2. Inspect `/health/events/recent` for `command.failed` entries.
3. Review logs for `errorCode` anomalies (`GIT_FETCH`, `STREAM_DOWN`, etc.) and revert if necessary.
4. Document outcome in runbooks and update [25-future-roadmap](./25-future-roadmap.md) with follow-up tasks.
