# Audio & Video User Flow Test - Hard Evidence

**Test Date:** 2025-10-03T09:40:09.544Z
**Base URL:** https://app.headspamartina.hr
**Total Steps:** 8

---

## Step 1: navigate-audio

**Description:** Navigate to Audio page

**API Calls:**

- **GET** `/ui/fleet/layout` → Status: **200**
- **GET** `/ui/fleet/state` → Status: **200**
- **GET** `/ui/fleet/overview` → Status: **200**
- **GET** `/ui/audio/overview` → Status: **200**
- **GET** `/ui/audio/devices` → Status: **200**

**Screenshot:** `step-01-navigate_audio.png`

---

## Step 2: upload-modal-failed

**Description:** Upload modal failed to open

*No API calls recorded*

**Screenshot:** `step-02-upload_modal_failed.png`

---

## Step 3: devices-selected

**Description:** Both devices selected

*No API calls recorded*

**Screenshot:** `step-03-devices_selected.png`

---

## Step 4: play-on-selected

**Description:** Play on selected - 200

**API Calls:**

- **GET** `/ui/audio/devices` → Status: **200**

**Screenshot:** `step-04-play_on_selected.png`

---

## Step 5: device-play

**Description:** Device Play clicked - 202

**API Calls:**

- **POST** `/ui/audio/devices/pi-audio-01/resume` → Status: **202**
- **GET** `/ui/audio/devices/pi-audio-01` → Status: **200**

**Screenshot:** `step-05-device_play.png`

---

## Step 6: device-stop

**Description:** Device Stop clicked - 202

**API Calls:**

- **POST** `/ui/audio/devices/pi-audio-01/stop` → Status: **202**
- **GET** `/ui/audio/devices/pi-audio-01` → Status: **200**

**Screenshot:** `step-06-device_stop.png`

---

## Step 7: navigate-video

**Description:** Navigate to Video page

**API Calls:**

- **POST** `/ui/audio/devices/pi-audio-01/stop` → Status: **202**
- **GET** `/ui/audio/devices/pi-audio-01` → Status: **200**
- **GET** `/ui/fleet/layout` → Status: **200**
- **GET** `/ui/fleet/state` → Status: **200**
- **GET** `/ui/fleet/overview` → Status: **200**
- **GET** `/ui/video/devices` → Status: **200**

**Screenshot:** `step-07-navigate_video.png`

---

## Step 8: video-input

**Description:** Video input selected

*No API calls recorded*

**Screenshot:** `step-08-video_input.png`

---

