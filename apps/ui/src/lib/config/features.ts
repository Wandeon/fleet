const defaultFeatureState = import.meta.env.DEV ? '0' : '1';

function resolveFlag(value: string | undefined): boolean {
  const raw = (value ?? defaultFeatureState).trim();
  return raw === '1';
}

export const featureFlags = {
  video: resolveFlag(import.meta.env.VITE_FEATURE_VIDEO),
  zigbee: resolveFlag(import.meta.env.VITE_FEATURE_ZIGBEE),
  camera: resolveFlag(import.meta.env.VITE_FEATURE_CAMERA)
} as const;

export type FeatureFlagKey = keyof typeof featureFlags;

export const isFeatureEnabled = (key: FeatureFlagKey): boolean => featureFlags[key];
