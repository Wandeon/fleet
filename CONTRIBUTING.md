# Contributing

## Required Checks Before Opening a PR

- Run `npm run openapi:generate` whenever `apps/api/openapi.yaml` (or other OpenAPI sources) changes, and commit the regenerated client under `apps/ui/src/lib/api/gen` in the same PR.
- Ensure CI passes locally where practical; the remote pipeline blocks out-of-date generated clients, but running the generator before you push avoids wasted cycles.

## Optional Tooling

- You can add a pre-commit hook that runs `npm run openapi:generate` to catch spec drift locally before pushing. One simple approach is to create `.git/hooks/pre-commit` with that command and make it executable (`chmod +x`).
