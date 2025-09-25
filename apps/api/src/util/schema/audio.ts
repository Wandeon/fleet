import { z } from 'zod';

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1)
});

const syncModeSchema = z.enum(['independent', 'synced', 'grouped']);

export const audioPlaylistTrackSchema = z.object({
  trackId: z.string().min(1),
  order: z.coerce.number().int().min(0).optional(),
  startOffsetSeconds: z.coerce.number().min(0).optional(),
  deviceOverrides: z.record(z.string(), z.string()).optional()
});

export const audioPlaylistSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  loop: z.boolean(),
  syncMode: syncModeSchema,
  tracks: z.array(audioPlaylistTrackSchema).default([])
});

export const audioPlaybackAssignmentSchema = z.object({
  deviceId: z.string().min(1),
  trackId: z.string().min(1),
  startOffsetSeconds: z.coerce.number().min(0).optional()
});

export const audioPlaybackRequestSchema = z
  .object({
    deviceIds: z.array(z.string().min(1)).min(1),
    playlistId: z.string().optional(),
    trackId: z.string().optional(),
    assignments: z.array(audioPlaybackAssignmentSchema).optional(),
    syncMode: syncModeSchema
  })
  .refine(
    (value) => value.playlistId || value.trackId || (value.assignments && value.assignments.length > 0),
    'Playlist, track, or assignments must be provided'
  );

export const audioSeekSchema = z.object({
  positionSeconds: z.coerce.number().min(0)
});

export const audioVolumeSchema = z.object({
  volumePercent: z.coerce.number().min(0).max(100)
});

export const audioMasterVolumeSchema = z.object({
  volumePercent: z.coerce.number().min(0).max(100)
});

export type AudioPlaylistInput = z.infer<typeof audioPlaylistSchema>;
export type AudioPlaybackRequestInput = z.infer<typeof audioPlaybackRequestSchema>;
