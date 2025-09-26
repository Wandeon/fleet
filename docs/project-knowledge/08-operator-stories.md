# Operator Jobs & UX Stories

This section summarizes the operator workflows documented in `docs/ux/operator-jobs-and-stories.md`. Use it to align UI/API backlog with real-world tasks.

## Audio operations

- **Play single asset on device** – Authenticate, pick device, choose file, trigger `/device/:id/play`. Success within 2s; log audit trail. Handle offline devices, unsupported formats, and permission errors with actionable toasts.【F:docs/ux/operator-jobs-and-stories.md†L5-L24】
- **Play different tracks on multiple Pis** – Multi-select devices, schedule playback, support per-device errors and retries. Prevent cross-zone control without proper permissions.【F:docs/ux/operator-jobs-and-stories.md†L26-L44】
- **Playlist deployment & sync** – Build playlists, assign devices, manage sync drift (<100 ms), and expose re-sync controls. Monitor playlist validation failures and in-flight sync issues.【F:docs/ux/operator-jobs-and-stories.md†L46-L74】
- **Drift measurement** – Surface sync metrics, allow re-sync/nudge, and gate diagnostics endpoints for read-only roles.【F:docs/ux/operator-jobs-and-stories.md†L76-L96】
- **Library management** – Upload assets with metadata, enable soft delete/restore, and audit changes. Include virus scanning and RBAC for destructive actions.【F:docs/ux/operator-jobs-and-stories.md†L98-L118】

## Video workflows

- **Live stream monitoring** – Provide low-latency preview, quality selector, screenshot capture, and diagnostics for codec mismatches. Enforce TLS and tokenized stream URLs.【F:docs/ux/operator-jobs-and-stories.md†L120-L138】
- **Recorded footage review** – Deliver timeline scrubbing, export clips, and surface errors for missing segments or expired retention. Require incident-review permissions.【F:docs/ux/operator-jobs-and-stories.md†L140-L158】

## Zigbee control

- **Commission new sensor** – Offer add-device wizard with pairing guidance, status feedback, and security guardrails (key rotation, role-based access).【F:docs/ux/operator-jobs-and-stories.md†L160-L180】
- **Automation rules** – Rule builder with trigger/condition/action configuration, conflict detection, and RBAC for actuator selection. Persist audit logs for rule changes.【F:docs/ux/operator-jobs-and-stories.md†L182-L202】

## Camera monitoring

- **AI detection triage** – Event feed with filters, thumbnails, and video jump links. Manage missing clips gracefully and guard PII in thumbnails.【F:docs/ux/operator-jobs-and-stories.md†L204-L232】
- **Night mode escalation** – Night schedule editor, escalation channels, severity toggles, and integration health checks. Secure webhooks with signatures.【F:docs/ux/operator-jobs-and-stories.md†L234-L256】
- **Event acknowledgement** – Bulk selection, comment-required acknowledgements for high severity, and archive workflow with audit logging.【F:docs/ux/operator-jobs-and-stories.md†L258-L280】

## Fleet management

- **Fleet health dashboard** – Real-time status widgets, alerts linking to device detail, stale data warnings, and maintenance window indicators.【F:docs/ux/operator-jobs-and-stories.md†L282-L304】
- **Offline acknowledgement & retry** – Acknowledge incidents with notes, schedule retries via job queue, and handle race conditions when devices return online mid-flow.【F:docs/ux/operator-jobs-and-stories.md†L306-L326】
- **Firmware rollout** – Cohort selection, staged rollout progress, rollback controls, version validation, and artifact signature checks.【F:docs/ux/operator-jobs-and-stories.md†L328-L348】

## Logging & observability

- **Live log monitoring** – Provide streaming log table with severity filters, correlation ID search, pause/resume, and export. Mask sensitive data and respect retention policies.【F:docs/ux/operator-jobs-and-stories.md†L350-L368】

Use these stories to prioritize UX fixes listed in [17-ux-gaps-and-priorities](./17-ux-gaps-and-priorities.md) and to validate API coverage in [04-api-surface](./04-api-surface.md).
