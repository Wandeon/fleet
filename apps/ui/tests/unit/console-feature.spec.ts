import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const importFeatures = async () => {
  const module = await import('$lib/config/features');
  return module;
};

describe('console feature flag', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to disabled when env flag is absent', async () => {
    vi.unstubAllEnvs();

    const { featureFlags } = await importFeatures();
    expect(featureFlags.console).toBe(false);
  });

  it('enables console when env flag is set', async () => {
    vi.stubEnv('VITE_FEATURE_CONSOLE', '1');

    const { featureFlags } = await importFeatures();
    expect(featureFlags.console).toBe(true);
  });
});
