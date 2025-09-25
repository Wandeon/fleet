# Future Roadmap

High-level priorities for the next phases of Fleet development. Update as initiatives ship.

## Near term (0–3 months)

- **Stabilize UI routes** – Deliver `/settings`, `/health`, `/fleet/*`, and `/logs` with live API data, resolving UX audit blockers.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】
- **API completeness** – Implement real data for video/zigbee/camera routes currently returning placeholders. Add Zigbee action execution and camera event feeds.【F:apps/api/src/routes/video.ts†L1-L74】【F:apps/api/src/routes/zigbee.ts†L1-L82】【F:apps/api/src/routes/camera.ts†L1-L72】
- **Health dashboards** – Wire `/health` UI to `/api/health/summary` and `/api/health/events/recent`, create Grafana panels for Zigbee and camera health.【F:apps/api/src/routes/health.ts†L1-L59】
- **Knowledge base maintenance** – Integrate docs linting to ensure `/docs/project-knowledge/` stays authoritative (see [16-ci-fixes-history](./16-ci-fixes-history.md)).
- **UX audit tracking** – See [Phase C report (2025-09-25)](../ux/audit/phaseC-20250925.md) for the latest UI gaps and mock dependencies.

## Mid term (3–6 months)

- **RBAC & audit trails** – Introduce role-based permissions for audio/video control, automation editing, and firmware rollout. Persist operator identity in device events. Align with UX stories for playlist management and incident acknowledgement.【F:docs/ux/operator-jobs-and-stories.md†L26-L118】【F:docs/ux/operator-jobs-and-stories.md†L258-L348】
- **Library & automation** – Build audio asset library with playlists, sync drift monitoring, and Zigbee automation builder (rule engine + simulation).【F:docs/ux/operator-jobs-and-stories.md†L46-L202】
- **Firmware orchestration** – Implement firmware job pipeline with cohort rollout, rollback, and monitoring hooks (see [22-firmware-and-updates](./22-firmware-and-updates.md)).

## Long term (6–12 months)

- **AI camera features** – Add detection classification, night mode escalation, acknowledgement workflow, and alert integrations per UX story. Expand API endpoints for previews and clip exports.【F:docs/ux/operator-jobs-and-stories.md†L204-L276】
- **Observability automation** – Auto-create incident threads with `/health/events/recent`, integrate Slack MCP for natural language queries, and add Grafana annotations from Alertmanager events.【F:infra/vps/README.md†L75-L115】
- **Multi-site support** – Extend inventory/agent to handle multiple locations (site labels, Loki tenant separation). Update UI to filter by site and replicate metrics dashboards.

## Process goals

- Enforce documentation updates for every architecture change via CI. 
- Schedule quarterly UX audits and postmortem reviews to feed roadmap updates. 
- Track progress in sprint planning; update this roadmap file at the end of each release cycle.
