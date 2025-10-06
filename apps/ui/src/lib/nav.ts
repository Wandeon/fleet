import { featureFlags } from '$lib/config/features';
import type { RoutePath } from '$lib/types';

export interface NavItem {
  path: RoutePath;
  label: string;
  description: string;
  icon: string;
  external?: boolean;
}

export const mainNavigation: NavItem[] = [
  { path: '/', label: 'Dashboard', description: 'Overview of all subsystems', icon: '📊' },
  { path: '/audio', label: 'Audio', description: 'Dual Pi playback control', icon: '🎚️' },
  ...(featureFlags.video
    ? [
        {
          path: '/video',
          label: 'Video',
          description: 'Video wall and TV control',
          icon: '📺',
        } satisfies NavItem,
      ]
    : []),
  ...(featureFlags.zigbee
    ? [
        {
          path: '/zigbee',
          label: 'Zigbee',
          description: 'Lighting and device mesh',
          icon: '🕸️',
        } satisfies NavItem,
      ]
    : []),
  ...(featureFlags.camera
    ? [
        {
          path: '/camera',
          label: 'Camera',
          description: 'CCTV and motion capture',
          icon: '🎥',
        } satisfies NavItem,
      ]
    : []),
  { path: '/files', label: 'Files', description: 'Asset management', icon: '📁' },
  { path: '/health', label: 'Health', description: 'Subsystem health metrics', icon: '🩺' },
  { path: '/logs', label: 'Logs', description: 'Event audit trail', icon: '📜' },
  { path: '/settings', label: 'Settings', description: 'System configuration', icon: '⚙️' },
];

export const moduleOrder: string[] = [
  'audio',
  ...(featureFlags.video ? ['video'] : []),
  ...(featureFlags.zigbee ? ['zigbee'] : []),
  ...(featureFlags.camera ? ['camera'] : []),
];
