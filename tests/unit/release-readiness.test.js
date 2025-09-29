#!/usr/bin/env node

/**
 * Unit test for Release Readiness truthfulness logic
 *
 * Tests that the release readiness report correctly shows "NOT READY"
 * when upstream CI gates fail (security issues, build failures, etc.)
 */

function testReleaseReadinessLogic() {
  console.log('🧪 Testing Release Readiness Logic...');

  // Test cases for different failure scenarios
  const testCases = [
    {
      name: 'SECURITY_ISSUES=1 should result in NOT READY',
      inputs: {
        SECURITY_ISSUES: 1,
        TYPECHECK_FAIL: 0,
        BUILD_FAIL: 0,
        SMOKE_FAIL: 0,
        CONTRACT_FAIL: 0,
        PLACEHOLDER_GUARD_FAIL: 0,
        CONTRACT_STATUS: '✅ No changes',
        MIGRATION_STATUS: '✅ No changes',
        PORT_STATUS: '✅ Synchronized',
        INVENTORY_STATUS: '✅ Synchronized',
        SECURITY_STATUS: '❌ Issues found',
        BUILD_STATUS: '✅ Passing',
        PLACEHOLDER_STATUS: '✅ Clean'
      },
      expected: 'NOT READY'
    },
    {
      name: 'TYPECHECK_FAIL=1 should result in NOT READY',
      inputs: {
        SECURITY_ISSUES: 0,
        TYPECHECK_FAIL: 1,
        BUILD_FAIL: 0,
        SMOKE_FAIL: 0,
        CONTRACT_FAIL: 0,
        PLACEHOLDER_GUARD_FAIL: 0,
        CONTRACT_STATUS: '✅ No changes',
        MIGRATION_STATUS: '✅ No changes',
        PORT_STATUS: '✅ Synchronized',
        INVENTORY_STATUS: '✅ Synchronized',
        SECURITY_STATUS: '✅ Clean',
        BUILD_STATUS: '❌ Failing',
        PLACEHOLDER_STATUS: '✅ Clean'
      },
      expected: 'NOT READY'
    },
    {
      name: 'All green should result in READY TO DEPLOY',
      inputs: {
        SECURITY_ISSUES: 0,
        TYPECHECK_FAIL: 0,
        BUILD_FAIL: 0,
        SMOKE_FAIL: 0,
        CONTRACT_FAIL: 0,
        PLACEHOLDER_GUARD_FAIL: 0,
        CONTRACT_STATUS: '✅ No changes',
        MIGRATION_STATUS: '✅ No changes',
        PORT_STATUS: '✅ Synchronized',
        INVENTORY_STATUS: '✅ Synchronized',
        SECURITY_STATUS: '✅ Clean',
        BUILD_STATUS: '✅ Passing',
        PLACEHOLDER_STATUS: '✅ Clean'
      },
      expected: 'READY TO DEPLOY'
    },
    {
      name: 'Placeholder warnings should result in READY WITH CAUTION',
      inputs: {
        SECURITY_ISSUES: 0,
        TYPECHECK_FAIL: 0,
        BUILD_FAIL: 0,
        SMOKE_FAIL: 0,
        CONTRACT_FAIL: 0,
        PLACEHOLDER_GUARD_FAIL: 0,
        CONTRACT_STATUS: '✅ No changes',
        MIGRATION_STATUS: '✅ No changes',
        PORT_STATUS: '✅ Synchronized',
        INVENTORY_STATUS: '✅ Synchronized',
        SECURITY_STATUS: '✅ Clean',
        BUILD_STATUS: '✅ Passing',
        PLACEHOLDER_STATUS: '⚠️ 3 found'
      },
      expected: 'READY WITH CAUTION'
    }
  ];

  let passed = 0;
  let failed = 0;

  for (const testCase of testCases) {
    const result = determineOverallStatus(testCase.inputs);
    const success = result.includes(testCase.expected);

    if (success) {
      console.log(`✅ PASS: ${testCase.name}`);
      passed++;
    } else {
      console.log(`❌ FAIL: ${testCase.name}`);
      console.log(`   Expected: ${testCase.expected}`);
      console.log(`   Got: ${result}`);
      failed++;
    }
  }

  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('❌ Release readiness logic has bugs!');
    process.exit(1);
  } else {
    console.log('✅ Release readiness logic is correct!');
    process.exit(0);
  }
}

/**
 * Replicate the logic from the GitHub Actions workflow
 */
function determineOverallStatus(inputs) {
  const {
    SECURITY_ISSUES,
    TYPECHECK_FAIL,
    BUILD_FAIL,
    SMOKE_FAIL,
    CONTRACT_FAIL,
    PLACEHOLDER_GUARD_FAIL,
    CONTRACT_STATUS,
    MIGRATION_STATUS,
    PORT_STATUS,
    INVENTORY_STATUS,
    SECURITY_STATUS,
    BUILD_STATUS,
    PLACEHOLDER_STATUS
  } = inputs;

  // Check all failure flags first
  if (SECURITY_ISSUES === 1 || TYPECHECK_FAIL === 1 || BUILD_FAIL === 1 ||
      SMOKE_FAIL === 1 || CONTRACT_FAIL === 1 || PLACEHOLDER_GUARD_FAIL === 1) {
    return '🚫 **NOT READY** - Critical upstream failures detected';
  }

  // Check status strings for critical issues
  if (CONTRACT_STATUS.includes('❌') || MIGRATION_STATUS.includes('❌') ||
      PORT_STATUS.includes('❌') || INVENTORY_STATUS.includes('❌') ||
      SECURITY_STATUS.includes('❌') || BUILD_STATUS.includes('❌')) {
    return '🚫 **NOT READY** - Critical issues must be resolved';
  }

  // Check for warnings
  if (PLACEHOLDER_STATUS.includes('⚠️')) {
    return '⚠️ **READY WITH CAUTION** - Review placeholder implementations';
  }

  // All good
  return '✅ **READY TO DEPLOY**';
}

// Run tests if called directly
if (require.main === module) {
  testReleaseReadinessLogic();
}

module.exports = { determineOverallStatus, testReleaseReadinessLogic };