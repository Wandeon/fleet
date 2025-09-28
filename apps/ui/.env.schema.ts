export interface EnvVarDefinition {
  description: string;
  required: boolean;
  defaultValue?: string;
}

export const uiEnvSchema: Record<string, EnvVarDefinition> = {
  VITE_API_BASE: {
    description: 'Base path for Fleet API requests during builds.',
    required: true,
    defaultValue: '/api',
  },
  VITE_USE_MOCKS: {
    description: 'Serve mock JSON instead of live API responses when set to "1".',
    required: true,
    defaultValue: '1',
  },
  VITE_FEATURE_CONSOLE: {
    description: 'Enable the single-page console scaffold.',
    required: false,
    defaultValue: '0',
  },
  VITE_FEATURE_VIDEO: {
    description: 'Expose video controls while feature is in development.',
    required: false,
    defaultValue: '0',
  },
  VITE_FEATURE_ZIGBEE: {
    description: 'Enable Zigbee pairing and controls.',
    required: false,
    defaultValue: '0',
  },
  VITE_FEATURE_CAMERA: {
    description: 'Enable camera monitoring module.',
    required: false,
    defaultValue: '0',
  },
};
