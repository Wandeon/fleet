# Acceptance QA Runbook

## Purpose

The acceptance suite validates every deployment against the live device fleet, Icecast stream, backend API, and Fleet UI. It ensures audio players respond via the control API, Prometheus scrape targets stay healthy, and the dashboard renders even when backend data is mocked. These checks run automatically after each VPS deployment and on a nightly schedule for staging so regressions are caught before business hours.

## Running locally

1. Install dependencies for the acceptance harness:
   ```bash
   npm ci --prefix tests/acceptance
   npx --prefix tests/acceptance playwright install chromium
   ```
2. Provide credentials for SSH, API, and UI targets (see environment variables below).
3. Execute the suite from the repository root:
   ```bash
   npm run acceptance
   ```

The command executes Playwright API/UI tests, the audio device shell tests, and then writes JSON/JUnit reports under `reports/acceptance/`.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `SSH_USER` | SSH username for Raspberry Pi devices (defaults to `admin`). |
| `AUDIOCTL_TOKEN` | Bearer token for audio control API requests. |
| `ACCEPTANCE_API_TOKEN` or `FLEET_API_TOKEN` | Bearer token for Fleet API calls. |
| `ICECAST_URL` / `ACCEPTANCE_AUDIO_ICECAST_URL` | Icecast mount URL for HEAD checks. |
| `FLEET_API_BASE` | Base URL for API tests (e.g. `https://staging.example.com/api`). |
| `FLEET_UI_BASE` | Base URL for UI smoke test. |
| `FLEET_UI_EXPECTED_TITLE` | Marker text expected in UI HTML (defaults to `Head Spa Control`). |
| `ACCEPTANCE_INSECURE` | Set to `1` to disable TLS verification for self-signed certs. |

### Exit codes

The orchestrator exits with:

- `0` — all checks passed.
- `1` — warnings detected (non-critical but require follow-up).
- `2` — at least one error failed the acceptance criteria.

These codes propagate to CI so warnings mark the pipeline yellow and failures stop deployment.

## Reports and JSON output

Running the suite creates the following artifacts inside `reports/acceptance/`:

- `audio-summary.json` — structured output from `scripts/acceptance.sh` including per-host statuses and Prometheus scrape checks.
- `playwright-summary.json` — Playwright JSON reporter with API/UI test outcomes.
- `summary.json` — aggregated status combining audio and UI/API results (consumed by CI workflows).
- `audio-tests.xml` / `playwright-tests.xml` — JUnit XML for each suite, uploaded as GitHub Action artifacts.

The JSON structure follows:

```json
{
  "status": "pass|warn|fail",
  "counts": { "pass": 8, "warn": 1, "fail": 0 },
  "components": {
    "audio": { "counts": { ... }, "checks": [...] },
    "playwright": { "status": "pass", "counts": { ... } }
  }
}
```

Use this file to script follow-up automation or to debug specific failed checks.

## CI workflows

- **Post-deploy acceptance:** `.github/workflows/deploy-vps.yml` runs after the VPS deployment workflow, uploads reports, and comments on pull requests with the latest status.
- **Nightly staging run:** `.github/workflows/acceptance.yml` executes every night at 02:30 UTC against staging and opens a GitHub issue (label `acceptance-failure`) when failures occur.

Both workflows publish artifacts (`acceptance-reports`) containing JSON and JUnit files for triage. Review the GitHub Action summary for the aggregated results table.
