# CI Pipeline Documentation

## Overview
Fleet uses GitHub Actions to enforce contract-first APIs, SSR-safe UI, and deterministic releases. Each workflow below has a stable `name:` that matches the required status checks in branch protection.

## Pull Request Workflows

### 1. `contract`
- **Trigger:** Pull requests touching API, spec, or generated client directories.
- **Jobs:**
  - OpenAPI linting (`spectral lint`)
  - Deterministic client generation (`npm run openapi:generate`)
  - Drift guard (`git diff --exit-code` on generated folders)
  - Endpoint summary artifact for reviewers
- **Fix it:** Re-run the generator, commit all changes, and ensure the spec passes linting. See `/docs/24-repo-discipline.md#openapi-contract-management`.

### 2. `typecheck`
- **Trigger:** Every pull request
- **Jobs:** `npm run typecheck` for `apps/api` and `apps/ui`
- **Fix it:** Run `npm run typecheck --workspace apps/ui` or `--workspace apps/api` locally and resolve type errors. Pay close attention to SSR loaders returning nullable values.

### 3. `build`
- **Trigger:** Every pull request
- **Jobs:** Production builds for API (`npm run build --workspace apps/api`) and UI (`npm run build --workspace apps/ui`)
- **Fix it:** Ensure environment schema is satisfied and the app compiles without placeholders.

### 4. `ui-env-validation`
- **Trigger:** Every pull request
- **Jobs:** Validate `.env` inputs using the UI environment schema script (`npm run validate:env --workspace apps/ui`)
- **Fix it:** Provide values for missing `VITE_*/PUBLIC_` variables or update `/apps/ui/.env.schema.ts` if a new variable is intentional. Document changes in `/docs/24-repo-discipline.md#environment-schema`.

### 5. `placeholder-guard`
- **Trigger:** UI or feature flag changes
- **Jobs:**
  - Static analysis ensuring feature flags flow through `isFeatureEnabled()`
  - Placeholder scan to prevent rendering disabled modules
- **Fix it:** Wrap new features with flags defined in `/apps/ui/src/lib/config/features.ts` and extend Playwright coverage when toggling defaults.

### 6. `first-render-contract-tests`
- **Trigger:** Pull requests touching `apps/ui/src/routes/**`
- **Jobs:** Route-level tests verifying first-render data calls (`npm run test:first-render --workspace apps/ui`)
- **Fix it:** Update the OpenAPI spec, regenerate clients, or fix loader usage so requests match the generated client definitions.

### 7. `playwright-smokes`
- **Trigger:** Every pull request, tagged `@smoke`
- **Jobs:** Playwright smoke tests for fleet overview, logs, settings, audio, video, zigbee, and camera modules.
- **Fix it:** Review failing trace artifacts. Keep mocks aligned with the spec, and ensure feature flags toggle UI controls safely.

### 8. `caddy-compose-port-check`
- **Trigger:** Changes under `infra/`, `docker-compose*.yml`, or Caddyfiles
- **Jobs:** Parse Compose services and Caddy upstreams to catch port drift.
- **Fix it:** Update both configurations so each exposed service matches the proxy target.

### 9. `inventory-monitoring-sync`
- **Trigger:** Changes to `inventory/**` or Prometheus targets
- **Jobs:** Ensure device inventory updates are reflected in monitoring target files.
- **Fix it:** Regenerate monitoring files using `npm run sync:inventory` and commit the results.

### 10. `release-readiness-report`
- **Trigger:** Every pull request
- **Jobs:** Aggregate results from all workflows, render release readiness Markdown, and attach artifacts for ops.
- **Fix it:** Address upstream failures; this workflow will stay red until prerequisites succeed.

## Nightly / Post-Merge Workflows
- `nightly-playwright-regression` (extended suite)
- `nightly-contract-audit` (diff spec vs production)

## Troubleshooting
- Use `gh workflow view <name>` to inspect logs.
- Artifacts live under GitHub Actions → Run details → Artifacts.
- Consult the “Fix it” playbooks in `/docs/runbooks/ui-stabilization.md` and `/ops/reports/repo-ci-hardening-report.md` for targeted guidance.
