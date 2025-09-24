import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  const { layout } = await parent();
  return { layout };
};