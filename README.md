# Fleet (GitOps) Starter Repo

This repository is the **single source of truth** for your Raspberry Pi + VPS fleet.
Follow the steps in `docs/runbook.md` to provision your first device.

## Structure

- `baseline/` — services that run on every device
- `roles/<role>/` — role-specific services (mix-ins)
- `inventory/devices.yaml` — maps hostnames to roles
- `host-config/` — OS-level configs applied by the agent
- `agent/` — GitOps convergence agent (service + timer + script)
- `secrets/` — SOPS-encrypted env files (commit only encrypted files)
- `ci/` — GitHub Actions workflows
- `docs/` — runbooks and RFCs
  - `docs/changelog.md` — track project changes
  - `docs/adr/` — architecture decision records
