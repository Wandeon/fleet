import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, url }) => {
  const search = new URLSearchParams(url.searchParams);
  search.set('source', params.id);
  const target = `/logs?${search.toString()}`;
  throw redirect(302, target);
};
