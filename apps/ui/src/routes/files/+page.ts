import type { PageLoad } from './$types';

const folderMap = {
  audio: 'Audio',
  video: 'Video',
} as const;

export const load = (({ url }) => {
  const folderParam = url.searchParams.get('folder')?.toLowerCase() ?? null;
  const folder = folderParam && folderParam in folderMap ? folderMap[folderParam as keyof typeof folderMap] : null;

  return {
    folder,
  };
}) satisfies PageLoad;
