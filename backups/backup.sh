#!/bin/sh
set -eu
# Full backup of /srv and Docker volumes (adjust as needed)
restic snapshots || restic init
restic backup /backup --tag fleet --verbose
# Keep last 7 daily, 4 weekly, 6 monthly
restic forget --prune --keep-daily 7 --keep-weekly 4 --keep-monthly 6
