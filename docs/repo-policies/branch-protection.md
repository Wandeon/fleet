# Branch Protection Policy

## Protected Branches

### `main` Branch
The `main` branch is protected with the following rules. These settings must be configured in **Settings → Branches** on GitHub and may not be bypassed.

#### Required Status Checks
All merges into `main` must have a green build for the exact workflow names below:

1. `contract` – OpenAPI lint, client generation, and drift guard
2. `typecheck` – Type checking for API and UI workspaces
3. `build` – Production builds for API and UI
4. `ui-env-validation` – UI environment schema validation
5. `placeholder-guard` – Feature flag discipline and placeholder enforcement
6. `first-render-contract-tests` – Route-level contract assertions
7. `playwright-smokes` – Operator-critical Playwright smoke suite
8. `caddy-compose-port-check` – Reverse proxy vs Compose port drift check
9. `inventory-monitoring-sync` – Device inventory vs monitoring target sync
10. `release-readiness-report` – Aggregated deployment readiness artifact

> **Note:** The workflow names above must match the `name:` field inside `.github/workflows/*.yml` exactly so GitHub can enforce them.

#### Review Requirements
- Require **review from code owners** for every pull request.
- Require **linear history** (use rebase/merge or squash) and **dismiss stale reviews on new commits**.
- Enforce **no admin bypass** and **disallow force pushes**.

#### Scope-Based Reviews via CODEOWNERS
- `apps/api/**` and `apps/api/openapi.yaml` changes request **@fleet-team/api**.
- `infra/**`, any `*.Caddyfile`, and `docker-compose*.yml` request **@fleet-team/infra**.
- `apps/ui/src/**` and UI libraries request **@fleet-team/ui**.

## How to Configure
1. Navigate to **Settings → Branches**.
2. Create or edit the rule for `main`.
3. Enable “Require a pull request before merging” and “Require review from Code Owners”.
4. Turn on “Dismiss stale pull request approvals when new commits are pushed”.
5. Select “Require linear history”.
6. Add all status checks from the list above and mark them as required.
7. Disable “Allow force pushes” and “Allow deletions”.
8. Save the rule.

## Enforcement Sources
- GitHub Branch Protection
- `.github/CODEOWNERS`
- Required CI workflows listed in `/docs/03-ci-pipelines.md`
- Pull request template checklist

## Emergency Procedure
Production fixes still follow the same protections. Coordinate with reviewers for expedited approval, keep the change minimal, and ensure all status checks pass before merging.
