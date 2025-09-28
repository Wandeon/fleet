#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Module Smoke Tests - Individual endpoint verification
 *
 * Tests each module's overview endpoint to ensure basic connectivity.
 * These tests correspond to the "Module Smoke Tests (audio)" etc. checks
 * that were referenced in CI but were missing from the repository.
 *
 * Part of CI-FIXES: Systematic recovery from PR #123 failures
 */

const apiPort = Number.parseInt(process.env.API_HTTP_PORT ?? '3015', 10);
const apiBearer = process.env.API_BEARER ?? 'ci-test-bearer';

// Module configurations for smoke testing
const MODULES = [
  { name: 'audio', endpoint: '/api/audio/overview' },
  { name: 'video', endpoint: '/api/video/overview' },
  { name: 'zigbee', endpoint: '/api/zigbee/overview' },
  { name: 'camera', endpoint: '/api/camera/overview' },
  { name: 'logs', endpoint: '/api/logs/overview' },
  { name: 'fleet', endpoint: '/api/fleet/overview' }
];

async function testModuleEndpoint(module) {
  const { name, endpoint } = module;
  const url = `http://127.0.0.1:${apiPort}${endpoint}`;

  console.log(`[${name}] Testing endpoint: ${endpoint}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiBearer}`,
        'Accept': 'application/json'
      },
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      console.log(`✅ [${name}] GET ${endpoint} responded with ${response.status}`);
      return { module: name, status: 'PASS', details: `${response.status} OK` };
    } else {
      console.error(`❌ [${name}] GET ${endpoint} failed with ${response.status}`);
      return { module: name, status: 'FAIL', details: `${response.status} ${response.statusText}` };
    }
  } catch (error) {
    console.error(`❌ [${name}] GET ${endpoint} failed: ${error.message}`);
    return { module: name, status: 'FAIL', details: error.message };
  }
}

async function runModuleSmokeTests() {
  console.log('🔍 Starting Module Smoke Tests...');
  console.log(`API Base: http://127.0.0.1:${apiPort}`);
  console.log(`Authentication: Bearer token configured`);
  console.log(`Modules to test: ${MODULES.map(m => m.name).join(', ')}`);
  console.log('');

  const results = [];

  // Test each module sequentially to avoid overwhelming the API
  for (const module of MODULES) {
    const result = await testModuleEndpoint(module);
    results.push(result);

    // Brief pause between tests
    await new Promise(resolve => setTimeout(resolve, 250));
  }

  console.log('');
  console.log('📊 Module Smoke Test Results:');
  console.log('');

  const passed = results.filter(r => r.status === 'PASS');
  const failed = results.filter(r => r.status === 'FAIL');

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`${icon} ${result.module.padEnd(8)} | ${result.details}`);
  });

  console.log('');
  console.log(`Summary: ${passed.length}/${results.length} modules passing`);

  if (failed.length > 0) {
    console.log('');
    console.log('❌ Failed modules require investigation:');
    failed.forEach(result => {
      console.log(`   • ${result.module}: ${result.details}`);
    });
    console.log('');
    console.error('Module smoke tests FAILED');
    process.exit(1);
  } else {
    console.log('');
    console.log('✅ All module smoke tests PASSED');
    process.exit(0);
  }
}

// Execute if run directly
if (require.main === module) {
  runModuleSmokeTests().catch(error => {
    console.error(`Module smoke tests failed: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { runModuleSmokeTests, testModuleEndpoint, MODULES };