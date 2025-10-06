# Video UI Acceptance Matrix
**Generated:** 2025-10-06
**Persona:** UX/QA GUY — STEP 4
**Scope:** Button-by-button validation of Video controls

---

## Test Environment

**Prerequisites:**
- ✅ VITE_USE_MOCKS=0 configured in vps/fleet.env
- ✅ fleet-ui service restarted
- ✅ fleet-api service running with video routes
- ✅ pi-video-01 device online with correct MEDIA_CONTROL_TOKEN
- ✅ TV connected via HDMI with CEC enabled
- ✅ Test video file uploaded to device library

**Access:**
- **UI URL:** https://app.headspamartina.hr/video
- **API Bearer:** `3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc`
- **Device:** pi-video-01
- **Correlation ID Format:** `qa-video-{action}-{timestamp}`

---

## 1) Environment Sanity Check

### Test 1.1: UI Loads Without Mocks

| Criterion | Test | Expected Result | Status | Evidence |
|-----------|------|-----------------|--------|----------|
| No mock banner | Open /video page | No "Using Mock Data" warning visible | ⏳ | Screenshot 1.1 |
| Network calls | Open DevTools Network tab | Requests go to /api/video/* endpoints | ⏳ | Network tab screenshot |
| No console errors | Check browser console | No errors related to API calls | ⏳ | Console screenshot |

**Evidence Required:**
- Screenshot showing /video page without mock banner
- Network tab showing requests to https://app.headspamartina.hr/api/video/*
- Console with no errors

### Test 1.2: API Healthcheck

```bash
# Run from terminal
curl -H "Authorization: Bearer 3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc" \
     https://app.headspamartina.hr/api/healthz
```

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Response code | 200 OK | ___ | ⏳ |
| Response body | `{"status":"ok"}` | ___ | ⏳ |
| Response time | < 500ms | ___ | ⏳ |

### Test 1.3: Device Online Status

```bash
# Check device status
curl -H "Authorization: Bearer 3e4f6b2f76cb888ff5730a98e2de066cdbc11cb41b7575ef6f58536a180cc3fc" \
     https://app.headspamartina.hr/api/video/devices
```

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Response code | 200 OK | ___ | ⏳ |
| devices array | Contains pi-video-01 | ___ | ⏳ |
| device status | "online" or "standby" | ___ | ⏳ |
| device power | "on" or "standby" | ___ | ⏳ |

---

## 2) Device Card Display

### Test 2.1: Device Information

| UI Element | Expected Display | Actual Display | Status | Screenshot |
|------------|------------------|----------------|--------|------------|
| Device Name | "Media Hub & Zigbee" or "pi-video-01" | ___ | ⏳ | 2.1a |
| Power State | Pill showing "ON" (green) or "STANDBY" (gray) | ___ | ⏳ | 2.1b |
| Current Input | HDMI1, HDMI2, or CHROMECAST | ___ | ⏳ | 2.1c |
| Volume Level | 0-100% value displayed | ___ | ⏳ | 2.1d |
| Mute State | "Muted" or "Unmuted" indicator | ___ | ⏳ | 2.1e |
| Last Updated | Recent timestamp (< 5 minutes old) | ___ | ⏳ | 2.1f |

**Evidence Required:**
- Full-page screenshot showing device card with all elements visible

### Test 2.2: Playback Status

| UI Element | Expected Display | Actual Display | Status |
|------------|------------------|----------------|--------|
| Playback status | idle / playing / paused / stopped | ___ | ⏳ |
| Current source | URL or "No media" | ___ | ⏳ |
| Started at | Timestamp if playing, null if idle | ___ | ⏳ |

---

## 3) TV CEC Controls — Power

### Test 3.1: Power On

**Steps:**
1. Ensure TV is currently in standby
2. Click "Power On" button in UI
3. Observe TV behavior
4. Check network request in DevTools

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Button state | Disables during request | ___ | ⏳ | Video/Screenshot |
| Network request | POST to /api/video/tv/power | ___ | ⏳ | Network tab |
| Request body | `{"on": true}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| Response body | Contains `jobId` and `correlationId` | ___ | ⏳ | Response JSON |
| TV behavior | Turns on within 3 seconds | ___ | ⏳ | Visual confirmation |
| UI feedback | Success toast with job ID | ___ | ⏳ | Toast screenshot |
| State update | Power pill changes to "ON" (green) | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-power-on-{timestamp}`

**Loki Log Query:**
```
{service="fleet-api", correlationId="qa-video-power-on-*"}
```

**Expected Log Entry:**
```json
{
  "level": "info",
  "msg": "TV power control requested via convenience route",
  "power": "on",
  "correlationId": "qa-video-power-on-1696588800"
}
```

**Actual Log Entry:** ___

### Test 3.2: Power Off

**Steps:**
1. Ensure TV is currently on
2. Click "Power Off" button in UI
3. Observe TV behavior
4. Check network request in DevTools

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Button state | Disables during request | ___ | ⏳ | Video/Screenshot |
| Network request | POST to /api/video/tv/power | ___ | ⏳ | Network tab |
| Request body | `{"on": false}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Enters standby within 3 seconds | ___ | ⏳ | Visual confirmation |
| UI feedback | Success toast with job ID | ___ | ⏳ | Toast screenshot |
| State update | Power pill changes to "STANDBY" (gray) | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-power-off-{timestamp}`

### Test 3.3: Power Toggle While Busy

**Steps:**
1. Click "Power On"
2. Immediately click "Power Off" (within busy window)
3. Observe behavior

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Second request | Returns 409 Conflict | ___ | ⏳ |
| Error message | "Device busy - please wait..." | ___ | ⏳ |
| UI feedback | Error toast displayed | ___ | ⏳ |
| Button state | Re-enables after error | ___ | ⏳ |

---

## 4) TV CEC Controls — Input Switching

### Test 4.1: Switch to HDMI1

**Steps:**
1. Ensure TV is on
2. Click "HDMI1" button (or select from dropdown)
3. Observe TV input change

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/tv/input | ___ | ⏳ | Network tab |
| Request body | `{"input": "hdmi1"}` (or "HDMI1") | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Switches to HDMI1 source | ___ | ⏳ | Visual confirmation |
| TV display | Shows HDMI1 content | ___ | ⏳ | Photo of TV |
| UI feedback | Success toast "Switched to HDMI1" | ___ | ⏳ | Toast screenshot |
| State update | Current input shows "HDMI1" | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-input-hdmi1-{timestamp}`

### Test 4.2: Switch to HDMI2

**Steps:** (Same as 4.1, but for HDMI2)

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Request body | `{"input": "hdmi2"}` | ___ | ⏳ |
| TV behavior | Switches to HDMI2 source | ___ | ⏳ |
| UI feedback | Success toast "Switched to HDMI2" | ___ | ⏳ |

**Correlation ID Used:** `qa-video-input-hdmi2-{timestamp}`

### Test 4.3: Switch to Chromecast (if available)

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Request body | `{"input": "chromecast"}` | ___ | ⏳ |
| TV behavior | Switches to Chromecast input | ___ | ⏳ |
| UI feedback | Success toast | ___ | ⏳ |

**Correlation ID Used:** `qa-video-input-cast-{timestamp}`

### Test 4.4: Invalid Input

**Steps:**
1. Manually send request with invalid input via curl or DevTools
   ```bash
   curl -X POST \
     -H "Authorization: Bearer ..." \
     -H "Content-Type: application/json" \
     -d '{"input": "INVALID"}' \
     https://app.headspamartina.hr/api/video/tv/input
   ```

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Response code | 422 Unprocessable Entity | ___ | ⏳ |
| Error message | "Input INVALID is not available" | ___ | ⏳ |
| TV behavior | No change | ___ | ⏳ |

---

## 5) TV CEC Controls — Volume & Mute

### Test 5.1: Increase Volume

**Steps:**
1. Note current volume level
2. Move volume slider to higher value (e.g., 50 → 75)
3. Observe TV audio level

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/tv/volume | ___ | ⏳ | Network tab |
| Request body | `{"volume": 75}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Volume increases audibly | ___ | ⏳ | Audible confirmation |
| UI feedback | Volume slider updates | ___ | ⏳ | Slider position |
| State update | Volume value shows 75 | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-volume-up-{timestamp}`

### Test 5.2: Decrease Volume

**Steps:**
1. Move volume slider to lower value (e.g., 75 → 25)

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Request body | `{"volume": 25}` | ___ | ⏳ |
| TV behavior | Volume decreases audibly | ___ | ⏳ |
| UI update | Slider position reflects 25 | ___ | ⏳ |

**Correlation ID Used:** `qa-video-volume-down-{timestamp}`

### Test 5.3: Mute Audio

**Steps:**
1. Click "Mute" button

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/tv/mute | ___ | ⏳ | Network tab |
| Request body | `{"mute": true}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Audio mutes | ___ | ⏳ | Audible confirmation |
| UI feedback | Success toast "Muted output" | ___ | ⏳ | Toast screenshot |
| Button state | Changes to "Unmute" (or highlighted) | ___ | ⏳ | Button screenshot |

**Correlation ID Used:** `qa-video-mute-on-{timestamp}`

### Test 5.4: Unmute Audio

**Steps:**
1. Click "Unmute" button (or "Mute" again to toggle)

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Request body | `{"mute": false}` | ___ | ⏳ |
| TV behavior | Audio unmutes | ___ | ⏳ |
| UI feedback | Success toast "Unmuted output" | ___ | ⏳ |

**Correlation ID Used:** `qa-video-mute-off-{timestamp}`

---

## 6) Playback Controls

### Test 6.1: Upload Video File

**Steps:**
1. Click "Upload video" button in Library section
2. Select test file (< 500 MB)
3. Wait for upload to complete

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| File picker | Opens native file dialog | ___ | ⏳ | N/A |
| Upload indicator | Shows "Uploading..." state | ___ | ⏳ | Upload progress |
| Network request | POST to /api/video/devices/pi-video-01/library/upload | ___ | ⏳ | Network tab |
| Request type | multipart/form-data | ___ | ⏳ | Request headers |
| Response code | 200 OK | ___ | ⏳ | Response headers |
| UI feedback | Success toast "Uploaded {filename}" | ___ | ⏳ | Toast screenshot |
| Library update | File appears in library list | ___ | ⏳ | Library screenshot |

**Correlation ID Used:** `qa-video-upload-{timestamp}`

### Test 6.2: Play Video

**Steps:**
1. Ensure test video is in library
2. Click "Play" button for the video (or trigger playback)
3. Observe TV display

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/devices/pi-video-01/playback | ___ | ⏳ | Network tab |
| Request body | `{"action": "play", "url": "file://...", "startSeconds": 0}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Video starts playing | ___ | ⏳ | Video of TV playing |
| Playback status | Shows "playing" | ___ | ⏳ | Status display |
| Source display | Shows filename or URL | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-play-{timestamp}`

**Loki Verification:**
```
{service="media-control", correlationId="qa-video-play-*"}
```

**Expected:** Log showing mpv playback started

### Test 6.3: Pause Video

**Steps:**
1. While video is playing, click "Pause" button
2. Observe TV playback

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/devices/pi-video-01/playback | ___ | ⏳ | Network tab |
| Request body | `{"action": "pause"}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Playback pauses | ___ | ⏳ | Visual confirmation |
| Playback status | Shows "paused" | ___ | ⏳ | Status display |

**Correlation ID Used:** `qa-video-pause-{timestamp}`

### Test 6.4: Resume Video

**Steps:**
1. While video is paused, click "Resume" button
2. Observe TV playback

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Request body | `{"action": "resume"}` | ___ | ⏳ |
| TV behavior | Playback resumes from paused position | ___ | ⏳ |
| Playback status | Shows "playing" | ___ | ⏳ |

**Correlation ID Used:** `qa-video-resume-{timestamp}`

### Test 6.5: Stop Video

**Steps:**
1. While video is playing, click "Stop" button
2. Observe TV display

| Criterion | Expected Result | Actual Result | Status | Evidence |
|-----------|-----------------|---------------|--------|----------|
| Network request | POST to /api/video/devices/pi-video-01/playback | ___ | ⏳ | Network tab |
| Request body | `{"action": "stop"}` | ___ | ⏳ | Request payload |
| Response code | 202 Accepted | ___ | ⏳ | Response headers |
| TV behavior | Playback stops, screen clears | ___ | ⏳ | Visual confirmation |
| Playback status | Shows "stopped" | ___ | ⏳ | Status display |
| Source display | Clears to "No media" | ___ | ⏳ | UI screenshot |

**Correlation ID Used:** `qa-video-stop-{timestamp}`

### Test 6.6: Delete Video

**Steps:**
1. Click "Delete" button for a video in library
2. Confirm deletion in dialog

| Criterion | Expected Result | Actual Result | Status |
|-----------|-----------------|---------------|--------|
| Confirmation | Shows "Delete {filename}?" prompt | ___ | ⏳ |
| Network request | DELETE to /api/video/devices/pi-video-01/library/{filename} | ___ | ⏳ |
| Response code | 200 OK | ___ | ⏳ |
| UI feedback | Success toast "Deleted {filename}" | ___ | ⏳ |
| Library update | File removed from list | ___ | ⏳ |

**Correlation ID Used:** `qa-video-delete-{timestamp}`

---

## 7) Observability Validation

### Test 7.1: Loki Log Correlation

**For Each Action Above:**
1. Note correlation ID used in test
2. Query Loki for fleet-api logs:
   ```
   {service="fleet-api", correlationId="{correlation-id}"}
   ```
3. Query Loki for media-control logs:
   ```
   {service="media-control", correlationId="{correlation-id}"}
   ```

| Action | Correlation ID | fleet-api Logs Found? | media-control Logs Found? | Status |
|--------|----------------|----------------------|---------------------------|--------|
| Power On | ___ | ⏳ | ⏳ | ⏳ |
| Power Off | ___ | ⏳ | ⏳ | ⏳ |
| Input Switch | ___ | ⏳ | ⏳ | ⏳ |
| Volume Change | ___ | ⏳ | ⏳ | ⏳ |
| Mute Toggle | ___ | ⏳ | ⏳ | ⏳ |
| Play Video | ___ | ⏳ | ⏳ | ⏳ |
| Pause Video | ___ | ⏳ | ⏳ | ⏳ |
| Stop Video | ___ | ⏳ | ⏳ | ⏳ |

**Evidence Required:**
- Screenshot of Loki Explore showing logs for at least 3 correlation IDs
- Logs must show timestamp, service name, correlation ID, and action

### Test 7.2: Prometheus Metrics

**Query Prometheus for Video Metrics:**

| Metric | Query | Expected Value | Actual Value | Status |
|--------|-------|----------------|--------------|--------|
| Power requests | `http_requests_total{path="/video/tv/power"}` | > 0 | ___ | ⏳ |
| Input requests | `http_requests_total{path="/video/tv/input"}` | > 0 | ___ | ⏳ |
| Volume requests | `http_requests_total{path="/video/tv/volume"}` | > 0 | ___ | ⏳ |
| Mute requests | `http_requests_total{path="/video/tv/mute"}` | > 0 | ___ | ⏳ |
| Playback requests | `http_requests_total{path=~"/video/devices/.*/playback"}` | > 0 | ___ | ⏳ |
| Device failures | `upstream_device_failures_total{deviceId="pi-video-01"}` | 0 | ___ | ⏳ |
| Job successes | `jobs_success{deviceId="pi-video-01"}` | > 0 | ___ | ⏳ |
| Job failures | `jobs_fail{deviceId="pi-video-01"}` | 0 | ___ | ⏳ |

**Evidence Required:**
- Screenshot of Prometheus Graph showing at least 3 metrics with non-zero values

---

## 8) No Placeholders or Dead Buttons

### Test 8.1: UI Audit

| UI Element | Expected Behavior | Actual Behavior | Status |
|------------|-------------------|-----------------|--------|
| All buttons | Have working click handlers | ___ | ⏳ |
| All inputs | Accept user input | ___ | ⏳ |
| All dropdowns | Show options and update on select | ___ | ⏳ |
| All sliders | Move smoothly and update value | ___ | ⏳ |
| All links | Navigate to valid routes | ___ | ⏳ |
| Error states | Show helpful messages with correlation ID | ___ | ⏳ |
| Loading states | Show during async operations | ___ | ⏳ |

### Test 8.2: No Mock Indicators

| Check | Expected Result | Actual Result | Status |
|-------|-----------------|---------------|--------|
| Mock banner | Not visible anywhere on page | ___ | ⏳ |
| Mock data notices | Not present in tooltips or help text | ___ | ⏳ |
| "Coming soon" labels | Not present for implemented features | ___ | ⏳ |

---

## Evidence Package

**Required Attachments:**
1. **Screenshots** (labeled by test number)
   - Environment: Mock-free UI, network tab, console
   - Device card with full status
   - Power on/off (before & after states)
   - Input switching (TV display showing each input)
   - Volume slider in action
   - Playback controls (play, pause, stop states)
   - Library with uploaded files
   - All success/error toasts

2. **Videos** (optional but recommended)
   - Full flow: Power on → Switch input → Play video → Stop → Power off
   - CEC control responsiveness (button click to TV action latency)

3. **Network Logs** (HAR file or screenshots)
   - All requests to /api/video/* endpoints
   - Headers showing Authorization and x-correlation-id
   - Response bodies showing jobId and correlationId

4. **Server Logs** (Loki exports)
   - fleet-api logs for at least 5 correlation IDs
   - media-control logs for at least 3 correlation IDs

5. **Metrics** (Prometheus screenshots or JSON)
   - All video endpoint metrics showing increments
   - Job success/failure counters
   - Device failure counter (should be 0)

---

## Summary Matrix

| Category | Tests | Passed | Failed | Blocked | Pass Rate |
|----------|-------|--------|--------|---------|-----------|
| Environment | 3 | ___ | ___ | ___ | ___% |
| Device Card | 8 | ___ | ___ | ___ | ___% |
| Power Control | 3 | ___ | ___ | ___ | ___% |
| Input Switching | 4 | ___ | ___ | ___ | ___% |
| Volume & Mute | 4 | ___ | ___ | ___ | ___% |
| Playback | 6 | ___ | ___ | ___ | ___% |
| Observability | 10 | ___ | ___ | ___ | ___% |
| No Placeholders | 2 | ___ | ___ | ___ | ___% |
| **TOTAL** | **40** | **___** | **___** | **___** | **___%** |

**Acceptance Criteria:**
- ✅ Pass rate ≥ 95% (at most 2 failures allowed)
- ✅ Zero failures in critical paths (power, input, playback)
- ✅ All correlation IDs found in logs
- ✅ No placeholders or dead buttons
- ✅ Evidence package complete

---

## Sign-Off

**Tested By:** _______________
**Date:** _______________
**Environment:** Production / Staging (circle one)
**Overall Verdict:** ✅ PASS / ❌ FAIL / ⏳ INCOMPLETE

**Notes:**
___________________________________________________________________________
___________________________________________________________________________
___________________________________________________________________________

**Blockers/Issues:**
___________________________________________________________________________
___________________________________________________________________________

**Next Steps:**
___________________________________________________________________________
___________________________________________________________________________

---

**Report prepared by:** UX/QA GUY
**Date:** 2025-10-06
**Phase:** STEP 4 — Acceptance Validation
