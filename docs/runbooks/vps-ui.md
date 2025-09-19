# VPS UI & Control Source of Truth

This note is for the VPS operator that runs the Fleet API/UI stack. Everything the UI needs to know about edge devices (where to talk to them, which buttons to render, which metrics to scrape) comes from the Git-tracked registry described below. Update the registry in Git first, validate it, then sync it to the VPS and restart the stack.

## 1. Edit the device registry in Git

The canonical registry lives at `inventory/device-interfaces.yaml`. Each entry under `devices:` defines one Raspberry Pi (or other host) that the control plane should expose:

- `id`, `name`, `role`, `kind` – identifiers and display metadata (`kind` drives grouping in the UI).
- `management` – short summary plus the hostname you expect to reach over Tailscale or LAN.
- `api` – base URL, health/status/metrics paths, and optional bearer-token environment variable that the VPS API proxy should read.
- `endpoints` – additional URLs surfaced in the UI for convenience (e.g., RTSP or Zigbee dashboards).
- `monitoring.prometheus_targets` – `{ job, target }` pairs that must exist in `vps/targets-*.json` so Prometheus can scrape the device.
- `operations` – buttons/sliders the UI renders. Each operation includes an HTTP method/path, optional static body, and UI hints (grouping, slider ranges, response rendering).

Keep `inventory/devices.yaml` in sync; every device `id` referenced in the interface registry must also exist in the inventory file so the agents pick up their role assignment.

### Workflow tips

1. Create or edit the YAML entry in a feature branch locally.
2. Run the validator before committing so Prometheus targets and UI hints stay consistent:
   ```bash
   node scripts/validate-device-registry.mjs
   ```
3. Commit both `inventory/device-interfaces.yaml` **and** any updated `vps/targets-*.json` files, push to `main`, and wait for the Pi agents to converge.

## 2. Ship the registry to the VPS

On the VPS the Fleet API reads `/config/device-interfaces.yaml` (mounted from `vps/config`). Sync the Git-tracked registry whenever you make changes:

```bash
# from your workstation
git pull origin main
rsync -av inventory/device-interfaces.yaml vps:/opt/fleet/config/device-interfaces.yaml
```

You only need to copy the single YAML file—Compose mounts the whole `vps/config` directory read-only into the API container.

After syncing the file, restart the API/UI stack so it re-imports the definitions:

```bash
ssh vps
cd /opt/fleet
# ensure vps/fleet.env exists (see next section)
docker compose -f vps/compose.fleet.yml --env-file vps/fleet.env up -d fleet-api fleet-worker fleet-ui
```

The `fleet-api` entrypoint runs `npm run migrate`, `npm run generate`, and `npm run seed:yaml` on every start, so the SQLite database picks up your YAML edits automatically. Tail the logs if you want to verify the import:

```bash
docker compose -f vps/compose.fleet.yml logs -f fleet-api
```

## 3. Configure shared API/UI secrets

Both the API and UI containers expect the same bearer token so the web app can call into `/api/*`. Populate `vps/fleet.env` from the example and keep it private:

```bash
cp vps/fleet.env.example vps/fleet.env
# edit vps/fleet.env and set a strong API_BEARER value
```

The Compose file injects this value into every service that needs it:

- `fleet-api` receives `API_BEARER` and exposes `/api` on port 3005 behind Caddy.
- `fleet-ui` receives `PUBLIC_API_BASE=/api` plus `PUBLIC_API_BEARER=${API_BEARER}` so the frontend automatically sends the same token when calling the API and when opening the SSE stream.

If you publish the UI behind another reverse proxy, adjust `PUBLIC_API_BASE` in `vps/compose.fleet.yml` to the externally visible path (for example `/fleet/api`). Leave it pointing at `/api` when using the bundled Caddy config.

## 4. Verify the UI and connections

1. `curl` the API from your laptop to confirm the bearer works:
   ```bash
   curl -H "Authorization: Bearer $API_BEARER" https://<vps-host>/api/devices
   ```
   You should see each device you defined in the registry.
2. Open `https://<vps-host>/operations` in a browser. Every entry from the registry appears with its operations, endpoints, and health badge. If an operation fails immediately, double-check the `api.base_url`, HTTP method, and bearer token mapping in the YAML.
3. Leave the tab open for a minute to ensure live updates arrive—the UI uses the `/api/stream` SSE feed, so you should see status badges update without refreshing. If that stream disconnects, inspect the reverse-proxy logs (Caddy) for timeouts and make sure port 443 remains open.

Following this workflow keeps the Git repository, Prometheus targets, API database, and UI perfectly aligned—edit the registry once, validate, sync, and the VPS stack will reflect the new control surface automatically.
