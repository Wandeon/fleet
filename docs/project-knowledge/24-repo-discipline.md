# Repository Discipline

Fleet is the source of truth for GitOps automation; disciplined workflows keep deployments predictable.

## Branching & PRs

- Develop on feature branches and open PRs against `main`. Merges to `main` trigger GitOps convergence on every device via `role-agent.sh` and VPS deployment workflow; avoid direct commits to prevent surprise rollouts.【F:README.md†L1-L24】【F:README.md†L106-L151】
- PRs must regenerate OpenAPI client when `apps/api/openapi.yaml` changes (`npm run openapi:generate`). Commit generated files with the same PR to prevent CI failures.【F:CONTRIBUTING.md†L1-L12】
- Ensure CI passes before requesting review: run lint/typecheck/build/test as needed. Highlight any intentionally skipped checks in the PR description.

## Commit hygiene

- Keep commits focused (docs vs. infrastructure vs. code). Include context in commit messages explaining operational impact (e.g., “update audio fallback path” or “add zigbee target”).
- Encrypt secrets with SOPS (`.env.sops.enc`) or place plaintext env files in `.gitignore` to avoid leaking credentials. Do not commit generated `.deploy/` or `/etc/fleet/` state files.

## Review checklist

1. Verify inventory updates align across `inventory/devices.yaml`, `inventory/device-interfaces.yaml`, Prometheus target files, and documentation.
2. Confirm new services expose health checks and metrics for monitoring.
3. Validate documentation updates for operator-facing changes (e.g., runbook modifications, knowledge base entries).
4. Ensure acceptance scripts or smoke tests cover new device behaviors; update `scripts/acceptance.sh` when required.

## Post-merge responsibilities

- Monitor GitHub Actions deploy workflow output and `/health/events/recent` after merge.
- Run `scripts/acceptance.sh` if changes affect audio playback; extend to Zigbee/camera tests as they become available.
- Update relevant knowledge base files (`docs/project-knowledge/`) when architecture changes so production state stays accurate.

Refer to [03-ci-pipelines](./03-ci-pipelines.md) for workflow details and [02-deployment-and-networks](./02-deployment-and-networks.md) for deploy mechanics.
