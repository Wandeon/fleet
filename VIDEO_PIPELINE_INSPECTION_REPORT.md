# Video Pipeline Inspection Report
**Generated:** 2025-10-06
**Persona:** VPS GUY — STEP 1
**Scope:** End-to-end inspection of video control pipeline (NO CODE CHANGES)

---

## 1) Topology

```
Fleet UI (SvelteKit)
  ↓ HTTP (SSR proxy /ui/*)
Fleet API (Express :3005)
  ↓ Bearer auth (API_BEARER)
/api/video/* routes
  ↓ Proxies to device via bearer token (HDMI_PI_VIDEO_01_TOKEN)
pi-video-01:8082 (media-control FastAPI)
  ↓ mpv IPC + CEC commands
TV/Display (HDMI-CEC)
  ↓ Local playback storage
HDMI video files (on pi-video-01 filesystem)
```

**Network:**
- Fleet UI runs on VPS :3006 behind Caddy (TLS termination)
- Fleet API on VPS :3005, proxied via Caddy at /api/*
- pi-video-01:8082 is private (Tailscale), accessible only via API proxy
- Zigbee hub coexists on same device at :8084 (deferred to later work)

---

## 2) Endpoint Matrix with Evidence

### Control Plane (over Caddy)

| Endpoint | Method | Auth | Purpose | Status | Notes |
|----------|--------|------|---------|--------|-------|
| `/api/healthz` | GET | None | API liveness | ✅ Implemented | Standard probe |
| `/api/readyz` | GET | None | API readiness | ✅ Implemented | Loads registry |
| `/api/health/summary` | GET | Bearer | Aggregated device health | ✅ Implemented | Returns status across modules |
| `/api/video/devices` | GET | Bearer | List video devices | ✅ Implemented | Returns device inventory |
| `/api/video/devices/:deviceId/power` | POST | Bearer | CEC power on/standby | ✅ Implemented | Returns 202 with jobId |
| `/api/video/devices/:deviceId/input` | POST | Bearer | CEC input switching | ✅ Implemented | Returns 202 with jobId |
| `/api/video/devices/:deviceId/volume` | POST | Bearer | Volume control (0-100) | ✅ Implemented | Returns 202 with jobId |
| `/api/video/devices/:deviceId/mute` | POST | Bearer | Toggle mute | ✅ Implemented | Returns 202 with jobId |
| `/api/video/devices/:deviceId/playback` | POST | Bearer | Play/pause/resume/stop | ✅ Implemented | Requires URL for play action |
| `/api/video/devices/:deviceId/library` | GET | Bearer | List video files | ✅ Implemented | Proxies to device |
| `/api/video/devices/:deviceId/library/upload` | POST | Bearer | Upload video file | ✅ Implemented | 500MB limit, multipart |
| `/api/video/devices/:deviceId/library/:filename` | DELETE | Bearer | Delete video file | ✅ Implemented | Proxies to device |
| **`/api/video/tv/power`** | **POST** | **Bearer** | **Convenience route for primary TV** | **❌ MISSING** | **UI calls this but route doesn't exist** |
| **`/api/video/tv/input`** | **POST** | **Bearer** | **Convenience route for input** | **❌ MISSING** | **UI calls this but route doesn't exist** |
| **`/api/video/tv/volume`** | **POST** | **Bearer** | **Convenience route for volume** | **❌ MISSING** | **UI calls this but route doesn't exist** |
| **`/api/video/tv/mute`** | **POST** | **Bearer** | **Convenience route for mute** | **❌ MISSING** | **UI calls this but route doesn't exist** |

**Evidence:**
- ✅ Routes defined in `/apps/api/src/routes/video.ts:118-350`
- ✅ Service logic in `/apps/api/src/services/video.ts:1-265`
- ✅ Jobs system wired for async execution
- ❌ `/tv/*` convenience routes missing — **UI cannot reach backend without these**

### Device Endpoints (pi-video-01:8082)

⚠️ These are reached via API proxy only; direct access blocked by network policy.

| Device Endpoint | Method | Auth | Purpose | Proxy Route | Status |
|-----------------|--------|------|---------|-------------|--------|
| `/healthz` | GET | None | Device health | N/A | ✅ Direct probe |
| `/status` | GET | Token | mpv playback state | Via `/devices/:id/*` | ✅ Ready |
| `/play` | POST | Token | Start playback with URL | Via `/devices/:id/playback` | ✅ Ready |
| `/pause` | POST | Token | Pause playback | Via `/devices/:id/playback` | ✅ Ready |
| `/resume` | POST | Token | Resume playback | Via `/devices/:id/playback` | ✅ Ready |
| `/stop` | POST | Token | Stop playback | Via `/devices/:id/playback` | ✅ Ready |
| `/tv/power_on` | POST | Token | CEC power on | Via `/devices/:id/power` | ✅ Ready |
| `/tv/power_off` | POST | Token | CEC standby | Via `/devices/:id/power` | ✅ Ready |
| `/tv/input` | POST | Token | CEC input switch | Via `/devices/:id/input` | ✅ Ready |
| `/volume` | POST | Token | Volume (0-100) | Via `/devices/:id/volume` | ✅ Ready |
| `/library` | GET | Token | List video files | Via `/devices/:id/library` | ✅ Ready |
| `/library/upload` | POST | Token | Upload video | Via `/devices/:id/library/upload` | ✅ Ready |

**Evidence:**
- ✅ Device defined in `inventory/devices.yaml:10-13` as pi-video-01 with role hdmi-media
- ✅ Interfaces defined in `inventory/device-interfaces.yaml:182-297`
- ✅ Token env var `HDMI_PI_VIDEO_01_TOKEN` referenced in device-interfaces.yaml:196
- ⚠️ Cannot test device endpoints directly without SSH/Tailscale access to pi-video-01

---

## 3) Configuration Truth Table

| Configuration Item | Location | Expected | Actual | Status |
|--------------------|----------|----------|--------|--------|
| `API_BEARER` | `vps/fleet.env:1` | Non-empty secret | `3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc` | ✅ Present |
| `HDMI_PI_VIDEO_01_TOKEN` | `vps/fleet.env:7` | Real device token | `changeme-token` | ⚠️ **PLACEHOLDER** |
| `VITE_USE_MOCKS` | `vps/fleet.env` | Should be 0 for prod | Not found in file | ❓ **MISSING** |
| CEC device index | Device env `/etc/fleet/agent.env` | Set per TV | Unknown (cannot SSH) | ❓ **UNVERIFIED** |
| HDMI connector | Device env | HDMI port for output | Unknown | ❓ **UNVERIFIED** |
| HDMI audio device | Device env | Audio sink device | Unknown | ❓ **UNVERIFIED** |

**Gaps:**
- ⚠️ **Critical:** `HDMI_PI_VIDEO_01_TOKEN` is set to placeholder value — API cannot authenticate to device
- ❌ **Critical:** `VITE_USE_MOCKS` not configured — UI may still use mocks
- ❓ **Unknown:** Cannot verify CEC settings without device access

**TV CEC Readiness:**
- ❓ Cannot confirm TV responds to CEC commands without testing
- ❓ Cannot verify CEC_DEVICE_INDEX is correct
- ❓ Input switching requires device-specific CEC support

---

## 4) Operational Signals

### Loki Logs

**Expected:**
- `{service="fleet-api", correlationId="xyz"}` — API logs for /video/* calls
- `{service="media-control", correlationId="xyz"}` — Device logs from pi-video-01

**Status:**
❓ **Cannot verify** — Requires live API calls with correlation IDs and Loki access

**Readiness:**
- ✅ Logging infrastructure documented in `docs/project-knowledge/13-logs-and-monitoring.md`
- ✅ Promtail ships logs from baseline stack
- ✅ x-correlation-id propagation implemented in API

### Prometheus Metrics

**Expected Metrics:**
- `http_requests_total{path="/video/devices/:deviceId/power"}`
- `upstream_device_failures_total{deviceId="pi-video-01"}`
- `jobs_success`, `jobs_fail` (from job executor)
- `circuit_breaker_state` (if upstream fails repeatedly)

**Status:**
❓ **Cannot verify** — Requires Prometheus scrape and metrics endpoint inspection

**Readiness:**
- ✅ Metrics endpoints defined in device-interfaces.yaml
- ✅ Prometheus targets in `infra/vps/targets-hdmi-media.json` (presumably)
- ❓ Video-specific metrics may be stubbed (needs live inspection)

---

## 5) Gaps & Risks

### Critical Blockers 🔴

1. **❌ Missing `/api/video/tv/*` convenience routes**
   - UI calls `/api/video/tv/power`, `/input`, `/volume`, `/mute`
   - API only has `/api/video/devices/:deviceId/*` routes
   - **Impact:** UI cannot communicate with backend at all
   - **Fix:** Add `/tv/*` routes that proxy to primary device (pi-video-01)

2. **⚠️ HDMI_PI_VIDEO_01_TOKEN is placeholder**
   - Current value: `changeme-token`
   - **Impact:** API cannot authenticate to media-control service
   - **Fix:** Set real token matching device configuration

3. **❌ VITE_USE_MOCKS not configured**
   - Cannot confirm UI is running in production mode
   - **Impact:** UI may still use mock data instead of real API
   - **Fix:** Add `VITE_USE_MOCKS=0` to `vps/fleet.env`

### High Risk ⚠️

4. **❓ CEC configuration unverified**
   - Cannot test TV power on/off without device access
   - CEC_DEVICE_INDEX may be incorrect
   - **Impact:** CEC commands may fail silently
   - **Fix:** SSH to pi-video-01, run `cec-client -l`, verify index

5. **❓ Device endpoint authentication unclear**
   - media-control expects `MEDIA_CONTROL_TOKEN` (per docs)
   - But device-interfaces.yaml references `HDMI_PI_VIDEO_01_TOKEN`
   - **Impact:** Possible auth mismatch
   - **Fix:** Verify env var names match between VPS and device

### Medium Risk 📋

6. **UI endpoint mismatch**
   - UI video-operations.ts calls endpoints that don't match API routes
   - Power endpoint expects `{on: boolean}` but API expects `{power: "on"|"standby"}`
   - **Impact:** Request validation will fail
   - **Fix:** Update UI to match API contract (payload shapes)

7. **No playback test file documented**
   - Task requires test video for playback proof
   - No documented path to a test file on pi-video-01
   - **Impact:** Cannot prove play/stop works
   - **Fix:** Document a test file path or upload one via library endpoint

### Low Risk 📝

8. **Observability proof pending**
   - Cannot demonstrate correlation ID flow without live requests
   - **Impact:** Debugging will be harder if correlation IDs don't work
   - **Fix:** Make test requests with unique IDs, verify in Loki

9. **Zigbee hub coexistence not tested**
   - Zigbee runs on :8084 alongside media-control
   - No documented separation of concerns
   - **Impact:** Potential port conflicts or resource contention
   - **Fix:** Verify both services run simultaneously without issues

---

## Exit Criteria Status

| Criterion | Status | Evidence |
|-----------|--------|----------|
| Full matrix completed for all endpoints | ✅ Done | See section 2 |
| Verified HDMI_PI_VIDEO_01_TOKEN present | ⚠️ Present but placeholder | vps/fleet.env:7 |
| Verified token effective | ❌ Cannot test | Requires device access |
| Caddy passes Authorization | ✅ Documented | Caddy config preserves headers |
| CEC power/input switching works | ❌ Not tested | Requires device access |
| Playback start/stop works | ❌ Not tested | No test file available |
| Documented stubs/placeholders blocking UI | ✅ Done | See gaps section |

---

## Recommended Next Steps (VPS GUY - STEP 2)

1. **Add `/tv/*` convenience routes to video API**
   - Create `/api/video/tv/power`, `/input`, `/volume`, `/mute`
   - Proxy to `pi-video-01` device ID
   - Maintain same payload contract as UI expects

2. **Set real HDMI_PI_VIDEO_01_TOKEN**
   - Coordinate with device owner to get actual token
   - Update `vps/fleet.env:7`

3. **Add VITE_USE_MOCKS=0 to vps/fleet.env**
   - Ensure UI runs in production mode
   - Restart UI service

4. **Verify CEC configuration on device**
   - SSH to pi-video-01
   - Run `cec-client -l` to list adapters
   - Confirm CEC_DEVICE_INDEX matches
   - Test `cec-client` commands manually

5. **Create or document test video file**
   - Upload small test clip to pi-video-01 via library endpoint
   - Document path for playback testing
   - Recommended: 10-30 second MP4 file

6. **Make test API calls with correlation IDs**
   - Use curl with `X-Correlation-Id: test-video-$(date +%s)`
   - Verify logs appear in Loki with matching ID
   - Confirm Prometheus metrics increment

7. **Update UI video-operations.ts payload shapes**
   - Fix power endpoint: `{on: boolean}` → `{power: "on"|"standby"}`
   - Fix input/volume/mute payloads to match API schema
   - Regenerate OpenAPI client if needed

---

## Appendix: File References

### Documentation
- Video operations: `docs/project-knowledge/10-video-operations.md`
- API surface: `docs/project-knowledge/04-api-surface.md`
- Device inventory: `docs/project-knowledge/06-device-inventory.md`
- Security & auth: `docs/project-knowledge/14-security-and-auth.md`
- Deployment: `docs/project-knowledge/02-deployment-and-networks.md`
- Logs & monitoring: `docs/project-knowledge/13-logs-and-monitoring.md`
- UI structure: `docs/project-knowledge/05-ui-structure.md`

### Code
- Video API routes: `apps/api/src/routes/video.ts`
- Video service: `apps/api/src/services/video.ts`
- Video UI module: `apps/ui/src/lib/modules/VideoModule.svelte`
- Video operations: `apps/ui/src/lib/api/video-operations.ts`
- Device registry: `inventory/device-interfaces.yaml`

### Configuration
- VPS env: `vps/fleet.env`
- Device inventory: `inventory/devices.yaml`
- Caddy config: `infra/vps/caddy.fleet.Caddyfile`

---

**Report prepared by:** VPS GUY
**Date:** 2025-10-06
**Status:** Inspection complete, NO CODE CHANGES made
**Next phase:** STEP 2 — Implementation Enabler
