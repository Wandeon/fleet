# Fleet Operations Console — Product Requirements Document

## Overview
Fleet provides a unified operations console for monitoring and controlling distributed audio, video, Zigbee, and camera devices deployed in the field. The console prioritizes fast triage by operators while giving technicians and administrators the depth needed to maintain device health, compliance, and configuration.

## Goals & Non-Goals
### Goals
- Deliver a responsive, operator-first dashboard that surfaces live device status and recent logs in a single glance.
- Enable cross-modal device control (audio, video, Zigbee, camera) with consistent interaction patterns.
- Provide technicians with actionable troubleshooting tools, including health metrics, alerts, and remote reset actions.
- Support administrators with configuration management, access control, and audit-ready reporting.
- Integrate with existing authentication and token infrastructure for secure multi-tenant access.

### Non-Goals
- Building low-level firmware tooling or hardware provisioning workflows.
- Replacing specialized analytics platforms beyond aggregated health trends.
- Implementing billing, licensing, or procurement flows.
- Supporting consumer self-service; focus remains on internal operations and partners.

## User Personas
### Operator
- Works in the Network Operations Center monitoring fleets in real time.
- Needs fast situational awareness and the ability to escalate or acknowledge incidents.
- Success measured by mean time to detect (MTTD) incidents and adherence to runbooks.

### Technician
- Field or remote engineer responsible for diagnosing and resolving device issues.
- Needs historical context, remote commands (restart, firmware check), and troubleshooting guides.
- Success measured by mean time to repair (MTTR) and post-incident quality metrics.

### Admin
- Oversees configuration baselines, permissions, and compliance reporting.
- Needs tools to manage device groups, user roles, token lifecycles, and audit logs.
- Success measured by policy adherence and minimum configuration drift.

## Top User Stories & Acceptance Criteria
1. **Operator reviews fleet status at start of shift.**
   - Given the operator logs in, when the dashboard loads, then the left column lists devices grouped by site with status pills (online, degraded, offline).
   - When a device is selected, the right column updates to show system health cards (latency, last heartbeat) and the latest 50 log entries within 2 seconds.

2. **Operator investigates an incident.**
   - Given an alert is triggered, when the operator opens the device detail panel, then audio/video/Zigbee/camera tiles show current stream availability and controls (mute/unmute, start/stop, snapshot) with disabled states when unavailable.
   - When health metrics breach thresholds, alert banners and next steps links appear.

3. **Technician applies remote remediation.**
   - Given a technician has technician or admin role, when they select a device, then they can send remote commands (restart service, resync firmware, clear cache) with confirmation modals and execution logs.
   - Command outcomes are appended to the log stream with timestamp, actor, and result state.

4. **Admin manages tokens and permissions.**
   - Given an admin navigates to Settings → Access Control, when they create or revoke a token, then the system validates scope, expiry, and associated device groups before persisting.
   - Audit log entries capture the change, user, timestamp, and justification.

5. **Operator works during degraded connectivity.**
   - Given the console detects high latency or offline state, when the operator continues working, then cached device lists and last-known health metrics remain accessible.
   - When connectivity returns, deltas synchronize automatically, with conflict resolution logged.

## Functional Requirements
- **Authentication & Roles:** Integrate with existing SSO and token-based API access. Enforce role-based view filtering (operator, technician, admin).
- **Device Directory:** Query device inventory service, group by site/region, support search, filters (status, type), and pagination.
- **Live Metrics:** Subscribe to WebSocket/SSE endpoints for device heartbeat, stream state, and health KPIs. Fallback to polling every 15 seconds when streaming unavailable.
- **Logs Panel:** Display chronological logs with severity badges, filters, and infinite scroll. Provide export to CSV for last 24 hours.
- **Control Actions:** Provide remote command API triggers with optimistic UI updates and real-time confirmation.
- **Alerts & Notifications:** Visual badges, audible cue toggle, and integration with incident management webhooks.
- **Settings:** Manage device groups, token scopes, and user roles. Include audit trail and validation messaging.

## Constraints
- **Network:** Must function on constrained 1.5 Mbps uplinks with 150 ms latency; degrade gracefully under packet loss up to 5%.
- **Devices:** Support 5,000 concurrently monitored devices per tenant; ensure UI remains performant (<1.5s interactions) with virtualized lists.
- **Tokens & Auth:** API tokens rotate every 24 hours; UI must refresh tokens silently without user disruption. Enforce MFA for admin actions.
- **Offline Support:** Provide read-only cached state for up to 30 minutes offline, with queued actions (remote commands) blocked until reconnection.
- **Security & Compliance:** All data encrypted in transit (TLS 1.2+) and at rest; logs must redline sensitive payloads before display.

## Success Metrics
- Reduce MTTD by 30% within first quarter of launch.
- Achieve operator satisfaction score ≥ 4.5/5 in quarterly survey.
- Maintain 99.9% UI availability and <1% failed command executions.
- Ensure <200 ms average dashboard rendering time post data fetch.

## Release Plan
1. **Alpha (Month 1-2):** Core dashboard, device list, health cards, read-only logs.
2. **Beta (Month 3-4):** Remote commands, alerting, offline caching, technician tools.
3. **GA (Month 5):** Admin settings, audit trails, reporting, performance tuning, localization readiness.

## Dependencies
- Device telemetry service (real-time metrics, WebSocket API).
- Inventory API for metadata and grouping.
- Authentication/SSO provider and token lifecycle manager.
- Logging pipeline with searchable index.
- Incident management integration (PagerDuty or internal tool).

## Risks & Mitigations
- **Data volume overload:** High device counts may slow UI. Mitigate with incremental loading, virtualization, and aggregated health summaries.
- **Remote command failure:** Commands could timeout. Provide retries, timeout alerts, and rollback instructions.
- **Role misconfiguration:** Incorrect permissions may expose sensitive actions. Enforce least privilege defaults and automated audits.
- **Telemetry gaps:** Missing data from edge devices could mislead operators. Display data freshness timestamps and fallback statuses.
- **Change fatigue:** Operators may resist new UI. Provide training mode and runbooks aligned with new workflow.

## Open Questions
- What localization requirements exist for international operators?
- Should audio/video stream previews support live playback or thumbnails only in phase one?
- Are there regulatory constraints for log retention per region?
- What escalation integrations (chat, ticketing) must be prioritized beyond baseline webhooks?
- How should maintenance windows be represented to avoid false alarms?
