import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { apiClient } from '$lib/api/client';
import { consolePanels } from '$lib/console/panels';
import { featureFlags, isFeatureEnabled } from '$lib/config/features';
import type { SystemHealthSummary } from '$lib/types';

type LoadResult<T> = {
  data: T | null;
  error: string | null;
};

const toResult = async <T>(promise: Promise<T>): Promise<LoadResult<T>> => {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return { data: null, error: message };
  }
};

export const load: PageServerLoad = async ({ fetch, depends }) => {
  if (!featureFlags.console) {
    error(404, 'Not found');
  }

  depends('app:console');

  const panels = consolePanels.filter((panel) =>
    panel.featureFlag ? isFeatureEnabled(panel.featureFlag) : true
  );

  const health = await toResult<SystemHealthSummary>(apiClient.fetchSystemHealth({ fetch }));

  return {
    panels,
    health,
  } satisfies {
    panels: typeof panels;
    health: LoadResult<SystemHealthSummary>;
  };
};
