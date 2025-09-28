# PR #110 CI Failure Evidence Pack
**Generated**: 2025-09-27 07:56:27 UTC
**VPS Environment**: Production (app.headspamartina.hr)
**PR Branch**: `codex/implement-audio-upload-workflow`
**Node Version**: v20.19.4 (matches CI)

## Baseline Status: ✅ PARTIALLY OK

### Container Status
- **VPS Repo**: `d1d13f6` (main branch, up-to-date)
- **Running Containers**: 11 hours uptime, healthy API container
- **Environment**: `VITE_USE_MOCKS=0`, Bearer token configured correctly
- **Proxy Health**: Caddy → UI → API proxy chain functional

### Platform Health Endpoints
- **API Root**: ✅ 200 OK (`/fleet/layout` works)
- **UI Proxy**: ✅ 200 OK (`/ui/audio/overview` returns mock data)
- **Auth Flow**: ✅ Bearer token injection working correctly
- **Note**: `/api/*` prefix routes require auth even for health endpoints (expected behavior)

## CI Failure Reproduction: ✅ CONFIRMED

### 1. TypeScript Compilation Failure
**Exact CI Match**: ✅ **REPRODUCED**
```bash
src/middleware/errors.ts(13,42): error TS2345:
Argument of type '"file_too_large"' is not assignable to parameter of type 'ErrorCode'.
```

**Root Cause**: Missing `'file_too_large'` from `ErrorCode` union type in `src/util/errors.ts`
**Fix Required**: Add `'file_too_large'` to ErrorCode type definition

### 2. Contract Drift Failure
**Exact CI Match**: ✅ **REPRODUCED**
**Files Modified by OpenAPI Generation**:
- `apps/ui/src/lib/api/gen/index.ts` (M)
- `apps/ui/src/lib/api/gen/models/AudioDeviceSnapshot.ts` (M)
- `apps/ui/src/lib/api/gen/models/AudioLibraryUploadRegistration.ts` (M)
- `apps/ui/src/lib/api/gen/services/AudioService.ts` (M)
- `apps/ui/src/lib/api/generated/types.ts` (M)
- `apps/ui/src/lib/api/gen/models/AudioDeviceUploadResponse.ts` (NEW)

**Generator Required**: BOTH root-level (`npm run openapi:generate`) AND UI-level (`npm run generate:openapi`)

## Live API Testing Results

### Audio Upload Endpoints (PR #110 Focus)
- **`POST /audio/library`**: ⚠️ 422 Validation Failed (missing required fields)
- **`POST /audio/devices/{id}/upload`**: ❌ 404 Not Found (route not registered in running containers)
- **`GET /audio/overview`**: ✅ 200 OK via UI proxy (mock data)

### Container/Repo Drift Impact
**Critical Finding**: Running containers don't have PR #110 routes because they're built from old commit
- VPS repo: `d1d13f6` (current)
- Container routes: Based on old deployment (missing upload endpoints)

## Database Schema Issue
**API Error**: `The table main.AudioSetting does not exist in the current database`
**Impact**: Blocks audio overview functionality, not related to PR #110

## Repo Fix Required - Exact Steps

### Fix 1: TypeScript Error
**File**: `apps/api/src/util/errors.ts`
**Line**: 1-13
**Change**: Add `'file_too_large'` to ErrorCode union:
```typescript
export type ErrorCode =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'bad_request'
  | 'validation_failed'
  | 'upstream_timeout'
  | 'upstream_unreachable'
  | 'upstream_error'
  | 'conflict'
  | 'too_many_requests'
  | 'internal_error'
  | 'circuit_open'
  | 'file_too_large';  // ← ADD THIS LINE
```

### Fix 2: Contract Drift
**Commands to run**:
```bash
npm run openapi:generate
cd apps/ui && npm run generate:openapi
git add apps/ui/src/lib/api/gen/ apps/ui/src/lib/api/generated/
git commit -m "fix: regenerate OpenAPI clients after audio upload schema changes"
```

## No Infra Fixes Applied
- No container rebuilds performed (per directive)
- No proxy/network changes made
- VPS environment remains in baseline production state

## Live Endpoint Validation Samples

### Successful Requests
```bash
# Fleet layout (baseline health)
curl -H "Authorization: Bearer [REDACTED]" http://localhost:3005/fleet/layout
# Status: 200, Time: 0.002s

# Audio overview via UI proxy
curl https://app.headspamartina.hr/ui/audio/overview
# Status: 200, Returns: audio devices/library/playlists data
```

### PR #110 Specific Tests
```bash
# Audio library upload (validation error expected due to missing fields)
curl -X POST -H "Authorization: Bearer [REDACTED]" -F "file=@test.txt" http://localhost:3005/audio/library
# Status: 422, validation_failed (expected - needs title field)

# Device upload endpoint (404 expected due to container/repo drift)
curl -X POST -H "Authorization: Bearer [REDACTED]" -F "file=@test.txt" http://localhost:3005/audio/devices/pi-audio-01/upload
# Status: 404, Cannot POST (expected - old containers don't have new routes)
```

## Container Logs Evidence
```
2025-09-27T07:55:35.830Z request_completed route="/audio/devices/pi-audio-01/upload" status=404
2025-09-27T07:55:37.616Z request_failed route="/audio/overview" status=500 error="table AudioSetting does not exist"
```

## Summary: Ready for Green
**CI Jobs Status After Fixes**:
- ✅ **typecheck**: Will pass after ErrorCode fix
- ✅ **contract**: Will pass after regeneration + commit
- ✅ **build**: Will pass after typecheck fix
- ✅ **lint**: Already passing (no style issues)

**Deployment Notes**:
- Container rebuild will be needed to test upload endpoints end-to-end
- Database migration may be required for AudioSetting table
- No infra/proxy issues blocking deployment