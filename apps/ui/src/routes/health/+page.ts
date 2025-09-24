import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, fetch }) => {
  const { layout } = await parent();

  // For now, provide mock health data until we implement the health API
  const mockHealthData = {
    health: {
      updatedAt: new Date().toISOString(),
      uptime: '24h 15m',
      metrics: [
        {
          id: 'api-status',
          label: 'API Service',
          value: 'Healthy',
          status: 'ok' as const,
          hint: 'All endpoints responding normally'
        },
        {
          id: 'database',
          label: 'Database',
          value: 'Connected',
          status: 'ok' as const,
          hint: 'Query response time: 12ms'
        },
        {
          id: 'devices',
          label: 'Devices',
          value: '1 offline',
          status: 'warn' as const,
          hint: 'pi-audio-01 unreachable',
          link: { label: 'View details', href: '/fleet' as const }
        }
      ]
    },
    errors: [],
    events: [
      {
        id: 'event-1',
        timestamp: new Date(Date.now() - 300000).toISOString(), // 5 mins ago
        message: 'Health page loaded',
        severity: 'info' as const
      }
    ]
  };

  return {
    layout: {
      ...layout,
      ...mockHealthData
    }
  };
};
