import type { RoutePath } from '$lib/types';

export interface NavItem {
  path: RoutePath;
  label: string;
  description: string;
  icon: string;
}

export const mainNavigation: NavItem[] = [
  { path: '/', label: 'Dashboard', description: 'Overview of all subsystems', icon: '📊' },
  { path: '/audio', label: 'Audio', description: 'Dual Pi playback control', icon: '🎚️' },
  { path: '/video', label: 'Video', description: 'Video wall and TV control', icon: '📺' },
  { path: '/zigbee', label: 'Zigbee', description: 'Lighting and device mesh', icon: '🕸️' },
  { path: '/camera', label: 'Camera', description: 'CCTV and motion capture', icon: '🎥' },
  { path: '/health', label: 'Health', description: 'Subsystem health metrics', icon: '🩺' },
  { path: '/logs', label: 'Logs', description: 'Event audit trail', icon: '📜' }
];

export const moduleOrder: string[] = ['audio', 'video', 'zigbee', 'camera'];
