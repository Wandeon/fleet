# CI Ship Mode Audit

| Workflow | Purpose | Blocking? | Flake risk | Keep/Defer |
| --- | --- | --- | --- | --- |
| CI Essentials (`ci.yml`) | PR gate covering TypeScript checks, builds, OpenAPI drift, and JS smoke script on Node 20.x | Yes (PR) | Medium – relies on repeated `npm ci` installs and build output; smoke step depends on local services starting cleanly | Keep blocking, core merge bar |
| API Contract CI (`contract-ci.yml`) | Redundant OpenAPI lint/generation and mock probes also run during PRs touching API/UI | No (extra) | Medium – extra `npm install` calls plus starting mock server and timed curl probes can time out | Defer/merge into CI Essentials |
| CI Nightly (`ci-nightly.yml`) | Scheduled lint/tests, mocked acceptance, Lighthouse, inventory audit on Node 20.x | No (informational) | High – heavy Playwright/browser work, artifact handling, Python/Node installs may hit network flakes | Keep optional nightly signal |
| Nightly Acceptance QA (`acceptance.yml`) | Scheduled real-environment acceptance run against staging with Playwright | No (informational) | High – depends on staging SSH, secrets, external services | Keep optional, monitor failures |
| Deploy to VPS (`deploy-vps.yml`) | Main-branch build, image publish, remote deploy and post-deploy acceptance | No (release) | High – GHCR pushes, SSH/rsync, remote health checks | Keep (release automation) |
| Docs validation (`docs.yml`) | Markdown lint and docs artifact packaging on main using Node 20 | No (post-merge) | Low – markdownlint and tarball; npm install not required | Keep optional |
| Rollback deployment (`rollback.yml`) | Manual rollback script trigger on VPS | No (manual) | Medium – depends on SSH connectivity to prod | Keep manual tool |

## Notes
- All Node-based jobs pin to Node 20/20.x via `actions/setup-node@v4`; workflows without Node setup (deploy/rollback) run shell/Docker tooling only.【F:.github/workflows/ci.yml†L16-L186】【F:.github/workflows/contract-ci.yml†L24-L63】【F:.github/workflows/ci-nightly.yml†L21-L416】【F:.github/workflows/acceptance.yml†L9-L181】【F:.github/workflows/docs.yml†L11-L50】
- Contract validation runs twice: once in the `CI Essentials` `contract` job and again in `API Contract CI`. Consolidating them would reduce runtime and flake surface without losing coverage.【F:.github/workflows/ci.yml†L91-L138】【F:.github/workflows/contract-ci.yml†L24-L63】
- Nightly workflows layer additional acceptance tests (mocked vs. staging) and Lighthouse scores; they are valuable trend monitors but should remain non-blocking due to external dependencies and browser downloads.【F:.github/workflows/ci-nightly.yml†L143-L416】【F:.github/workflows/acceptance.yml†L9-L181】
