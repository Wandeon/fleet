# Audio Streaming Security Runbook

This runbook hardens the audio streaming stack (Icecast + audio-player control API) so only trusted operators can modify playback.

## 1. Restrict the control API (`:8081`)

1. **Keep it off the public internet.**
   - Bind Pi management interfaces to private networks (Tailscale, WireGuard, or RFC1918 LAN).
   - Do not port-forward `:8081` from residential routers or expose it via cloud firewalls.
2. **Enforce host firewalls.**
   - Use `ufw` or `nftables` on each Pi to allow only the VPS management subnet or Tailscale range:
     ```bash
     sudo ufw allow in on tailscale0 to any port 8081 proto tcp
     sudo ufw deny 8081
     sudo ufw status
     ```
3. **Register the private endpoints.**
   - Use Tailscale DNS names (e.g., `pi-audio-01.tailnet.ts.net`) inside [`inventory/device-interfaces.yaml`](../../inventory/device-interfaces.yaml) and `vps/targets-audio.json`.

## 2. Require bearer tokens for every API call

1. Set `AUDIO_CONTROL_TOKEN` in `roles/audio-player/.env` before encrypting with SOPS. This flows into `AUTH_TOKEN` for the `audio-control` container (`roles/audio-player/40-app.yml`).
2. Confirm `scripts/audioctl.sh` receives the token via `AUDIOCTL_TOKEN`:
   ```bash
   export AUDIOCTL_TOKEN=$(openssl rand -hex 16)
   sops --encrypt --age <YOUR-AGE-PUBLIC-KEY> <<<'AUDIO_CONTROL_TOKEN='"${AUDIOCTL_TOKEN}" > roles/audio-player/.env.sops.enc
   ```
3. Rotate tokens quarterly:
   - Generate a new token, update `.env`, re-encrypt, and commit.
   - Run `./scripts/audioctl.sh status` against every Pi using the new token to verify deployment.
   - Revoke the old value from any secrets manager or shared notes.
4. Monitor authentication failures.
   - Tail `audio-control` logs (`docker logs -f`) and Grafana Loki dashboards for repeated `401` responses.

## 3. Favor private overlay networks

1. Join all Pis and the VPS to Tailscale.
2. Use ACLs to restrict who can reach `:8081` and Icecast `:8000`. Example (Tailscale ACL snippet):
   ```json
   {
     "acls": [
       {"action": "accept", "src": ["vps"], "dst": ["pi-audio-01:8081", "pi-audio-02:8081"]},
       {"action": "accept", "src": ["ops"], "dst": ["vps:8000"]}
     ]
   }
   ```
3. Avoid exposing the VPS management interface broadly; if public access is required, use HTTPS reverse proxies with authentication (see `vps/nginx.conf`).

## 4. Harden Icecast (`vps/compose.icecast.yml`)

1. **Strong credentials.** Populate `vps/icecast.env` with unique passwords:
   - `ICECAST_SOURCE_PASSWORD`
   - `ICECAST_RELAY_PASSWORD`
   - `ICECAST_ADMIN_PASSWORD`
2. **Disable default accounts.** Remove or rename the default `source` and `admin` usernames if you publish the stream publicly; document new names for operators.
3. **Limit ingress.**
   - Keep port 8000 exposed only when needed. Restrict management (`:8000/admin`) via firewall rules to trusted IPs.
   - When possible, serve the public stream behind a CDN or reverse proxy that can rate-limit abusive listeners.
4. **Monitor for brute-force attempts.**
   - Enable Promtail (`baseline/promtail`) to ship Icecast logs to Loki.
   - Create Grafana alerts for repeated auth failures or high listener counts.
5. **TLS and headers.**
   - If the stream must be encrypted, terminate TLS via the VPS reverse proxy (see `vps/nginx.conf` or `vps/caddy.fleet.Caddyfile`).

## 5. Incident response

1. On suspected compromise, immediately rotate `AUDIO_CONTROL_TOKEN` and all Icecast passwords.
2. Stop the audio-control container while investigating:
   ```bash
   ssh admin@pi-audio-01 'docker stop $(docker ps -q --filter name=audio-control)'
   ```
3. Review logs in Grafana Loki for unauthorized actions.
4. Rebuild the Pi from a known-good image (see [`operator-checklist.md`](./operator-checklist.md)) if tampering is detected.
5. Document findings and update ACLs/policies to prevent recurrence.
