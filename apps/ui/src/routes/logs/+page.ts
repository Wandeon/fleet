import type { PageLoad } from './$types';
import { fetchLogSnapshot } from '$lib/api/logs-operations';
import type { LogsSnapshot } from '$lib/types';

export const load: PageLoad = async ({ fetch, depends }) => {
  depends('app:logs');

  try {
    const snapshot = await fetchLogSnapshot({ fetch });
    return { snapshot, error: null as string | null } satisfies { snapshot: LogsSnapshot; error: string | null };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load logs';
    return { snapshot: null, error: message };
  }
};
