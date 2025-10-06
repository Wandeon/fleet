# File & Asset Management

Audio assets and related metadata are managed through the audio control API, fallback storage, and planned library UI. Central operator assets are now managed through the Files tab backed by File Browser. This document outlines storage locations, retention, and deletion workflows.

## Storage locations

- **Audio fallback** – Stored on each Pi under `/data/fallback.mp3` within the `audio_data` volume. Upload via `POST /audio/{id}/upload` (multipart). Health check verifies fallback presence through `/status`.【F:roles/audio-player/40-app.yml†L48-L86】【F:roles/audio-player/README.md†L20-L40】
- **Status/logs** – `audio-player` writes `/data/status.json` and `/data/logs/player.log`; include in log exports when diagnosing playback. `audioctl` CLI prints friendly views of `/status` and `/config`.【F:roles/audio-player/40-app.yml†L24-L46】【F:roles/audio-player/README.md†L1-L40】
- **Central assets** – Operator-managed files are stored in the `fleet-assets` Docker volume (backed by the VPS host). Access via the Files tab at `/files` which proxies to the File Browser service. Files stored here are control-plane only and not automatically synced to devices.【F:infra/vps/compose.fleet.yml†L102-L114】【F:infra/vps/caddy.fleet.Caddyfile†L26-L36】
- **Central registry** – Future playlist/library metadata will live in control plane database (`DATABASE_URL` in `vps/fleet.env`). Ensure migrations capture asset metadata and relationships to devices/playlists.【F:vps/fleet.env.example†L1-L49】

## Upload workflow

### Device fallback uploads
1. Operator selects asset in UI (to be implemented) or uses `scripts/audioctl.sh upload`. Provide valid token and ensure file ≤50 MB (enforced by Multer).【F:apps/api/src/routes/audio.ts†L101-L145】
2. API streams file to device, returns success payload. UI should display new fallback metadata and update status card.
3. For library features, persist asset metadata (title, artist, tags, checksum) in control plane and replicate to devices when assigned.

### Central asset uploads via Files tab
1. Navigate to `/files` in the Fleet UI to access the File Browser interface.
2. Upload assets directly through the browser interface - files are stored in the `fleet-assets` volume on the VPS.
3. Use the file manager to organize, rename, or delete central assets without writing custom code.
4. Note: This feature is control-plane only. Assets must be manually downloaded and uploaded to devices using existing audio upload endpoints if needed for playback.

## Deletion & restore

- **Current behavior**: Fallback upload via `POST /audio/{id}/upload` overwrites `/data/fallback.mp3` on the target device. No version history or backup is maintained on-device. **Operators should maintain external backups** of fallback assets before uploading replacements.
- **Backup recommendation**: Store fallback MP3 files in the central `fleet-assets` volume (via `/files` File Browser) or in version-controlled external storage (S3, NAS) before pushing to devices. This allows recovery if a device fallback needs to be reverted.
- **Future library**: Plan API extension for delete/restore (soft delete with version history) and coordinate with storage quotas. Implement soft delete (trash bin) aligning with UX story: operator can restore or permanently purge assets with audit logging.【F:docs/ux/operator-jobs-and-stories.md†L98-L118】

## Metadata & indexing

- Track attributes such as duration, bitrate, last uploaded timestamp, assigned devices. Use this data to pre-validate playback compatibility and surface warnings (e.g., unsupported codec).
- For playlists, store ordering, loop mode, per-device routing, and sync offsets (<100 ms target).【F:docs/ux/operator-jobs-and-stories.md†L46-L74】

## Retention & backups

- Maintain source assets in a version-controlled storage (S3, NAS) outside device volumes; Git repo should not contain media.
- Schedule periodic verification of fallback file integrity (`ffprobe` or checksum) during acceptance runs to prevent silent corruption.
- Document backup locations and rotation policy once central library implemented.

See [09-audio-operations](./09-audio-operations.md) for playback specifics and [15-error-recovery](./15-error-recovery.md) for post-upload troubleshooting steps.
