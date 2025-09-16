# API Container: ES Module Startup Failures

## Symptoms
- `api` service exits immediately during startup.
- Logs show `SyntaxError: Cannot use import statement outside a module` for files such as `src/server.js`.
- Nginx reverse proxy reports `502 Bad Gateway` on `/api/health`.

## Root Cause
The API codebase is written as native ECMAScript Modules, but the runtime fell back to CommonJS mode. This happened when hosts
or containers executed Node.js without an explicit module declaration, so the interpreter rejected `import` statements.

## Resolution
Adopt **Option A** from the triage report: declare the project as ESM so every runtime (local dev, CI, containers) loads the same
module mode.

- `api/package.json` now contains `"type": "module"` and an engines guard (`>= 18.18.0`).
- Hosts are converged to Node.js 20.x via the Claude tooling bootstrapper so even bare-metal runs support ESM semantics.
- No file renames or experimental flags are required; both compose builds and `npm start` work without overrides.

## Acceptance Checklist
1. Rebuild the API image or restart the container: `docker compose up -d api` (or redeploy the host role).
2. Inspect logs: `docker logs <api-container>` should report `API listening on :3005` with no import errors.
3. Verify health endpoint: `curl -fsS http://<host>:3005/api/health` returns JSON and exit code 0.
4. Check reverse proxy: hitting `/api/health` through Nginx (or the UI dashboard) returns 200 instead of 502.
5. Confirm Node version on the host (`node -v`) shows `v20.x` after convergence.

If any step fails, rerun the role agent (`sudo /opt/fleet/agent/role-agent.sh`) and consult the agent log for
`[setup-claude-tools]` messages to confirm Node installation succeeded.
