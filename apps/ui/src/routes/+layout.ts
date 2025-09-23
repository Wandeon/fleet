import type { LayoutLoad } from './$types';
import { version } from '$app/environment';
import { apiClient } from '$lib/api/client';

export const load: LayoutLoad = async ({ fetch, depends }) => {
  depends('app:layout');

  const envLabel = import.meta.env.MODE === 'development' ? 'Dev' : 'Prod';

  const [layout, state] = await Promise.all([
    apiClient.fetchLayout({ fetch }),
    apiClient.fetchState({ fetch })
  ]);

  return {
    version,
    envLabel,
    layout,
    connection: state.connection,
    build: state.build,
    lastUpdated: layout.health.updatedAt
  };
};
