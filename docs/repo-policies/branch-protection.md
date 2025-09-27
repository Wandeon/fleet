# Branch Protection Policy

## Protected Branches

### `main` Branch
The `main` branch is protected with the following rules:

#### Required Status Checks
All of the following CI checks must pass before merge:
- ✅ **CI Essentials** (`ci.yml`) - TypeScript, build, test, lint
- ✅ **Contract Check** - OpenAPI client generation and drift detection
- ✅ **Database Migrations** - Migration validation and smoke tests
- ✅ **Infrastructure Checks** - Caddy/Compose port validation
- ✅ **Inventory Sync** - Device inventory vs monitoring targets
- ✅ **Acceptance Smoke** - Module-level endpoint validation
- ✅ **Release Readiness** - Artifact generation

#### Required Reviews
- **Minimum 1 review** from code owners
- **API team review** required for:
  - `apps/api/openapi.yaml`
  - `apps/api/src/**`
  - `apps/api/prisma/**`
- **Infrastructure team review** required for:
  - `infra/vps/**`
  - `*.Caddyfile`
  - `docker-compose*.yml`

#### Restrictions
- ❌ **No admin bypass** - Even repository admins must follow the rules
- ❌ **No force push** - History must be preserved
- ❌ **No deletion** - Branch cannot be deleted
- ✅ **Require branches to be up to date** - Must rebase on latest main

## Team Structure

### @fleet-team/api
Responsible for:
- Backend API development
- Database schema changes
- OpenAPI specification
- Core business logic

### @fleet-team/infra
Responsible for:
- Deployment configurations
- Infrastructure as code
- Monitoring setup
- Network and proxy configuration

## Setting Up Branch Protection

Repository administrators should configure these settings in GitHub:
1. Go to **Settings** → **Branches**
2. Add rule for `main` branch
3. Enable all required status checks listed above
4. Require review from code owners
5. Disable admin bypass
6. Require branches to be up to date

## Enforcement

These policies are enforced by:
- GitHub branch protection rules
- CODEOWNERS file automatic review requests
- CI pipeline status checks
- Release readiness validation

## Emergency Procedures

In case of critical production issues:
1. Create hotfix branch from `main`
2. Apply minimal fix
3. Fast-track review with both teams
4. Merge with all checks passing
5. Deploy immediately using release readiness artifact