# VPS Monitoring Stack

This directory contains Docker Compose files for the central monitoring stack.

## Grafana Credentials

The Grafana service reads credentials from `monitoring.env`. Create this file
from the provided example and supply secure values:

```bash
cp monitoring.env.example monitoring.env
# edit monitoring.env and set GF_SECURITY_ADMIN_USER and GF_SECURITY_ADMIN_PASSWORD
```

> **Note:** Never commit `monitoring.env` to version control.
