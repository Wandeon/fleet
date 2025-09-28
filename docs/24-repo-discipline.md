# Repository Discipline

## OpenAPI Contract Management
- **Single source of truth:** `apps/api/openapi.yaml`
- **Generation command:** `npm run openapi:generate`
- **Required outputs:** Commit updates under `apps/ui/src/lib/api/` and any server SDKs.
- **CI enforcement:** The `contract` workflow lints the spec, regenerates clients, and fails on drift.
- **Developer action:** After editing the spec run the command above, ensure `git status` is clean, and update changelog notes.

## Environment Schema
- UI environment variables are defined in `apps/ui/.env.schema.ts` with the following required keys:
  - `VITE_API_BASE`
  - `VITE_USE_MOCKS`
  - `VITE_FEATURE_VIDEO`
  - `VITE_FEATURE_ZIGBEE`
  - `VITE_FEATURE_CAMERA`
- Example values live in `/apps/ui/.env.example` and must be updated when new keys are introduced.
- The `ui-env-validation` workflow fails when variables are missing or malformed.

## SSR & Placeholder Discipline
- Loader modules must avoid unsafe browser access and return null-safe data structures.
- Use `isFeatureEnabled(flag)` for every feature gate. Ad-hoc `import.meta.env` checks are forbidden in route files.
- The `placeholder-guard` workflow scans for placeholders rendered while a flag default is OFF.

## Test Enforcement
- **First-render contract tests:** Run `npm run test:first-render --workspace apps/ui` when modifying routes listed in `/docs/05-ui-structure.md`.
- **Playwright smokes:** Run `npm run test:playwright -- --project smoke` locally before submitting UI changes.
- **Docs:** Update `/docs/05-ui-structure.md` and `/docs/runbooks/ui-stabilization.md` when adding new routes, flags, or loaders.

## Definition of Done for UI Changes
1. Regenerate OpenAPI clients and commit artifacts (no drift in `git diff`).
2. SSR loaders/components handle null data and unauthorized responses gracefully.
3. Feature flags default to safe OFF states with tests covering both OFF and ON.
4. First-render contract tests updated and passing for affected routes.
5. Playwright smokes updated for affected modules.
6. Documentation updated for spec, flags, env schema, or ops procedures.
