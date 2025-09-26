import type { PageLoad } from './$types';
import type { EventFeedItem, HealthTile } from '$lib/types';

export const load: PageLoad = async ({ parent }) => {
  const { layout } = await parent();

  // For now, provide mock health data until we implement the health API
  const metrics: HealthTile[] = [
    {
      id: 'api-status',
      label: 'API Service',
      value: 'Healthy',
      status: 'ok',
      hint: 'All endpoints responding normally',
    },
    {
      id: 'database',
      label: 'Database',
      value: 'Connected',
      status: 'ok',
      hint: 'Query response time: 12ms',
    },
    {
      id: 'devices',
      label: 'Devices',
      value: '1 offline',
      status: 'warn',
      hint: 'pi-audio-01 unreachable',
      link: { label: 'View details', href: '/fleet' },
    },
  ];

  const errors: EventFeedItem[] = [];
  const events: EventFeedItem[] = [
    {
      id: 'event-1',
      timestamp: new Date(Date.now() - 300000).toISOString(),
      message: 'Health page loaded',
      severity: 'info',
    },
  ];

  const mockHealthData = {
    health: {
      updatedAt: new Date().toISOString(),
      uptime: '24h 15m',
      metrics,
    },
    errors,
    events,
  };

  return {
    layout: {
      ...layout,
      ...mockHealthData,
    },
  };
};
