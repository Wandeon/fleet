# Repo & CI Hardening Report

## New Required Workflows
| Workflow Name | Purpose | Failure Fix |
| --- | --- | --- |
| `contract` | Lint OpenAPI, regenerate clients, block drift | Run `npm run openapi:generate`, commit artifacts |
| `typecheck` | Type safety for API & UI | Run `npm run typecheck` in affected workspace |
| `build` | Production builds for API & UI | Resolve build errors, ensure env schema satisfied |
| `ui-env-validation` | Validate UI `.env` inputs | Update `apps/ui/.env.schema.ts` or `.env` values |
| `placeholder-guard` | Enforce feature flag discipline | Use `isFeatureEnabled()`, hide placeholders |
| `first-render-contract-tests` | Ensure first render uses generated clients | Align loaders with spec or regenerate clients |
| `playwright-smokes` | Validate operator-critical flows | Fix UI regressions, update mocks/tests |
| `caddy-compose-port-check` | Detect proxy vs Compose port drift | Update Compose or Caddy config |
| `inventory-monitoring-sync` | Keep monitoring targets aligned with inventory | Run sync script, commit targets |
| `release-readiness-report` | Aggregate deployment readiness | Resolve upstream failures, rerun CI |

## Documentation Updates
- `/docs/03-ci-pipelines.md` lists workflow responsibilities.
- `/docs/05-ui-structure.md` documents route contracts and SSR rules.
- `/docs/24-repo-discipline.md` encodes definition of done.
- `/docs/runbooks/ui-stabilization.md` provides the feature delivery runbook.
- `/docs/repo-policies/branch-protection.md` enumerates required status checks.

## Branch Protection Configuration
Set the `main` rule to require the status checks above, enforce linear history, and dismiss stale approvals. Reference `/docs/repo-policies/branch-protection.md` for step-by-step instructions.

## Fix-It Playbook
1. Identify failing workflow in GitHub Actions.
2. Consult the relevant documentation section listed above.
3. Apply fix locally (regenerate clients, update schema, adjust flag gating, etc.).
4. Re-run targeted npm scripts to verify.
5. Push changes; CI will rerun automatically.

## Deployment Expectation
Ops must wait for all required checks to report success. Deployment scripts read the release readiness artifact produced by `release-readiness-report` and attach it to the release ticket along with the commit SHA.
