import { z } from 'zod';

export const deviceIdParamSchema = z.object({
  deviceId: z.string().min(1),
});

const syncModeSchema = z.enum(['independent', 'synced', 'grouped']);

export const audioPlaylistTrackSchema = z.object({
  trackId: z.string().min(1),
  order: z.coerce.number().int().min(0).optional(),
  startOffsetSeconds: z.coerce.number().min(0).nullable().optional(),
  deviceOverrides: z.record(z.string(), z.string()).nullable().optional(),
});

export const audioPlaylistSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  description: z.string().nullish(),
  loop: z.boolean(),
  syncMode: syncModeSchema,
  tracks: z.array(audioPlaylistTrackSchema).default([]),
});

export const audioPlaylistReorderSchema = z.object({
  ordering: z
    .array(
      z.object({
        trackId: z.string().min(1),
        position: z.coerce.number().int().min(0),
      })
    )
    .min(1),
});

export const audioPlaybackAssignmentSchema = z.object({
  deviceId: z.string().min(1),
  trackId: z.string().min(1),
  startOffsetSeconds: z.coerce.number().min(0).optional(),
});

const audioPlaybackBaseSchema = z.object({
  deviceIds: z.array(z.string().min(1)).min(1),
  playlistId: z.string().optional(),
  trackId: z.string().optional(),
  assignments: z.array(audioPlaybackAssignmentSchema).optional(),
  syncMode: syncModeSchema,
});

const playbackSourceRefinement = (value: z.infer<typeof audioPlaybackBaseSchema>) =>
  Boolean(value.playlistId || value.trackId || (value.assignments && value.assignments.length > 0));

export const audioPlaybackRequestSchema = audioPlaybackBaseSchema.refine(playbackSourceRefinement, {
  message: 'Playlist, track, or assignments must be provided',
});

export const audioSeekSchema = z.object({
  positionSeconds: z.coerce.number().min(0),
});

export const audioVolumeSchema = z.object({
  volumePercent: z.coerce.number().min(0).max(100),
});

export const audioMasterVolumeSchema = z.object({
  volumePercent: z.coerce.number().min(0).max(100),
});

export const audioLibraryUploadRegistrationSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().min(1).default('application/octet-stream'),
  sizeBytes: z.coerce
    .number()
    .int()
    .min(0)
    .max(500 * 1024 * 1024)
    .optional(),
  title: z.string().min(1).optional(),
  artist: z.string().optional(),
  tags: z.array(z.string()).default([]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const audioPlaybackSessionSchema = audioPlaybackBaseSchema
  .extend({
    label: z.string().min(1).optional(),
  })
  .refine(playbackSourceRefinement, {
    message: 'Playlist, track, or assignments must be provided',
  });

export const audioSessionSyncSchema = z.object({
  referenceTimestamp: z.string().datetime(),
  maxDriftSeconds: z.coerce.number().min(0),
  perDevice: z.record(z.string(), z.coerce.number()),
  correctionsApplied: z.boolean().default(false),
});

export type AudioPlaylistInput = z.infer<typeof audioPlaylistSchema>;
export type AudioPlaybackRequestInput = z.infer<typeof audioPlaybackRequestSchema>;
export type AudioPlaylistReorderInput = z.infer<typeof audioPlaylistReorderSchema>;
