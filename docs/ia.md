# Fleet Operations Console — Information Architecture

## Navigation Structure
- **Dashboard (default landing)**
  - Device List (left column)
    - Global search (name, ID, site)
    - Filters
      - Status (Online, Degraded, Offline)
      - Type (Audio Gateway, Video Encoder, Zigbee Hub, Camera)
      - Site / Region
    - Device tiles
      - Status pill
      - Signal strength
      - Unacknowledged alerts count
  - Device Detail (context panel)
    - Header
      - Device name + ID
      - Site + group tags
      - Quick actions (Acknowledge, Assign, Bookmark)
    - Mode Tabs
      - **Audio**
        - Stream status indicator
        - Controls: Play preview, Mute/Unmute, Reset stream
        - Metrics: Latency, Bitrate, Last packet timestamp
      - **Video**
        - Stream thumbnail/placeholder
        - Controls: Start/Stop preview, Snapshot, Quality selector
        - Metrics: FPS, Resolution, Dropped frames
      - **Zigbee**
        - Mesh health score
        - Paired devices list with status
        - Controls: Rebuild mesh, Ping end node
      - **Camera**
        - Live frame preview or fallback image
        - PTZ controls (Pan/Tilt/Zoom), Presets dropdown
        - Metrics: Storage buffer, Motion events
      - **Health** (default tab)
        - KPIs: Heartbeat age, CPU, Memory, Firmware version
        - Alert badges and recommended actions
        - Remote remediation buttons (Restart service, Clear cache)
      - **Logs**
        - Chronological log feed (latest 50, infinite scroll)
        - Filters (severity, source module)
        - Export / share actions
    - Footer (context panel)
      - Last sync timestamp
      - Link to historical reports

- **Alerts Center**
  - Active incidents list
  - Incident detail page with timeline and related devices

- **Reports**
  - Health trends (weekly/monthly)
  - Device utilization (audio/video stream counts)
  - Export scheduler

- **Settings**
  - Device Groups
    - CRUD groupings, assign devices
  - Access Control
    - Users & roles (Operator, Technician, Admin)
    - API tokens (create, rotate, revoke)
    - Audit log viewer
  - Integrations
    - Incident webhooks
    - External analytics exporters

- **Support**
  - Runbooks library
  - Maintenance calendar
  - Contact escalation paths

## Operator-First Flow
1. Operator logs in and lands on Dashboard.
2. Device list auto-selects highest priority alert or most recently active device.
3. Health tab displays heartbeat, CPU, memory, and alert banners.
4. Operator can jump to Audio/Video/Zigbee/Camera tabs via keyboard shortcuts or tab headers.
5. Logs tab remains sticky in right column for quick correlation.
6. Quick actions (acknowledge, escalate, assign) always available in header.
7. Contextual help link surfaces relevant runbook snippet.

## Contextual Navigation Patterns
- Left column persists across dashboard subpages to maintain situational awareness.
- Right column swaps between Health and Logs split view; other tabs overlay in place.
- Breadcrumbs appear for Settings, Reports, Alerts to aid admins/technicians.
- Global command palette (⌘/Ctrl+K) provides quick navigation to devices, alerts, or settings.

## Data Hierarchy
1. **Critical Alerts:** red badges and banners at top of device list.
2. **Device Health KPIs:** large cards in Health tab with thresholds.
3. **Control Actions:** primary buttons grouped near relevant metrics.
4. **Detailed Logs:** collapsible, searchable feed occupying right-lower quadrant.
5. **Historical & Reports:** accessible secondary navigation, not in primary flow.

## Metadata & State Indicators
- Status colors: Green (online), Amber (degraded), Red (offline), Grey (maintenance).
- Loading skeletons for device tiles, metrics cards, and log rows.
- Empty states include guidance copy and CTA (e.g., "No logs in last hour – broaden filter").
- Error states show icon, message, retry button, and support link.

## Responsive Considerations
- ≥1280px: two-column layout with fixed device list (35% width) and detail panel (65%).
- 1024–1279px: collapsible device list, detail panel full width when expanded.
- ≤1023px: stacked layout, device list top accordion, detail panels slide-in.
- Critical alerts remain sticky at top of viewport on all breakpoints.
