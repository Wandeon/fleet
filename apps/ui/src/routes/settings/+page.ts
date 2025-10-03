import type { PageLoad } from './$types';
import { getSettings } from '$lib/api/settings-operations';
import type { SettingsState } from '$lib/types';

export const load: PageLoad = async ({ fetch, parent, depends, data }) => {
  depends('app:settings');
  const { layout } = await parent();

  try {
    const settings = await getSettings({ fetch });
    return {
      layout,
      settings,
      error: null as string | null,
      envConfig: data.envConfig,
    } satisfies {
      layout: typeof layout;
      settings: SettingsState;
      error: string | null;
      envConfig: typeof data.envConfig;
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load settings';
    return {
      layout,
      settings: null,
      error: message,
      envConfig: data.envConfig,
    };
  }
};
