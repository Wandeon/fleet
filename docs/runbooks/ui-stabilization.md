# UI Stabilization Runbook

This runbook describes the checklist for shipping a UI change that passes all CI gates.

## 1. Prepare the Contract
1. Update `apps/api/openapi.yaml` when new endpoints or shapes are required.
2. Run `npm run openapi:generate`.
3. Commit spec and generated clients together. The `contract` workflow will fail if drift remains.

## 2. Implement SSR-Safe Loaders
1. Add or update loaders in `apps/ui/src/routes/**`.
2. Guard browser APIs with `if (browser) { ... }` from `$app/environment`.
3. Ensure loaders return null-safe defaults and handle `401/403` with explicit branches.
4. Add unit tests covering new loaders if complex transformations exist.

## 3. Validate Feature Flags
1. Define or update flags in `apps/ui/src/lib/config/features.ts`.
2. Access flags only through `isFeatureEnabled(flag)`.
3. Document default values and environments in `/docs/24-repo-discipline.md`.
4. Update Playwright smokes to assert OFF hides controls and ON exercises the flow.

## 4. Update First-Render Contract Tests
1. Add a spec under `tests/first-render/` that uses the generated OpenAPI client.
2. Confirm the test fails with a descriptive error message if endpoints drift.
3. Run `npm run test:first-render --workspace apps/ui` locally.

## 5. Check Environment Schema
1. Update `apps/ui/.env.schema.ts` if new variables are needed.
2. Add defaults to `/apps/ui/.env.example`.
3. Run `npm run validate:env --workspace apps/ui`.

## 6. Run Acceptance Tests
1. Execute `npm run test:playwright -- --project smoke`.
2. Capture traces for failing specs and attach to the PR if issues persist.

## 7. Update Documentation
- `/docs/05-ui-structure.md` for route contracts and feature flag defaults.
- `/docs/24-repo-discipline.md` for repo policies.
- `/docs/repo-policies/branch-protection.md` if new checks are introduced.

## 8. Fill Out the PR Template
- Answer each checklist item explicitly (YES/NO).
- Link to failing CI jobs and describe fixes.

## Troubleshooting Quick Reference
| Failure | Likely Cause | Fix |
| --- | --- | --- |
| `contract` | Generated clients not committed | Run generator, commit changes |
| `ui-env-validation` | Missing `VITE_*` variable | Update `.env` and schema |
| `placeholder-guard` | Feature rendered while flag OFF | Gate UI behind `isFeatureEnabled()` |
| `first-render-contract-tests` | Loader calling wrong endpoint | Update loader or spec + regenerate |
| `playwright-smokes` | Control flow mismatch | Update mocks, ensure flags toggled in test |
