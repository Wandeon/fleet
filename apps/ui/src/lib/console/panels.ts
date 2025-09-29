import type { FeatureFlagKey } from '$lib/config/features';

export type ConsolePanelId = 'fleet' | 'audio' | 'video' | 'zigbee' | 'camera' | 'logs';

export interface ConsolePanelDefinition {
  id: ConsolePanelId;
  title: string;
  description: string;
  anchor: string;
  featureFlag?: FeatureFlagKey;
}

export const consolePanels: ConsolePanelDefinition[] = [
  {
    id: 'fleet',
    title: 'Fleet overview',
    description: 'Monitor device health and connectivity at a glance.',
    anchor: 'panel-fleet',
  },
  {
    id: 'audio',
    title: 'Audio control',
    description: 'Coordinate playlists, playback sessions, and device groups.',
    anchor: 'panel-audio',
  },
  {
    id: 'video',
    title: 'Video orchestration',
    description: 'Manage displays, inputs, and live previews.',
    anchor: 'panel-video',
    featureFlag: 'video',
  },
  {
    id: 'zigbee',
    title: 'Zigbee mesh',
    description: 'Track sensors, scenes, and pairing workflows.',
    anchor: 'panel-zigbee',
    featureFlag: 'zigbee',
  },
  {
    id: 'camera',
    title: 'Camera monitoring',
    description: 'Review camera uptime, events, and clip requests.',
    anchor: 'panel-camera',
    featureFlag: 'camera',
  },
  {
    id: 'logs',
    title: 'Live logs',
    description: 'Stream, filter, and export runtime logs.',
    anchor: 'panel-logs',
  },
];
