# CI Fixes History

Record of notable CI issues and the remediation steps applied. Update when new pipeline regressions are addressed.

## 2025-04 – Prisma engines missing on runners

- **Symptom:** `npm run test` failed on GitHub Actions with missing Prisma query engine binaries.
- **Fix:** Set `PRISMA_CLIENT_ENGINE_TYPE=binary` and `PRISMA_CLI_QUERY_ENGINE_TYPE=binary` in `ci.yml`, added `PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1` for test job. Ensured `npm ci` runs before tests.【F:.github/workflows/ci.yml†L15-L118】

## 2025-04 – OpenAPI drift breaking contract CI

- **Symptom:** `contract-ci.yml` failed when developers modified `apps/api/openapi.yaml` without regenerating UI client.
- **Fix:** Workflow now runs `npm run openapi:generate` and enforces clean git status via `git diff --exit-code`. Added mock server probes to catch regression early.【F:.github/workflows/contract-ci.yml†L1-L55】
- **Follow-up:** Documented in [03-ci-pipelines](./03-ci-pipelines.md) and added developer note in `apps/ui/README.md` to commit generated types.【F:apps/ui/README.md†L1-L40】

## 2025-05 – Playwright download flakiness

- **Symptom:** UI tests intermittently failed when Playwright browsers were missing.
- **Fix:** Cached browsers per Node version via `actions/cache` and installed Chromium explicitly inside CI job before running Playwright/Vitest suites.【F:.github/workflows/ci.yml†L63-L132】

## 2025-06 – Acceptance smoke targeting stale hosts

- **Symptom:** Deploy workflow acceptance step timed out when devices renamed or removed.
- **Fix:** Parameterised `ACCEPTANCE_HOSTS` secret and documented process to update `inventory/devices.yaml` alongside secret rotation. Acceptance script now logs to `.deploy/last-acceptance.log` for review.【F:scripts/vps-deploy.sh†L1-L200】【F:README.md†L130-L154】

## Open items

- Establish automated reminder when `inventory/device-interfaces.yaml` changes without updating Prometheus targets.
- Add CI step to ensure `/docs/project-knowledge/` remains under 25 files and validates Markdown links.

See [03-ci-pipelines](./03-ci-pipelines.md) for current workflow topology.
