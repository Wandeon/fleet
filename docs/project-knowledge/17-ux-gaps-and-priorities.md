# UX Gaps & Priorities

Based on the September 2025 UX audit and current mock-driven routes, these are the highest-priority UX fixes before widening operator access.

## Critical blockers ✅ RESOLVED (v2025.10.03-0653)

| Area                                            | Gap                                                                 | Impact                                                     | Resolution (Oct 2025)                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation (`/settings`, `/health`, `/fleet/*`) | Routes return 404/500; generic error messaging hides root cause.    | Operators cannot configure system or inspect fleet layout. | ✅ **FIXED** - All routes functional; correlation IDs surfaced in errors (PR #144, #145)                                                                               |
| Logs page                                       | `/ui/logs` responds 404; UI loops "Request failed".                 | No incident review/audit trail.                            | ✅ **FIXED** - `/api/logs` proxy implemented with exponential backoff retry for 5xx errors; correlation IDs displayed (PR #148)                                        |
| Dashboard status                                | Global banner shows `Offline · 0 ms` while cards claim "All clear". | Misleads operators during outages.                         | ✅ **FIXED** - Dashboard wired to `/api/fleet/state` and `/api/health/events/recent`; real-time status banner shows device counts and connection state (PR #146, #145) |

## High priority enhancements ✅ COMPLETED (v2025.10.03-0653)

- **Audio module** ✅ – Asset library table added, device list with playback status, helper text and tooltips (`Play on both`, `Replace fallback`). All actions mapped to live API endpoints (PR #142, #151)
- **Video module** ✅ – Telemetry display added, "Invalid Date" bugs fixed, TV controls (power/input/volume/mute) wired to `/api/video/tv/*` endpoints via CEC (PR #142, #147)
- **Zigbee module** ✅ – Stub-safe wiring with graceful degradation; actions show "Coming soon" toasts with reason when backend unimplemented (PR #150)
- **Camera module** ✅ – Probe stream button implemented with drawer display; preview stubs handled gracefully; event acknowledgment wired (PR #143, #151)
- **Device Detail Actions** ✅ – Quick Actions for audio/video/camera devices fully functional in `/fleet/[id]` pages (PR #149)

## Medium-term roadmap

- Implement RBAC for audio/video/zigbee actions per operator stories (playlist rights, automation edits, incident acknowledgement). See [08-operator-stories](./08-operator-stories.md).
- Design consolidated health console with uptime metrics, SLA indicators, and remediation links.
- Integrate log stream context panes (click entry → show correlated device events, metrics).

## Process improvements

- Add UX regression checklist to PR template (ensure new routes have backend support or are feature-flagged).
- Include Lighthouse budget enforcement via `npm run lighthouse` in CI once routes return real data.【F:apps/ui/ARCHITECTURE.md†L47-L63】
- Schedule quarterly UX audits replicating the 2025-09-24 run to validate progress (`ux-audit` captures scripts/screenshots).

Track progress in upcoming sprints and update this file as features ship.

## Shipped Features (v2025.10.03-0653)

### Production Status
- ✅ All critical blockers resolved
- ✅ All high-priority enhancements completed
- ✅ VITE_USE_MOCKS=0 enforced in production
- ✅ No placeholder/dead buttons remaining
- ✅ Correlation IDs in all error responses
- ✅ Bearer token auth via /ui/* proxy

### Test Coverage
- **Playwright E2E**: 6 test suites (audio, video, camera, zigbee, dashboard, logs)
- **Vitest Unit**: Button component interactions, loading states
- **CI Integration**: Screenshots and traces uploaded on failure
- **Accessibility**: aria-labels and tooltips on all controls

### API Endpoints Wired
- `/api/audio/{id}/play`, `/stop`, `/volume` - Audio device controls
- `/api/video/tv/power`, `/input`, `/volume`, `/mute` - TV CEC controls
- `/api/camera/{id}/probe` - Camera stream probing
- `/api/zigbee/devices/{id}/action` - Zigbee actions (stub-safe)
- `/api/fleet/state` - Dashboard real-time state
- `/api/health/events/recent` - Health event stream
- `/api/logs` - Log streaming with retry logic

### Next Sprint Priorities
1. **RBAC Implementation** - Role-based access control per operator stories
2. **Camera Preview** - Live preview thumbnails when hardware ready
3. **Zigbee Automation** - Rules engine backend integration
4. **Performance** - Lighthouse budget enforcement in CI
