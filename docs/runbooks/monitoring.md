# Monitoring & Alerts

## Stack overview

The monitoring stack that lives under `vps/compose.prom-grafana-blackbox.yml` is made of:

- **Prometheus** – scrapes metrics and evaluates alert rules from `vps/prometheus/alerts.yml`.
- **Blackbox exporter** – performs HTTP probes (including the Pi `/healthz` endpoints) and exposes probe results to Prometheus.
- **Grafana** – dashboards and ad‑hoc graphing of the metrics stored in Prometheus.
- **Alertmanager** – fan‑out component that turns Prometheus alerts into Slack messages or other notifications.
- **Promtail** – defined in the overlay `vps/compose.promtail.yml` to forward VPS container/syslog output into Loki.

Device targets are generated from `inventory/device-interfaces.yaml` and shipped to Prometheus as JSON files (`vps/targets-*.json`). Each device exposes a `/metrics` endpoint; the `up` metric becomes `0` when a scrape fails and is what powers the `DeviceOffline` alert.

## How alerts fire

Prometheus evaluates the alert ruleset `vps/prometheus/alerts.yml` every 15s. Relevant device checks include:

- **DeviceOffline** – fires when `up{job="audio-player"} == 0` for 5 minutes (you can clone this rule for other jobs).
- **PrometheusTargetDown** – catches any target whose `up` metric goes to zero for 3 minutes, regardless of job.
- **BlackboxHttpFail** – alerts if the HTTP probe fails (non‑200/3xx/4xx status or timeout).

Alert states are visible in the Prometheus UI (`http://<host>:9090/alerts`) and Grafana Alerting. Use `docker run --rm -v $(pwd)/vps/prometheus/alerts.yml:/tmp/alerts.yml prom/prometheus promtool check rules /tmp/alerts.yml` after editing the rules file to validate syntax.

## Wiring Slack notifications

1. **Create a Slack webhook.** In Slack → *App Directory* → *Incoming Webhooks*, create a webhook that posts into your `#ops-alerts` (or preferred) channel.
2. **Store the secret locally.** Create `vps/secrets/slack-webhook.url` (excluded from git) containing only the webhook URL.
3. **Review the Alertmanager config.** `vps/alertmanager.yml` routes every alert to Slack. Adjust the `channel` name or add more receivers as needed.
4. **Start Alertmanager alongside Prometheus.** Include the promtail overlay when composing so log collection is enabled.
   ```bash
   docker compose -f vps/compose.prom-grafana-blackbox.yml -f vps/compose.promtail.yml up -d alertmanager
   docker compose -f vps/compose.prom-grafana-blackbox.yml up -d prometheus grafana blackbox
   ```
   Prometheus is already configured to forward alerts to `alertmanager:9093`.
5. **Smoke test the path.**
   - Visit `http://<host>:9093/#/alerts` – the Alertmanager UI should load with no config errors.
   - Trigger a test notification without touching production devices:
     ```bash
     docker run --rm --network host prom/alertmanager amtool \
       alert add TestNotification alertname="DeviceOffline" instance="demo" job="audio-player"
     ```
     You should immediately see a Slack message. Clear the test alert with `amtool alert query --alertmanager.url=http://localhost:9093 | xargs -r amtool alert expire`.

When a device stops responding to `/metrics`, the `DeviceOffline` rule flips to `firing` after five minutes. Alertmanager groups the firing alerts by device (`alertname` + `instance`) and sends a dedicated Slack message for each device going offline; a follow‑up “resolved” message arrives automatically once the scrape succeeds again.

## Operating tips

- Keep `/healthz` endpoints unauthenticated so Blackbox probes succeed and `probe_success` stays at 1.
- Update `vps/targets-*.json` whenever a device IP or hostname changes and re-run `docker compose ... up -d prometheus` to reload the file service discovery targets.
- Grafana’s dashboard export `vps/grafana-dashboard-audio.json` is a starting point; clone it for HDMI/camera metrics.
- Budgets for the UI remain: Lighthouse Performance ≥ 0.80, Accessibility ≥ 0.95, JS ≤ 200 KB, CSS ≤ 50 KB, CLS ≤ 0.1, LCP ≤ 2.5s on LAN.

