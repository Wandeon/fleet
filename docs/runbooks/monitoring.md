# Monitoring & Alerts

- Prometheus loads alert rules from `vps/prometheus/alerts.yml`.
- After deployment, verify:
  - `promtool check rules vps/prometheus/alerts.yml`
  - Prometheus UI → Alerts shows `ui_ops.rules`.

Notification channels:
- Configure Grafana Contact Points (Slack/email/webhook).
- Map alerts: ApiDown, HealthDegraded/Down, High5xx, CertExpirySoon, DeviceOffline, TargetDown, DiskSpaceLow, CpuHot, BlackboxHttpFail.

Budgets:
- Lighthouse: Performance ≥ 0.80, Accessibility ≥ 0.95
- Payload: JS ≤ 200 KB, CSS ≤ 50 KB
- CLS ≤ 0.1, LCP ≤ 2.5s (LAN)

