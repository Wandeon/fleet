# UX Gaps & Priorities

Based on the September 2025 UX audit and current mock-driven routes, these are the highest-priority UX fixes before widening operator access.

## Critical blockers

| Area                                            | Gap                                                                 | Impact                                                     | Action                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation (`/settings`, `/health`, `/fleet/*`) | Routes return 404/500; generic error messaging hides root cause.    | Operators cannot configure system or inspect fleet layout. | Restore backend endpoints (or hide nav until ready), provide request ID + remediation guidance. 【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】 |
| Logs page                                       | `/ui/logs` responds 404; UI loops “Request failed”.                 | No incident review/audit trail.                            | Implement `/api/logs` proxy, surface error states with retry CTA and correlation ID hints. 【F:ux-audit/20250924-192021/fleet-ux-audit.md†L5-L55】      |
| Dashboard status                                | Global banner shows `Offline · 0 ms` while cards claim “All clear”. | Misleads operators during outages.                         | Feed real connection status from `/health/summary`; align card colors with backend health. 【F:ux-audit/20250924-192021/fleet-ux-audit.md†L9-L33】      |

## High priority enhancements

- **Audio module** – Add asset library table, device list with drift metrics, and helper text for controls (`Play on both`, `Replace fallback`). Map actions to API endpoints documented in [09-audio-operations](./09-audio-operations.md).【F:ux-audit/20250924-192021/fleet-ux-audit.md†L33-L55】
- **Video module** – Populate telemetry (last signal timestamp, command feedback), add source selection and confirmation to avoid “Invalid Date”.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L33-L55】
- **Zigbee module** – Replace empty table with onboarding CTA, filter/search, hub health summary. Hook into real API once automation backend is ready.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L33-L55】
- **Camera module** – Provide preview thumbnails, motion history, and clearer navigation to logs/events. Link to detection pipeline once `/camera/events` live.【F:ux-audit/20250924-192021/fleet-ux-audit.md†L33-L55】

## Medium-term roadmap

- Implement RBAC for audio/video/zigbee actions per operator stories (playlist rights, automation edits, incident acknowledgement). See [08-operator-stories](./08-operator-stories.md).
- Design consolidated health console with uptime metrics, SLA indicators, and remediation links.
- Integrate log stream context panes (click entry → show correlated device events, metrics).

## Process improvements

- Add UX regression checklist to PR template (ensure new routes have backend support or are feature-flagged).
- Include Lighthouse budget enforcement via `npm run lighthouse` in CI once routes return real data.【F:apps/ui/ARCHITECTURE.md†L47-L63】
- Schedule quarterly UX audits replicating the 2025-09-24 run to validate progress (`ux-audit` captures scripts/screenshots).

Track progress in upcoming sprints and update this file as features ship.
