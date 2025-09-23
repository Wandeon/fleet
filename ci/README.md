# Continuous Integration & Deployment

This repository uses two primary GitHub Actions workflows:

- `.github/workflows/ci.yml` runs on every pull request. It lint-checks the repository,
  type-checks and builds the API/UI with the Node toolchain, runs unit, integration,
  and Playwright smoke tests (with mocked acceptance checks), validates the OpenAPI
  contract, and captures Lighthouse scores. Docker is **not** required in this
  workflow so contributors get fast feedback without the GHCR credentials.
- `.github/workflows/deploy-vps.yml` runs on the `main` branch. It builds and pushes
  the API and UI images to GHCR using Docker Buildx, syncs the repository to the VPS,
  executes `scripts/vps-deploy.sh`, probes the deployed services, and runs the
  real acceptance suite. A commit comment summarises the deployment outcome.

These workflows keep build/test feedback on pull requests quick while ensuring the
main branch still exercises the full containerised deployment path.
