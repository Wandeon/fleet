# Repository Discipline

## OpenAPI Contract Management

### Single Source of Truth
The OpenAPI specification at `apps/api/openapi.yaml` is the **single source of truth** for our API contract.

### Client Generation Rule
**Any change to the OpenAPI specification MUST include regenerated client files.**

#### When to Regenerate
Run client regeneration whenever you:
- Add new endpoints
- Modify request/response schemas
- Change parameter definitions
- Update API metadata

#### How to Regenerate
Use the standardized script:
```bash
./scripts/generate-openapi-clients.sh
```

This script will:
1. Validate the OpenAPI specification
2. Generate the fetch client for UI (`apps/ui/src/lib/api/gen/`)
3. Generate TypeScript types (`apps/ui/src/lib/api/generated/`)

#### Committing Generated Files
**Always commit generated files** along with your API changes:
```bash
git add apps/api/openapi.yaml
git add apps/ui/src/lib/api/gen/
git add apps/ui/src/lib/api/generated/
git commit -m "feat: add new audio upload endpoint with generated clients"
```

### CI Enforcement
The `contract-check.yml` workflow enforces this discipline:
- ✅ Validates OpenAPI specification syntax
- ✅ Regenerates clients and checks for drift
- ❌ Fails if generated files don't match the spec
- ❌ Fails if there are uncommitted generated files

### Manual Override (Emergency Only)
In critical situations, you can temporarily skip client generation:
1. Add `[skip contract]` to your commit message
2. Create a follow-up issue to regenerate clients
3. Never merge to main without proper client generation

## Database Migration Discipline

### Migration Requirements
All database schema changes MUST include proper Prisma migrations:

```bash
# Create migration
npx prisma migrate dev --name descriptive_migration_name

# Validate migration
npx prisma migrate deploy
```

### Migration Testing
Every migration must:
- Apply cleanly to an empty database
- Not break existing data
- Include rollback instructions in comments

## Feature Flag Discipline

### Placeholder Code Rules
**No placeholder implementations in critical workflows without:**
1. A feature flag to disable in production
2. A test that validates the placeholder behavior
3. Documentation of the planned implementation

Example:
```typescript
// ❌ BAD: Unguarded placeholder
export function uploadAudio() {
  throw new Error("TODO: implement audio upload");
}

// ✅ GOOD: Guarded placeholder
export function uploadAudio() {
  if (!featureFlags.AUDIO_UPLOAD_ENABLED) {
    throw new Error("Audio upload is disabled");
  }
  // TODO: implement actual upload logic
  throw new Error("Audio upload not yet implemented");
}
```

### Critical Workflows
These workflows require special attention:
- Audio upload (`/audio/library`, `/audio/devices/{id}/upload`)
- Zigbee pairing (`/zigbee/pair`)
- Camera switching (`/camera/active`)
- Log streaming (`/logs/stream`)

## Documentation Standards

### API Documentation
- Every endpoint must have OpenAPI documentation
- Include example requests and responses
- Document error codes and their meanings

### Infrastructure Documentation
- Document port mappings in deployment configs
- Explain environment variable requirements
- Include troubleshooting guides

### Runbook Requirements
- Include step-by-step procedures
- Reference CI artifacts and automation
- Provide manual fallback procedures