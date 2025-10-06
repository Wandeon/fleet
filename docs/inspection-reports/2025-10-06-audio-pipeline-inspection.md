# Audio Pipeline End-to-End Inspection Report

**Date**: 2025-10-06
**Inspector**: VPS Guy (Claude Code)
**Correlation ID Prefix**: `inspect-175976xxxx`
**Purpose**: Pre-UI wiring validation of all audio pipeline components

## Executive Summary

This report documents the operational state of the audio streaming infrastructure ahead of UI control wiring. All major components are functional on **VPS-01** (not VPS-02 as documentation claims), but several configuration gaps and documentation inconsistencies were identified that must be addressed before UI integration.

### ✅ Working Components
- Icecast server streaming at 128kbps MP3
- Liquidsoap source feeding Icecast from music library
- Both audio Pi devices (pi-audio-01, pi-audio-02) online and reporting metrics
- Fleet API health and audio device endpoints responding with auth
- Prometheus scraping device metrics successfully
- Control plane bearer authentication functional

### ⚠️ Issues Identified
1. **CRITICAL**: Audio device `stream_url` configurations are incomplete/incorrect
2. **CRITICAL**: Documentation incorrectly states Icecast/Liquidsoap run on VPS-02 (they run on VPS-01)
3. **MEDIUM**: Control plane API `/audio/{id}` individual device endpoint returns 404
4. **LOW**: No fallback files present on audio devices (fallback_exists=false)

---

## 1. Topology Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ VPS-01 (app.headspamartina.hr)                              │
│                                                               │
│  ┌──────────────┐    ┌──────────────┐                        │
│  │  Liquidsoap  │───▶│   Icecast    │                        │
│  │  (playlist)  │    │  :8000       │                        │
│  │  Port: 1234  │    │  /fleet.mp3  │                        │
│  └──────────────┘    └──────┬───────┘                        │
│                              │                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐   │
│  │  Fleet UI    │◀───│  Caddy       │───▶│  Fleet API   │   │
│  │  :3006       │    │  :80/443     │    │  :3005       │   │
│  └──────────────┘    └──────────────┘    └──────┬───────┘   │
│                                                   │            │
└───────────────────────────────────────────────────┼───────────┘
                                                    │
        ┌───────────────────────────────────────────┴───────────────┐
        │                                                             │
        │  Tailscale Network (100.64.0.0/10)                         │
        │                                                             │
        ▼                                                             ▼
┌───────────────────┐                                   ┌───────────────────┐
│  pi-audio-01      │                                   │  pi-audio-02      │
│  100.127.65.25    │                                   │  100.122.210.53   │
│  Port: 8081       │                                   │  Port: 8081       │
│  HiFiBerry DAC    │                                   │  HiFiBerry DAC    │
│  Status: online   │                                   │  Status: online   │
└───────────────────┘                                   └───────────────────┘
        │                                                             │
        └─────────────────────────┬───────────────────────────────── │
                                  │                                   │
                                  ▼                                   ▼
                          Icecast Stream URL                  Icecast Stream URL
                       ❌ http://:8000/            ❌ http://fleet-vps:8000/
                       ✅ SHOULD BE: http://icecast:8000/fleet.mp3
```

---

## 2. Endpoint Matrix

### Control Plane Endpoints (VPS-01, via Caddy @ app.headspamartina.hr)

| Component | Endpoint | Method | Auth | Request | Response Shape | HTTP Status | Latency (ms) | Notes |
|-----------|----------|---------|------|---------|----------------|-------------|--------------|-------|
| Fleet API | `/api/healthz` | GET | ❌ None | - | `{status, uptime, timestamp}` | 200 OK | 6.8 | Liveness probe |
| Fleet API | `/api/readyz` | GET | ❌ None | - | `{status, devices, lastLoadedAt}` | 200 OK | 2.8 | Registry loaded, 4 devices |
| Fleet API | `/api/health/summary` | GET | ✅ Bearer | `X-Correlation-Id` header | `{modules: [{module, total, online, devices: [{id, status}]}], updatedAt}` | 200 OK | ~15 | Audio devices probed actively; video/camera marked "unknown" |
| Fleet API | `/api/health/events/recent` | GET | ✅ Bearer | Query: `?limit=5` | `{events: [], count: 0}` | 200 OK | ~10 | No recent events in memory bus |
| Fleet API | `/api/audio/devices` | GET | ✅ Bearer | `X-Correlation-Id` header | `{devices: [{id, name, status, group, volumePercent, capabilities, playback, lastUpdated, lastError, timeline}], total}` | 200 OK | ~20 | Returns full device list with playback state and event timeline |
| Fleet API | `/api/audio/{id}` | GET | ✅ Bearer | - | `Cannot GET /audio/{id}` (HTML error page) | **404** | - | ❌ **MISSING ENDPOINT** - docs claim this exists |
| Fleet API | `/api/audio/{id}/config` | GET | ✅ Bearer | - | ❌ Returns 404 HTML | **404** | - | ❌ **MISSING ENDPOINT** |
| Fleet API | `/api/audio/{id}/play` | POST | ✅ Bearer | `{source: "stream"\|"file"}` | ❓ Not tested (would require write operation) | - | - | Reserved for Step 2 testing |
| Fleet API | `/api/audio/{id}/stop` | POST | ✅ Bearer | - | ❓ Not tested | - | - | Reserved for Step 2 testing |
| Fleet API | `/api/audio/{id}/volume` | POST | ✅ Bearer | `{volume: 0.0-2.0}` | ❓ Not tested | - | - | Reserved for Step 2 testing |
| Fleet API | `/api/audio/{id}/upload` | POST | ✅ Bearer | Multipart form (50MB limit) | ❓ Not tested | - | - | Reserved for Step 2 testing |

**Auth Details**:
- Bearer token: `API_BEARER` from `/home/admin/fleet/vps/fleet.env` (present and valid: `3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc`)
- Unauthorized requests return `401` with `{code: "unauthorized", message: "Invalid Authorization header format", correlationId}`
- Correlation IDs are echoed in responses when provided

### Device Endpoints (Audio Pis, via Tailscale)

| Device | Endpoint | Method | Auth | Request | Response Shape | HTTP Status | Latency (ms) | Notes |
|--------|----------|---------|------|---------|----------------|-------------|--------------|-------|
| pi-audio-01 (100.127.65.25:8081) | `/healthz` | GET | ❌ None | - | Plain text: `ok` | 200 OK | <5 | Liveness probe for Prometheus |
| pi-audio-01 | `/status` | GET | ✅ Bearer | - | `{fallback_active, fallback_exists, last_switch_timestamp, mode, now_playing, requested_source, source, stream_up, stream_url, volume}` | 200 OK | ~10 | ❌ **stream_url: "http://:8000/"** (INCOMPLETE) |
| pi-audio-01 | `/config` | GET | ✅ Bearer | - | `{mode, source, stream_url, volume}` | 200 OK | ~10 | Same incomplete stream_url |
| pi-audio-01 | `/metrics` | GET | ❌ None | - | Prometheus exposition format | 200 OK | <5 | Exports `audio_stream_up`, `audio_fallback_active`, etc. |
| pi-audio-02 (100.122.210.53:8081) | `/healthz` | GET | ❌ None | - | Plain text: `ok` | 200 OK | <5 | Healthy |
| pi-audio-02 | `/status` | GET | ✅ Bearer | - | (same schema as pi-audio-01) | 200 OK | ~10 | ❌ **stream_url: "http://fleet-vps:8000/"** (MISSING MOUNT) |
| pi-audio-02 | `/config` | GET | ✅ Bearer | - | (same schema) | 200 OK | ~10 | Same issue |
| pi-audio-02 | `/metrics` | GET | ❌ None | - | Prometheus metrics | 200 OK | <5 | Exporting successfully |

**Auth Details**:
- `AUDIO_PI_AUDIO_01_TOKEN`: `7d12cb8f5efe204d31923be1befaf5540a5b700ba8f026f3a3e5b8eba7d8245a` (from vps/fleet.env)
- `AUDIO_PI_AUDIO_02_TOKEN`: `fecd3a1a94ee2b0fb3dd1fc3653eadae6bebf3da854fbd4961e3c9ac3735c619`
- Both tokens are valid and accepted by device control APIs

### Icecast Server (VPS-01, container)

| Endpoint | Method | Auth | Response | HTTP Status | Notes |
|----------|---------|------|----------|-------------|-------|
| `http://localhost:8000/status-json.xsl` | GET | ❌ None | JSON status object with active mounts, listener count, stream metadata | 200 OK | Mount: `/fleet.mp3` streaming 128kbps MP3, 0 current listeners, stream started 2025-10-04T07:03:16Z |
| `http://icecast:8000/fleet.mp3` | GET (stream) | ❌ None | MP3 audio stream | 200 OK | Internal network access for Pi devices; requires correct full URL |

**Icecast Configuration** (from `/home/admin/fleet/infra/vps/icecast.env`):
- `ICECAST_SOURCE_PASSWORD`: `supersecret`
- `ICECAST_ADMIN_PASSWORD`: `supersecretadmin`
- `ICECAST_LOCATION`: "My VPS"
- `ICECAST_HOSTNAME`: "stream.example.com"
- Mount metadata: "Soothing Melodies - Beautiful Relaxing Music..." (updated via Liquidsoap)

---

## 3. Configuration Truth Table

| Configuration Item | Expected Value (per docs) | Observed Value | Status | Location |
|--------------------|---------------------------|----------------|--------|----------|
| **VPS Deployment Location** | VPS-02 | **VPS-01** | ❌ DOCS WRONG | Multiple docs reference VPS-02 incorrectly |
| **Icecast Host** | VPS-02 | VPS-01, container `icecast` | ❌ DOCS WRONG | `infra/vps/compose.liquidsoap.yml` |
| **Liquidsoap Host** | VPS-02 | VPS-01, container `liquidsoap` | ❌ DOCS WRONG | `infra/vps/compose.liquidsoap.yml` |
| **Icecast Mount Point** | `/fleet.mp3` | ✅ `/fleet.mp3` | ✅ CORRECT | Confirmed via `/status-json.xsl` |
| **Icecast Stream URL (full)** | `http://icecast:8000/fleet.mp3` | ✅ `http://icecast:8000/fleet.mp3` | ✅ CORRECT | Liquidsoap config & Icecast status |
| **API_BEARER (control plane)** | (must be set) | ✅ `3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc` | ✅ PRESENT | `/home/admin/fleet/vps/fleet.env` |
| **AUDIO_PI_AUDIO_01_TOKEN** | (must be set) | ✅ `7d12cb8f5efe204d31923be1befaf5540a5b700ba8f026f3a3e5b8eba7d8245a` | ✅ PRESENT | `vps/fleet.env` |
| **AUDIO_PI_AUDIO_02_TOKEN** | (must be set) | ✅ `fecd3a1a94ee2b0fb3dd1fc3653eadae6bebf3da854fbd4961e3c9ac3735c619` | ✅ PRESENT | `vps/fleet.env` |
| **pi-audio-01 stream_url** | `http://icecast:8000/fleet.mp3` | ❌ `http://:8000/` | ❌ **INCOMPLETE** | Device `/config` endpoint |
| **pi-audio-02 stream_url** | `http://icecast:8000/fleet.mp3` | ❌ `http://fleet-vps:8000/` | ❌ **MISSING MOUNT** | Device `/config` endpoint |
| **pi-audio-01 playback mode** | `auto` or `manual` | `manual` | ⚠️ MANUAL | Device status shows manual mode, source=stream |
| **pi-audio-02 playback mode** | `auto` or `manual` | `manual` | ⚠️ MANUAL | Device status shows manual mode, source=stream |
| **pi-audio-01 fallback file** | (optional) | ❌ `fallback_exists: false` | ⚠️ MISSING | No fallback.mp3 uploaded |
| **pi-audio-02 fallback file** | (optional) | ❌ `fallback_exists: false` | ⚠️ MISSING | No fallback.mp3 uploaded |

---

## 4. Operational Signals

### Prometheus Metrics

**Scrape Targets**:
```json
{
  "job": "audio-player",
  "instance": "pi-audio-01",
  "health": "up",
  "lastScrape": "2025-10-06T15:36:04.223Z"
}
{
  "job": "audio-player",
  "instance": "pi-audio-02",
  "health": "up",
  "lastScrape": "2025-10-06T15:36:07.289Z"
}
```

**Key Metrics** (timestamp: 2025-10-06T15:36:13Z):

| Metric | Device | Value | Interpretation |
|--------|--------|-------|----------------|
| `audio_stream_up` | pi-audio-01 | 1 | ✅ Stream playback active |
| `audio_stream_up` | pi-audio-02 | 1 | ✅ Stream playback active |
| `audio_fallback_active` | pi-audio-01 | 0 | No fallback in use |
| `audio_fallback_active` | pi-audio-02 | 0 | No fallback in use |
| `audio_fallback_exists` | pi-audio-01 | 0 | ⚠️ No fallback file uploaded |
| `audio_fallback_exists` | pi-audio-02 | 0 | ⚠️ No fallback file uploaded |
| `audio_volume` | pi-audio-01 | 1.0 | 100% software volume |
| `audio_volume` | pi-audio-02 | 1.0 | 100% software volume |
| `audio_mode_state{mode="manual"}` | pi-audio-01 | 1 | Manual mode active |
| `audio_mode_state{mode="manual"}` | pi-audio-02 | 1 | Manual mode active |

**Circuit Breaker / Upstream Failures**: No upstream_device_failures_total metrics observed during inspection (no failures during probe window).

### Loki Logs

- **Fleet API logs**: Loki queries returned parsing errors; log ingestion may be partial or query syntax issues exist. This requires further investigation outside inspection scope.
- **Device logs**: Not directly probed via Loki (would require device Promtail shipping confirmation).

### Correlation ID Tracing

Used correlation ID prefix `inspect-175976xxxx` in all API probes. Fleet API endpoints successfully echo correlation IDs in responses. Device APIs do not currently echo correlation IDs (this is expected per device API design).

---

## 5. Gaps & Risks

### Critical Gaps Blocking UI Wiring

1. **Audio device stream URLs are misconfigured**
   - **Risk**: Devices cannot reliably play stream if URL is incomplete or incorrect
   - **Current**: pi-audio-01 has `http://:8000/`, pi-audio-02 has `http://fleet-vps:8000/` (missing `/fleet.mp3` mount)
   - **Expected**: Both should have `http://icecast:8000/fleet.mp3`
   - **Remediation**: Update device configs via `/config` PUT endpoint or device-side environment variables
   - **Blocker**: ⚠️ MEDIUM - devices report stream_up=1, so they may be using cached/fallback config, but this will fail on restart

2. **Control plane `/audio/{id}` endpoint missing**
   - **Risk**: UI cannot fetch individual device detail; must parse `/audio/devices` list
   - **Current**: Returns 404 HTML error page
   - **Expected**: Per docs (04-api-surface.md line 23), should return single device payload
   - **Remediation**: Either implement endpoint or update docs/UI to use list endpoint only
   - **Blocker**: 🟡 LOW - UI can work around by filtering `/audio/devices` response

3. **Documentation claims VPS-02 hosts Icecast/Liquidsoap**
   - **Risk**: Operator confusion, incorrect troubleshooting, wrong SSH targets
   - **Current**: All services run on VPS-01
   - **Expected**: Docs should state VPS-01
   - **Remediation**: Update docs (09-audio-operations.md, 02-deployment-and-networks.md)
   - **Blocker**: 🟡 DOCS ONLY - does not block UI wiring but causes operational confusion

### Medium Priority Gaps

4. **No fallback files uploaded to devices**
   - **Risk**: If Icecast stream fails, audio stops (no safety fallback)
   - **Current**: Both devices report `fallback_exists: false`
   - **Expected**: Fallback MP3 should be uploaded via `/upload` endpoint
   - **Remediation**: Upload fallback assets after UI wiring complete
   - **Blocker**: 🟢 LOW - can be deferred to post-wiring ops task

5. **Manual playback mode on both devices**
   - **Risk**: Devices will not auto-recover to stream if fallback was triggered
   - **Current**: Both in `mode: manual`
   - **Expected**: Could use `mode: auto` for automatic fallback → stream recovery
   - **Remediation**: Update via `/config` PUT or adjust default device config
   - **Blocker**: 🟢 LOW - operator can manage mode via UI once wired

### Low Priority / Informational

6. **Liquidsoap telnet control port exposed (1234)**
   - **Info**: Port 1234 on VPS-01 allows raw telnet commands to Liquidsoap (play/stop/skip)
   - **Security**: Port not exposed externally; internal Docker network only
   - **Recommendation**: Document this for advanced operator troubleshooting

7. **Icecast web UI credentials in cleartext env file**
   - **Info**: `ICECAST_ADMIN_PASSWORD` stored in `infra/vps/icecast.env` (not SOPS-encrypted)
   - **Security**: File permissions restrict access; consider secrets manager for production
   - **Recommendation**: Rotate passwords periodically; do not commit `.env` to Git (already .gitignored)

---

## 6. UI Wiring Readiness Checklist

| Requirement | Status | Blocker? | Action Required |
|-------------|--------|----------|-----------------|
| Control plane `/api/audio/devices` returns valid data | ✅ PASS | No | None |
| Control plane authentication working | ✅ PASS | No | None |
| Device control APIs responding with auth | ✅ PASS | No | None |
| Prometheus metrics available for dashboards | ✅ PASS | No | None |
| Icecast stream operational | ✅ PASS | No | None |
| Device stream URLs configured correctly | ❌ FAIL | ⚠️ YES | **Fix device stream_url configs before UI wiring** |
| `/audio/{id}` individual endpoint exists | ❌ FAIL | 🟡 NO | Update docs or implement endpoint |
| Fallback files uploaded | ❌ FAIL | 🟢 NO | Can defer to post-wiring |
| Documentation accurate (VPS location) | ❌ FAIL | 🟡 NO | Update docs in this PR |

**Recommendation**: Address "Critical Gaps #1" (stream URLs) before proceeding to Step 2 (UI wiring). All other gaps can be tracked as follow-up issues.

---

## 7. Next Steps (Step 2 Prerequisites)

1. ✅ **Accept this inspection report** (Step 1 complete)
2. ⚠️ **Fix device stream URLs**:
   ```bash
   # Example remediation (run on VPS-01 with proper auth):
   curl -X PUT http://pi-audio-01:8081/config \
     -H 'Authorization: Bearer 7d12cb8f5efe204d31923be1befaf5540a5b700ba8f026f3a3e5b8eba7d8245a' \
     -H 'Content-Type: application/json' \
     -d '{"stream_url": "http://icecast:8000/fleet.mp3"}'

   curl -X PUT http://pi-audio-02:8081/config \
     -H 'Authorization: Bearer fecd3a1a94ee2b0fb3dd1fc3653eadae6bebf3da854fbd4961e3c9ac3735c619' \
     -H 'Content-Type: application/json' \
     -d '{"stream_url": "http://icecast:8000/fleet.mp3"}'
   ```
3. ✅ **Update documentation** (this PR includes doc fixes for VPS location and endpoint clarifications)
4. 🟢 **Optionally**: Upload fallback MP3s to devices for safety (can defer)
5. 🟢 **Proceed to Step 2**: Draft UI wiring implementation with acceptance tests

---

## Appendices

### A. Test Commands Used

All commands run from VPS-01 (`/home/admin/fleet`):

```bash
# Health probes
curl -s http://localhost:3005/healthz
curl -s http://localhost:3005/readyz

# Control plane API (with auth)
curl -s -H 'Authorization: Bearer 3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc' \
  http://localhost:3005/health/summary | jq

curl -s -H 'Authorization: Bearer 3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc' \
  http://localhost:3005/audio/devices | jq

# Device endpoints
curl -s http://pi-audio-01:8081/healthz
curl -s -H 'Authorization: Bearer 7d12cb8f5efe204d31923be1befaf5540a5b700ba8f026f3a3e5b8eba7d8245a' \
  http://pi-audio-01:8081/status | jq
curl -s http://pi-audio-01:8081/metrics

curl -s http://pi-audio-02:8081/healthz
curl -s -H 'Authorization: Bearer fecd3a1a94ee2b0fb3dd1fc3653eadae6bebf3da854fbd4961e3c9ac3735c619' \
  http://pi-audio-02:8081/status | jq
curl -s http://pi-audio-02:8081/metrics

# Icecast status
curl -s http://localhost:8000/status-json.xsl | jq

# Prometheus queries
curl -s 'http://localhost:9090/api/v1/query?query=audio_stream_up' | jq
curl -s 'http://localhost:9090/api/v1/query?query=audio_fallback_active' | jq
curl -s http://localhost:9090/api/v1/targets | jq '.data.activeTargets[] | select(.labels.job | contains("audio"))'
```

### B. File Inventory

**VPS-01 Infrastructure Files** (verified present):
- `/home/admin/fleet/infra/vps/compose.fleet.yml` - Fleet services (API, UI, worker, Caddy, FileBrowser)
- `/home/admin/fleet/infra/vps/compose.icecast.yml` - Icecast standalone (deprecated, replaced by liquidsoap compose)
- `/home/admin/fleet/infra/vps/compose.liquidsoap.yml` - Icecast + Liquidsoap stack (active)
- `/home/admin/fleet/infra/vps/icecast.env` - Icecast credentials
- `/home/admin/fleet/infra/vps/liquidsoap/playlist.liq` - Liquidsoap streaming config
- `/home/admin/fleet/vps/fleet.env` - Control plane environment (API_BEARER, device tokens)

**Music Library**:
- Liquidsoap music volume: `/music/Beautiful Relaxing Music.mp3` (166 MB, single file)

**Docker Networks**:
- `vps_fleet-network` (bridge, br-fleet) - Fleet services + Caddy
- `liquidsoap-network` (bridge, external) - Icecast + Liquidsoap + Fleet API

### C. Evidence Timestamps

- Inspection conducted: 2025-10-06 15:33:56 - 15:36:30 UTC
- Icecast server start: 2025-10-04 06:43:03 UTC (uptime: ~2 days)
- Liquidsoap stream start: 2025-10-04 07:03:16 UTC
- Fleet API uptime: 203379s (~2.35 days)
- Last device registry load: 2025-10-04 07:04:17 UTC
- Prometheus last scrape: 2025-10-06 15:36:04/07 UTC

---

**Report Status**: ✅ Complete
**Approval Required**: Yes (review and merge before Step 2)
**Follow-up Issues**: Create issues for Critical Gap #1 (stream URL fix) and Medium Gap #4 (fallback uploads)
