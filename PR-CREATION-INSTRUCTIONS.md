# PR Creation Instructions - D1 Audio Build Fix

**Status**: ✅ Branch pushed, ready for PR creation
**Branch**: `fix/audio-d1-build-typing`
**Target**: `main`

## PR Creation URL
Visit: https://github.com/Wandeon/fleet/pull/new/fix/audio-d1-build-typing

## PR Details

### Title
```
fix(api/audio): unblock D1 build (typing + zod record)
```

### Description
```markdown
## Problem

TypeScript compilation errors are blocking D1 deployment. Two type mismatches prevent Docker image builds:

1. **Interface vs Schema mismatch**: `PlaylistTrackInput.order` required in interface but optional in Zod schema
2. **Zod API change**: `z.record()` now requires both key and value types

## Solution

**Two surgical fixes, zero API surface changes:**

### Fix A: Make interface match schema (apps/api/src/services/audio.ts:115)
```diff
- order: number;
+ order?: number;
```
- Aligns interface with Zod schema that marks order as optional
- Service already handles missing order with fallback: `track.order ?? index`
- No behavioral change - just type consistency

### Fix B: Update Zod record signature (apps/api/src/util/schema/audio.ts:13)
```diff
- deviceOverrides: z.record(z.string()).optional()
+ deviceOverrides: z.record(z.string(), z.string()).optional()
```
- Matches current Zod API requiring explicit key and value types
- Maintains same validation behavior

## Validation ✅

**Local validation passed:**
- `npm run typecheck` ✅ Clean TypeScript compilation
- `npm run build` ✅ Successful build
- `npm run test` ✅ All 21 tests pass including audio integration tests
- `npm run contract` ✅ OpenAPI validation clean

**No side effects:**
- Zero API surface changes (routes, responses unchanged)
- Zero OpenAPI contract changes (same endpoints, same schemas)
- Zero functional changes (same validation behavior)

## Evidence References

- **BUILD-ERROR-REPORT.md** - Complete technical analysis of errors
- **EVIDENCE-PACKAGE.md** - Full deployment context and impact assessment

## Impact

**Unblocks**: D1 audio features deployment to production
**Enables**: Full audio daily-use workflows (playlists, multi-device sync, controls)
**Risk**: Minimal - pure typing fixes with comprehensive test validation

## Next Steps

After merge: Ready for ops team to execute D1 deployment (rebuild images, deploy, validate)

---

**This PR contains exactly 2 lines changed across 2 files - the minimal fixes to unblock D1 deployment.**
```

## Commit Summary

**Files changed**: 2
**Lines changed**: 2 insertions, 2 deletions

### Changes:
1. `apps/api/src/services/audio.ts` - Line 115: `order: number;` → `order?: number;`
2. `apps/api/src/util/schema/audio.ts` - Line 13: `z.record(z.string())` → `z.record(z.string(), z.string())`

## Local Validation Results

✅ **TypeScript**: `npm run typecheck` - Clean compilation
✅ **Build**: `npm run build` - Successful build
✅ **Tests**: `npm run test` - 21/21 tests passed
✅ **Contract**: `npm run contract` - Spectral validation clean
✅ **Prisma**: Client generation successful

## Post-Merge Actions Required

Once merged, notify Ops team:
> **"D1 Fixes merged — ready to build & deploy"**

Ops will execute the pre-approved D1 rollout:
1. Rebuild API/UI images with fixes
2. Apply D1 database migration
3. Deploy updated containers
4. Validate audio workflows on real devices
5. Capture evidence package

**Expected deployment time**: ~30 minutes after merge