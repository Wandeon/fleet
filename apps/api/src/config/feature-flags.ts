/**
 * Feature Flag Registry
 *
 * Controls feature availability and placeholder behavior in production.
 * All new features should be feature-flagged until fully implemented.
 */

export interface FeatureFlags {
  // Audio module features
  AUDIO_UPLOAD_ENABLED: boolean;
  AUDIO_DEVICE_UPLOAD_ENABLED: boolean;
  AUDIO_SYNC_METRICS_ENABLED: boolean;

  // Video module features
  VIDEO_DEVICE_SCOPED_CONTROLS: boolean;
  VIDEO_EXPORT_ENABLED: boolean;

  // Zigbee module features
  ZIGBEE_PAIRING_ENABLED: boolean;
  ZIGBEE_AUTOMATION_RULES_ENABLED: boolean;
  ZIGBEE_QUICK_ACTIONS_ENABLED: boolean;

  // Camera module features
  CAMERA_DEVICE_SWITCHING_ENABLED: boolean;
  CAMERA_EVENT_ACKNOWLEDGMENT_ENABLED: boolean;
  CAMERA_NIGHT_MODE_ENABLED: boolean;

  // Logs module features
  LOGS_REAL_TIME_STREAMING: boolean;
  LOGS_EXPORT_JOBS_ENABLED: boolean;

  // Fleet management features
  FLEET_OFFLINE_HANDLING_ENABLED: boolean;
  FLEET_FIRMWARE_UPDATES_ENABLED: boolean;

  // Settings features
  SETTINGS_DEVICE_PAIRING_ENABLED: boolean;
  SETTINGS_NETWORK_CONFIG_ENABLED: boolean;

  // Development and testing
  PLACEHOLDER_MODE: boolean;
  MOCK_EXTERNAL_SERVICES: boolean;
}

/**
 * Default feature flag values
 * Production defaults should be conservative (false for new features)
 */
const DEFAULT_FLAGS: FeatureFlags = {
  // Audio - partially implemented
  AUDIO_UPLOAD_ENABLED: true,
  AUDIO_DEVICE_UPLOAD_ENABLED: true,
  AUDIO_SYNC_METRICS_ENABLED: false,

  // Video - legacy endpoints still in use
  VIDEO_DEVICE_SCOPED_CONTROLS: false,
  VIDEO_EXPORT_ENABLED: false,

  // Zigbee - mostly placeholders
  ZIGBEE_PAIRING_ENABLED: false,
  ZIGBEE_AUTOMATION_RULES_ENABLED: false,
  ZIGBEE_QUICK_ACTIONS_ENABLED: false,

  // Camera - placeholders
  CAMERA_DEVICE_SWITCHING_ENABLED: false,
  CAMERA_EVENT_ACKNOWLEDGMENT_ENABLED: false,
  CAMERA_NIGHT_MODE_ENABLED: false,

  // Logs - fully implemented
  LOGS_REAL_TIME_STREAMING: true,
  LOGS_EXPORT_JOBS_ENABLED: true,

  // Fleet - basic features only
  FLEET_OFFLINE_HANDLING_ENABLED: false,
  FLEET_FIRMWARE_UPDATES_ENABLED: false,

  // Settings - basic features only
  SETTINGS_DEVICE_PAIRING_ENABLED: false,
  SETTINGS_NETWORK_CONFIG_ENABLED: false,

  // Development
  PLACEHOLDER_MODE: process.env.NODE_ENV !== 'production',
  MOCK_EXTERNAL_SERVICES: process.env.VITE_USE_MOCKS === '1',
};

/**
 * Environment-based flag overrides
 * Can be set via environment variables: FEATURE_FLAG_<NAME>=true/false
 */
function getEnvironmentOverrides(): Partial<FeatureFlags> {
  const overrides: Partial<FeatureFlags> = {};

  for (const [key] of Object.entries(DEFAULT_FLAGS)) {
    const envKey = `FEATURE_FLAG_${key}`;
    const envValue = process.env[envKey];

    if (envValue !== undefined) {
      overrides[key as keyof FeatureFlags] = envValue.toLowerCase() === 'true';
    }
  }

  return overrides;
}

/**
 * Get current feature flags with environment overrides applied
 */
export function getFeatureFlags(): FeatureFlags {
  const environmentOverrides = getEnvironmentOverrides();

  return {
    ...DEFAULT_FLAGS,
    ...environmentOverrides,
  };
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags();
  return flags[feature];
}

/**
 * Helper for guarding placeholder implementations
 * Throws appropriate error based on feature flag status and environment
 */
export function guardPlaceholder(
  feature: keyof FeatureFlags,
  message: string,
  implementationPlan?: string
): void {
  const flags = getFeatureFlags();

  if (!flags[feature]) {
    const featureName = feature.replace(/_/g, ' ').toLowerCase();
    const errorMessage = `${featureName} is disabled`;

    if (flags.PLACEHOLDER_MODE && implementationPlan) {
      throw new Error(`${errorMessage} (placeholder: ${implementationPlan})`);
    }

    throw new Error(errorMessage);
  }

  // Feature is enabled but implementation is incomplete
  if (flags.PLACEHOLDER_MODE && implementationPlan) {
    console.warn(`Feature ${feature} is enabled but implementation is incomplete: ${implementationPlan}`);
  }
}

/**
 * Type-safe feature flag accessor for templates
 */
export const featureFlags = getFeatureFlags();