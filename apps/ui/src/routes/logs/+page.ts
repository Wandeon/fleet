import type { PageLoad } from './$types';
import { fetchLogSnapshot } from '$lib/api/logs-operations';
import type { LogsSnapshot } from '$lib/types';

export const load: PageLoad = async ({ fetch, depends, url }) => {
  depends('app:logs');

  const sourceId = url.searchParams.get('source') ?? 'all';

  try {
    const snapshot = await fetchLogSnapshot({ fetch, sourceId });
    return {
      snapshot,
      error: null as string | null,
      initialFilters: { sourceId },
    } satisfies {
      snapshot: LogsSnapshot;
      error: string | null;
      initialFilters: { sourceId: string };
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load logs';
    return { snapshot: null, error: message, initialFilters: { sourceId } };
  }
};
