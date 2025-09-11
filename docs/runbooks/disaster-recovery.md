# Disaster Recovery Playbook

## When a device fails
1) Replace SD card or hardware.
2) Flash latest **fleet base image**.
3) Follow Provisioning Runbook steps.
4) Restore data if needed:
   - Restic: `docker compose -f backups/restic-compose.yml run --rm restic-backup restore latest --target /`
5) Verify services via dashboards and `docker ps`.

## Backup Verification
- Perform quarterly restore test on a staging device.
- Record outcomes in `docs/changelog.md`.
