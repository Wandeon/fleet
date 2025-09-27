import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importFeatures = async () => {
  const module = await import('$lib/config/features');
  return module;
};

const importNav = async () => {
  const module = await import('$lib/nav');
  return module;
};

describe('camera feature flag', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('disables camera navigation when feature flag is off', async () => {
    vi.stubEnv('VITE_FEATURE_CAMERA', '0');

    const { featureFlags } = await importFeatures();
    expect(featureFlags.camera).toBe(false);

    const { mainNavigation } = await importNav();
    expect(mainNavigation.some((item) => item.path === '/camera')).toBe(false);
  });

  it('enables camera navigation when feature flag is on', async () => {
    vi.stubEnv('VITE_FEATURE_CAMERA', '1');

    const { featureFlags } = await importFeatures();
    expect(featureFlags.camera).toBe(true);

    const { mainNavigation } = await importNav();
    expect(mainNavigation.some((item) => item.path === '/camera')).toBe(true);
  });
});
