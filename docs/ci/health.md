# CI Health Dashboard

This guide summarizes the checks that run in Fleet's continuous integration (CI) pipeline, highlights the areas that fail most often, and explains how to reproduce the jobs locally and reason about their output.

## Pipeline overview

The main `CI` workflow fans out across a Node.js version matrix (`20.x` and `22.x`) for each job, so the same step may run twice per workflow execution.【F:.github/workflows/ci.yml†L23-L151】 The jobs execute in the following order:

- **`lint`** – Installs API and UI dependencies, then runs ESLint in both projects, a Prettier formatting check across the repo, and Shellcheck on scripts under `scripts/` and `roles/`.【F:.github/workflows/ci.yml†L23-L67】
- **`typecheck`** – Uses TypeScript tooling to type check the API and UI packages.【F:.github/workflows/ci.yml†L69-L101】
- **`build`** – Rebuilds both applications; the API build step ensures a `dist/` directory exists before succeeding.【F:.github/workflows/ci.yml†L103-L142】
- **`test`** – Prepares Playwright browsers, runs Vitest for the UI, generates and validates Prisma client artifacts, runs API Vitest suites, executes Playwright end-to-end tests, and runs the mocked acceptance smoke script while uploading junit/coverage/acceptance artifacts.【F:.github/workflows/ci.yml†L144-L353】
- **`contract`** – Verifies that the API OpenAPI document exists and passes Spectral linting.【F:.github/workflows/ci.yml†L354-L385】
- **`lighthouse`** – Builds the UI and runs Lighthouse CI, publishing summary scores as PR comments and workflow summaries.【F:.github/workflows/ci.yml†L387-L509】
- **`agent-quality`** – Runs Shellcheck against agent scripts and validates the agent inventory metadata.【F:.github/workflows/ci.yml†L511-L520】

## Frequent failure hotspots

- **Formatting & linting:** ESLint is strict (`--max-warnings=0` on the API) and Prettier runs on every Markdown, JSON, JS/TS, and Svelte file, so new files or quick edits often break the `lint` job. Fix by running the local lint/format commands listed below.【F:.github/workflows/ci.yml†L48-L58】【F:apps/api/package.json†L18-L19】【F:apps/ui/package.json†L12-L13】
- **Type errors:** The `typecheck` job fails whenever either package has unresolved TypeScript errors (missing exports, mismatched types, etc.). Run the package-specific typecheck scripts to reproduce and watch for differences between the Node 20 and Node 22 runs when conditional types are involved.【F:.github/workflows/ci.yml†L69-L101】【F:apps/api/package.json†L18-L20】【F:apps/ui/package.json†L11-L15】
- **Build regressions:** API builds fail if `npm run build` does not emit `dist/`, while UI builds surface Vite compilation and Svelte template errors. Watch for missing generated files, circular dependencies, or syntax issues that surface only during production builds.【F:.github/workflows/ci.yml†L130-L142】【F:apps/api/package.json†L13-L14】【F:apps/ui/package.json†L7-L11】
- **Tests & mocks:** The `test` job aggregates several independent stages. UI Vitest failures usually mean broken Svelte component tests or stale snapshots; API Vitest failures often track schema or mock API changes. Playwright flakes typically stem from timing issues—rerun locally with `npm run test:ui`. The Prisma generate/validate steps fail when schema migrations are missing or local changes were not generated. The mocked acceptance script asserts `/healthz`, `/status`, ALSA device availability, and optional Icecast playback, so changes to endpoints or log formatting can cause regressions.【F:.github/workflows/ci.yml†L191-L289】【F:apps/api/package.json†L14-L23】【F:apps/ui/package.json†L14-L18】【F:scripts/acceptance.sh†L5-L190】
- **API contract drift:** If you update API handlers without regenerating `openapi.yaml` or the generated UI client, the `contract` job fails either because the spec is missing or Spectral reports rule violations. Use the OpenAPI commands below to keep specs synchronized.【F:.github/workflows/ci.yml†L354-L385】【F:package.json†L10-L15】
- **Performance regressions:** Lighthouse failures signal degraded performance, accessibility, best practices, or SEO scores, or an inability to start the preview server. Check the summary artifact for category-specific scores.【F:.github/workflows/ci.yml†L387-L509】
- **Agent tooling:** Shellcheck output or inventory validation errors in `agent-quality` indicate problems with bash scripts or YAML definitions under `agent/`. Fix the highlighted file and rerun Shellcheck locally.【F:.github/workflows/ci.yml†L511-L520】

## Running checks locally

1. **Install dependencies:** run `npm ci` inside both `apps/api` and `apps/ui` to mirror CI’s setup.【F:.github/workflows/ci.yml†L40-L46】
2. **Lint & format:**
   - API – `npm run lint` (ESLint) and optionally `npm run lint -- --fix` for auto-fixes.【F:apps/api/package.json†L18-L19】
   - UI – `npm run lint` and `npm run format` for Prettier autofix.【F:apps/ui/package.json†L12-L13】
   - Global formatting – `npx prettier --write "**/*.{cjs,js,json,md,ts,svelte,yml,yaml}"` to mirror the workflow’s check.【F:.github/workflows/ci.yml†L56-L58】
3. **Type checking:** `npm run typecheck` in both `apps/api` and `apps/ui` to catch compile-time issues.【F:apps/api/package.json†L19-L20】【F:apps/ui/package.json†L11-L12】
4. **Build artifacts:** `npm run build` in each package to validate production builds and Prisma output.【F:apps/api/package.json†L13-L14】【F:apps/ui/package.json†L7-L8】
5. **Automated tests:**
   - UI unit tests – `npm run test` inside `apps/ui` (Vitest).【F:apps/ui/package.json†L14-L15】
   - API unit tests – `npm test` inside `apps/api` (Vitest).【F:apps/api/package.json†L20-L21】
   - Playwright – `npm run test:ui` from `apps/ui` for browser E2Es.【F:apps/ui/package.json†L16-L17】
   - Acceptance smoke – `npm run acceptance` from the repo root or invoke `scripts/acceptance.sh` directly with the hosts you need to verify for integration scenarios.【F:package.json†L10-L10】【F:scripts/acceptance.sh†L7-L190】
6. **Database tooling:** Run `npx prisma generate` and `npx prisma validate` in `apps/api` if you modify Prisma schema files to ensure migrations stay consistent with CI.【F:.github/workflows/ci.yml†L208-L214】
7. **API contract:**
   - Update the shared spec with `npm run openapi:generate` to refresh the UI client, and lint it with `npm run openapi:lint`.【F:package.json†L13-L15】
   - Run `npm run contract` in `apps/api` for the same Spectral lint applied in CI.【F:apps/api/package.json†L22-L23】
8. **Lighthouse:** Execute `npm run lighthouse` from `apps/ui` after running `npm run build` to inspect performance locally.【F:apps/ui/package.json†L17-L18】
9. **Agent scripts:** Use `shellcheck agent/*.sh agent/tests/*.sh agent/watchdog-health.sh` and `agent/validate-inventory.sh` to mimic the `agent-quality` job.【F:.github/workflows/ci.yml†L511-L520】

## Interpreting CI output

- **Matrix awareness:** Each job label includes the Node version (e.g., `lint (node 20.x)`), so confirm whether a failure happens on both versions or just one—the latter usually highlights language or dependency compatibility issues.【F:.github/workflows/ci.yml†L23-L400】
- **Lint & format logs:** ESLint failures list offending files with rules at the bottom of the log; Prettier prints `Code style issues found in the above file(s).` when formatting is required. Apply the suggested fixes and rerun the command locally.【F:.github/workflows/ci.yml†L48-L58】
- **TypeScript stack traces:** Typecheck failures emit `error TSxxxx` messages; match them against the package you ran (API vs UI) to identify the file path and fix the type definition before rebuilding.【F:.github/workflows/ci.yml†L69-L101】
- **Build failures:** The API build step explicitly errors if `dist/` is missing, while UI build output mirrors Vite’s CLI formatting—look for `✘` markers and stack traces. Address compile errors before re-running the tests job.【F:.github/workflows/ci.yml†L130-L142】
- **Test artifacts:** When the `test` job fails, download the relevant junit or coverage artifact to inspect detailed failure messages. Acceptance logs summarize every mocked device and Icecast check, using color-coded `OK/WARN/ERR` lines that correspond to the script’s exit codes.【F:.github/workflows/ci.yml†L191-L309】【F:scripts/acceptance.sh†L70-L190】
- **Contract diagnostics:** Spectral reports list rule names (e.g., `operation-tags`) and offending paths; when the job fails at “Ensure OpenAPI exists,” confirm that `apps/api/openapi.yaml` was committed.【F:.github/workflows/ci.yml†L354-L385】
- **Lighthouse summaries:** PR comments and workflow summaries include the numeric scores per category; regressions typically show scores below the project thresholds, prompting additional tuning or deferring via Lighthouse assertions.【F:.github/workflows/ci.yml†L387-L509】
- **Agent validation:** Shellcheck output includes line numbers and rule identifiers; fix the highlighted script or configuration, then rerun the validation script locally until the job reports success.【F:.github/workflows/ci.yml†L511-L520】
