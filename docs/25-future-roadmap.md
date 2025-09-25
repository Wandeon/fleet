# Future Roadmap (Phase C Follow-up)

## Backend enablement
- Implement `/camera/overview`, `/camera/events/:id/ack`, `/camera/events/:id/clip`, and `/camera/:id/refresh` endpoints so the UI can drop mock fallbacks.
- Expose `/settings` PATCH routes for proxy updates, allowed origins, pairing lifecycle, and operator CRUD operations.
- Add `/fleet/overview`, `/fleet/devices/:id`, and `/fleet/devices/:id/actions/:actionId` endpoints mirroring the mocked contract used in the UI helpers.

## UX polish
- Replace pairing duration numeric input with presets and progress ring once backend exposes time remaining.
- Add inline streaming log indicators (e.g., blinking icon) that pause when SSE drops.
- Extend camera module with detection overlays (bounding boxes) once video service publishes metadata.

## Automation & testing
- Expand Playwright suites to cover destructive actions behind confirmation dialogs and to assert state persistence after refresh.
- Backfill API contract tests to keep generated client in sync (`npm run openapi:generate` + CI guard already in CONTRIBUTING).
- Capture CI artefacts for logs, camera, and fleet device flows inside `/opt/fleet/ux-audit/<timestamp>/` for historical diffing.

See also: [docs/ux/audit/phaseC-20250925.md](ux/audit/phaseC-20250925.md) for detailed gap analysis.
