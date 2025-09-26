# Audio Daily Ops Quick Start

This quick start summarizes the core daily workflows now powered by the D1 audio control plane.

## Prerequisites

- Operator authenticated with playback or curator permissions.
- Target devices reporting online status in the Audio module.
- Library tracks or playlists prepared (uploads now persist through `/ui/audio/library`).

## Single Device Playback

1. Open the **Audio** module and locate the desired device tile.
2. Click **Select** on the tile, then trigger playback from the library row (**Play on selected**) or via the orchestrator.
3. Use the tile controls to **Pause**, **Play**, **Stop**, **Seek**, and adjust **Volume**. Each action calls `/ui/audio/devices/{id}/…` and updates the tile with the returned snapshot.
4. Master gain changes are available through the **Master mix** slider (`POST /ui/audio/master-volume`).

## Multi-Device Coordination

1. Select multiple device tiles.
2. In **Orchestrate playback**, choose one of:
   - **Single track** – Deploys the same track across the cohort.
   - **Per device** – Assign different tracks via the inline selectors; validation ensures no device is left empty.
   - **Playlist** – Choose an existing playlist or create a new one on the fly.
3. Pick the desired **Sync mode** (`independent`, `grouped`, or `synced`) and toggle **Resume**/**Loop** if needed.
4. Press **Start playback** to issue a single `/ui/audio/playback` request.

## Playlist Management

- **Create / edit** playlists with the modal launched from **New playlist**. The UI now persists changes via `/ui/audio/playlists` and refreshes without a page reload.
- Assign newly uploaded tracks immediately—library entries hydrate in the orchestrator and playlist modal after every upload.

## Drift Monitoring & Re-sync

- Devices participating in sync groups surface their identifier beside the tile along with any drift alerts (`playback.lastError`).
- Use the **Re-sync** button to reissue the active source with `syncMode=synced` for the affected device. Toast banners confirm success or provide actionable errors when the backend rejects the command.

## Uploading Tracks

- Use **Upload track** to send audio assets directly to `/ui/audio/library`.
- Provide title, artist, and optional tags; validation runs client-side before the request is submitted.
- Newly uploaded assets appear instantly in the library table and can be inserted into playlists without refreshing the page.

Keep the browser console open during early rollouts—any 4xx/5xx responses are surfaced as UI toasts, but the console retains the raw payload for deeper troubleshooting.
